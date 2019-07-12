import { Readable } from 'stream'
import { Bzz } from '@erebos/api-bzz-node'
import { KeyPair } from '@erebos/secp256k1'
import getStream from 'get-stream'
import PQueue from 'p-queue'
import { BehaviorSubject } from 'rxjs'

import {
  FeedWriteParams,
  createEntityFeedReader,
  getFeedWriteParams,
} from '../channels'
import { CRYPTO_ALGORITHM } from '../constants'
import { createCipher, createDecipher, createKey, encrypt } from '../crypto'
import { decodeEntityStream, encodePayload } from '../encoding'
import { FILE_SYSTEM_NAME } from '../namespace'
import {
  File,
  FileMetadata,
  FilesRecord,
  FileSystem,
} from '../schemas/fileSystem'

const PATH_RE = new RegExp('^(/[^/]+)+$', 'i')

export interface FileUploadParams extends FileMetadata {
  encrypt?: boolean
}

export function isValidPath(path: string): boolean {
  return PATH_RE.test(path)
}

export async function downloadFile(
  bzz: Bzz,
  file: File,
): Promise<NodeJS.ReadableStream> {
  const res = await bzz.download(file.hash, {
    mode: 'raw',
    contentType: file.contentType,
  })
  if (file.encryption != null) {
    const { key, ...params } = file.encryption
    const decipher = createDecipher(key, params)
    return res.body.pipe(decipher)
  }
  return res.body
}

export async function uploadFile(
  bzz: Bzz,
  data: string | Buffer | Readable | Record<string, any>,
  params: FileUploadParams = {},
): Promise<File> {
  const key = params.encrypt ? await createKey() : null
  let hash, encryption, size

  if (data instanceof Readable) {
    if (key === null) {
      hash = await bzz.uploadFileStream(data)
    } else {
      const { cipher, iv } = await createCipher(CRYPTO_ALGORITHM, key)
      hash = await bzz.uploadFileStream(data.pipe(cipher))
      encryption = {
        algorithm: CRYPTO_ALGORITHM,
        authTag: cipher.getAuthTag().toString('base64'),
        key: key.toString('base64'),
        iv,
      }
    }
  } else {
    let contents
    if (Buffer.isBuffer(data)) {
      contents = data
    } else {
      contents = Buffer.from(
        typeof data === 'string' ? data : JSON.stringify(data),
      )
    }
    size = params.size || contents.length

    if (key === null) {
      hash = await bzz.uploadFile(contents)
    } else {
      const payload = await encrypt(CRYPTO_ALGORITHM, key, contents)
      hash = await bzz.uploadFile(payload.data)
      encryption = { ...payload.params, key: key.toString('base64') }
    }
  }

  return {
    hash,
    encryption,
    size,
    contentType: params.contentType,
  }
}

interface FileSystemBaseParams {
  bzz: Bzz
}

export abstract class FileSystemBase {
  protected bzz: Bzz
  public files: BehaviorSubject<FilesRecord>

  public constructor(bzz: Bzz, files: FilesRecord) {
    this.bzz = bzz
    this.files = new BehaviorSubject(files)
  }

  public hasFile(path: string): boolean {
    return this.files.value[path] != null
  }

  public getFile(path: string): File | null {
    return this.files.value[path] || null
  }

  public async downloadFile(path: string): Promise<NodeJS.ReadableStream> {
    const file = this.files.value[path]
    if (file == null) {
      throw new Error('File not found')
    }
    return await downloadFile(this.bzz, file)
  }

  public async downloadText(path: string): Promise<string> {
    const res = await this.downloadFile(path)
    return await getStream(res)
  }

  public async downloadJSON<T = any>(path: string): Promise<T> {
    const text = await this.downloadText(path)
    return JSON.parse(text)
  }
}

enum FileSystemPullSyncState {
  PENDING,
  PULLING,
  FAILED,
  DONE,
}

enum FileSystemPushSyncState {
  IDLE,
  PUSHING,
  FAILED,
}

export interface FileSystemReaderParams extends FileSystemBaseParams {
  writer: string
  keyPair?: KeyPair
}

// TODO: FileSystemReader class
// subscribes to the feed at given interval to update local state

export class FileSystemReader extends FileSystemBase {
  private read: () => Promise<FileSystem | null>

  public pullSync: BehaviorSubject<FileSystemPullSyncState>

  public constructor(params: FileSystemReaderParams) {
    super(params.bzz, {})

    this.pullSync = new BehaviorSubject(
      FileSystemPullSyncState.PENDING as FileSystemPullSyncState,
    )

    this.read = createEntityFeedReader<FileSystem>({
      bzz: params.bzz,
      writer: params.writer,
      keyPair: params.keyPair,
      entityType: FILE_SYSTEM_NAME,
      name: FILE_SYSTEM_NAME,
    })
  }

  public async pull(): Promise<void> {
    if (this.pullSync.value !== FileSystemPullSyncState.PULLING) {
      this.pullSync.next(FileSystemPullSyncState.PULLING)
      try {
        const fs = await this.read()
        if (fs != null) {
          this.files.next(fs.files)
        }
        this.pullSync.next(FileSystemPullSyncState.DONE)
      } catch (err) {
        this.pullSync.next(FileSystemPullSyncState.FAILED)
      }
    }
  }
}

export interface FileSystemChanges {
  sync: boolean
  timestamp: number
}

export interface FileSystemWriterParams extends FileSystemBaseParams {
  keyPair: KeyPair
  files?: FilesRecord
  reader?: string
}

export class FileSystemWriter extends FileSystemBase {
  private feedParams: FeedWriteParams
  private publishQueue: PQueue

  public changes: BehaviorSubject<FileSystemChanges>
  public pullSync: BehaviorSubject<FileSystemPullSyncState>
  public pushSync: BehaviorSubject<FileSystemPushSyncState>

  public constructor(params: FileSystemWriterParams) {
    super(params.bzz, params.files == null ? {} : params.files)

    this.feedParams = getFeedWriteParams(
      params.keyPair,
      FILE_SYSTEM_NAME,
      params.reader,
    )
    this.publishQueue = new PQueue({ concurrency: 1 })

    const hasFiles = params.files != null
    this.changes = new BehaviorSubject({
      sync: true,
      timestamp: 0,
    } as FileSystemChanges)
    this.pullSync = new BehaviorSubject(
      hasFiles ? FileSystemPullSyncState.DONE : FileSystemPullSyncState.PENDING,
    ) as BehaviorSubject<FileSystemPullSyncState>
    this.pushSync = new BehaviorSubject(
      FileSystemPushSyncState.IDLE as FileSystemPushSyncState,
    )
  }

  protected setLocalFiles(files: FilesRecord): void {
    this.files.next(files)
    this.changes.next({ sync: false, timestamp: Date.now() })
  }

  protected async publish(): Promise<void> {
    this.pushSync.next(FileSystemPushSyncState.PUSHING)
    try {
      const payload = await encodePayload(
        {
          type: FILE_SYSTEM_NAME,
          data: { files: this.files.value },
        },
        { key: this.feedParams.encryptionKey },
      )
      await this.bzz.setFeedContent(
        this.feedParams.feed,
        payload,
        undefined,
        this.feedParams.signParams,
      )
      this.pushSync.next(FileSystemPushSyncState.IDLE)
    } catch (err) {
      this.pushSync.next(FileSystemPushSyncState.FAILED)
    }
  }

  public async initialize(): Promise<void> {
    switch (this.pullSync.value) {
      case FileSystemPullSyncState.DONE:
        return
      case FileSystemPullSyncState.PULLING:
        throw new Error('FileSystemWriter is already being initialized')
      default: {
        try {
          const res = await this.bzz.getFeedContent(this.feedParams.feed, {
            mode: 'raw',
          })
          if (res != null) {
            const payload = await decodeEntityStream<FileSystem>(res.body, {
              key: this.feedParams.encryptionKey,
            })
            this.files.next(payload.data.files)
          }
          this.pullSync.next(FileSystemPullSyncState.DONE)
        } catch (err) {
          this.pullSync.next(FileSystemPullSyncState.FAILED)
        }
      }
    }
  }

  public async push(): Promise<void> {
    if (this.changes.value.sync) {
      // Nothing new to push
      return
    }

    // Keep track of timestamp at the time changes are being pushed
    const { timestamp } = this.changes.value
    await this.publishQueue.add(() => this.publish())

    // If no other change has happened, changes are in sync
    if (this.changes.value.timestamp === timestamp) {
      this.changes.next({ sync: true, timestamp })
    }
    // TODO: should there be a "sync strategy" to automatically sync at a given interval, or when any change is made?
  }

  public setFile(path: string, file: File): void {
    if (!isValidPath(path)) {
      throw new Error('Invalid path')
    }
    this.setLocalFiles({ ...this.files.value, [path]: file })
  }

  public removeFile(path: string): boolean {
    if (this.files.value[path] == null) {
      return false
    }
    const { [path]: _removeFile, ...otherFiles } = this.files.value
    this.setLocalFiles(otherFiles)
    return true
  }

  public moveFile(fromPath: string, toPath: string): boolean {
    if (!isValidPath(toPath)) {
      throw new Error('Invalid path')
    }
    const file = this.files.value[fromPath]
    if (file == null) {
      return false
    }
    const { [fromPath]: _removeFile, ...otherFiles } = this.files.value
    this.setLocalFiles({ ...otherFiles, [toPath]: file })
    return true
  }

  public async uploadFile(
    path: string,
    data: string | Buffer | Readable | Record<string, any>,
    params?: FileUploadParams,
  ): Promise<File> {
    if (!isValidPath(path)) {
      throw new Error('Invalid path')
    }
    const file = await uploadFile(this.bzz, data, params)
    this.setLocalFiles({ ...this.files.value, [path]: file })
    return file
  }
}

// TODO: add and export createFileSystemReader and createFileSystemWriter

export const fileSystem = {
  downloadFile,
  uploadFile,
  Reader: FileSystemReader,
  Writer: FileSystemWriter,
}
