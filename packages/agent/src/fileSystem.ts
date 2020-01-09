import { Readable } from 'stream'
import {
  CRYPTO_ALGORITHM,
  FILE_SYSTEM_NAME,
  FileData,
  FileMetadata,
  FilesRecord,
  FileSystemData,
  createCipher,
  createDecipher,
  createKey,
  encodePayload,
  encrypt,
} from '@aegle/core'
import { FeedWriteParams, Sync, getFeedWriteParams } from '@aegle/sync'
import { KeyPair } from '@erebos/secp256k1'
// eslint-disable-next-line import/default
import getStream from 'get-stream'
import isEqual from 'fast-deep-equal'
import PQueue from 'p-queue'
import { BehaviorSubject, Subscription, interval } from 'rxjs'
import { flatMap } from 'rxjs/operators'

import { SyncParams } from './types'

const PATH_RE = new RegExp('^(/[^/]+)+$', 'i')

const POLL_INTERVAL = 120 * 1000 // 2 mins
export interface FileUploadParams extends FileMetadata {
  encrypt?: boolean
}

export function isValidPath(path: string): boolean {
  return PATH_RE.test(path)
}

export async function downloadFile(
  sync: Sync,
  file: FileData,
): Promise<NodeJS.ReadableStream> {
  const res = await sync.bzz.download(file.hash, {
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
  sync: Sync,
  data: string | Buffer | Readable | Record<string, any>,
  params: FileUploadParams = {},
): Promise<FileData> {
  const key = params.encrypt ? await createKey() : null
  let hash, encryption, size

  if (data instanceof Readable) {
    if (params.size == null) {
      throw new Error(
        'The `size` parameter must be provided when calling `uploadFile()` with a Stream',
      )
    } else {
      size = params.size
    }
    if (key === null) {
      hash = await sync.bzz.uploadFile(data, { size })
    } else {
      const { cipher, iv } = await createCipher(CRYPTO_ALGORITHM, key)
      hash = await sync.bzz.uploadFile(data.pipe(cipher), { size })
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
      hash = await sync.bzz.uploadFile(contents)
    } else {
      const payload = await encrypt(CRYPTO_ALGORITHM, key, contents)
      hash = await sync.bzz.uploadFile(payload.data)
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

export interface FileSystemParams {
  sync: Sync
  files?: FilesRecord
}

export class FileSystem {
  protected sync: Sync

  public readonly files$: BehaviorSubject<FilesRecord>

  public constructor(params: FileSystemParams) {
    this.sync = params.sync
    this.files$ = new BehaviorSubject(params.files || {})
  }

  public hasFile(path: string): boolean {
    return this.files$.value[path] != null
  }

  public getFile(path: string): FileData | null {
    return this.files$.value[path] || null
  }

  public async downloadFile(path: string): Promise<NodeJS.ReadableStream> {
    const file = this.files$.value[path]
    if (file == null) {
      throw new Error('File not found')
    }
    return await downloadFile(this.sync, file)
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

export enum FileSystemPullSyncState {
  PENDING,
  PULLING,
  FAILED,
  DONE,
}

export enum FileSystemPushSyncState {
  IDLE,
  PUSHING,
  FAILED,
}

export interface FileSystemReaderParams extends FileSystemParams, SyncParams {
  writer: string
  keyPair?: KeyPair
}

export class FileSystemReader extends FileSystem {
  private interval: number
  private keyPair: KeyPair | undefined
  private subscription: Subscription | undefined
  private writer: string
  private read: () => Promise<FileSystemData | null>

  public readonly pullSync$: BehaviorSubject<FileSystemPullSyncState>

  public error: Error | undefined

  public constructor(params: FileSystemReaderParams) {
    super(params)

    this.interval = params.interval || POLL_INTERVAL
    this.keyPair = params.keyPair
    this.writer = params.writer

    this.pullSync$ = new BehaviorSubject(
      FileSystemPullSyncState.PENDING as FileSystemPullSyncState,
    )
    this.read = this.sync.createFeedReader<FileSystemData>({
      writer: this.writer,
      keyPair: this.keyPair,
      entityType: FILE_SYSTEM_NAME,
      name: FILE_SYSTEM_NAME,
    })

    if (params.autoStart) {
      this.start()
    }
  }

  public start(period?: number): void {
    if (this.subscription != null) {
      this.subscription.unsubscribe()
    }
    this.subscription = interval(period || this.interval)
      .pipe(flatMap(async () => await this.pull()))
      .subscribe()
  }

  public stop(): void {
    if (this.subscription != null) {
      this.subscription.unsubscribe()
      this.subscription = undefined
    }
  }

  public async pull(): Promise<void> {
    if (this.pullSync$.value !== FileSystemPullSyncState.PULLING) {
      this.pullSync$.next(FileSystemPullSyncState.PULLING)
      try {
        this.error = undefined
        const fs = await this.read()
        if (fs != null && !isEqual(fs.files, this.files$.value)) {
          this.files$.next(fs.files)
        }
        this.pullSync$.next(FileSystemPullSyncState.DONE)
      } catch (err) {
        this.error = err
        this.pullSync$.next(FileSystemPullSyncState.FAILED)
      }
    }
  }
}

export interface FileSystemChanges {
  sync: boolean
  timestamp: number
}

export interface FileSystemWriterParams extends FileSystemParams, SyncParams {
  keyPair: KeyPair
  files?: FilesRecord
  reader?: string
}

export class FileSystemWriter extends FileSystem {
  private feedParams: FeedWriteParams
  private interval: number
  private publishQueue: PQueue
  private subscription: Subscription | undefined

  public readonly changes$: BehaviorSubject<FileSystemChanges>
  public readonly pullSync$: BehaviorSubject<FileSystemPullSyncState>
  public readonly pushSync$: BehaviorSubject<FileSystemPushSyncState>

  public error: Error | undefined

  public constructor(params: FileSystemWriterParams) {
    super(params)

    this.feedParams = getFeedWriteParams(
      params.keyPair,
      FILE_SYSTEM_NAME,
      params.reader,
    )
    this.interval = params.interval || POLL_INTERVAL
    this.publishQueue = new PQueue({ concurrency: 1 })

    const hasFiles = params.files != null
    this.changes$ = new BehaviorSubject({
      sync: true,
      timestamp: 0,
    } as FileSystemChanges)
    this.pullSync$ = new BehaviorSubject(
      hasFiles ? FileSystemPullSyncState.DONE : FileSystemPullSyncState.PENDING,
    ) as BehaviorSubject<FileSystemPullSyncState>
    this.pushSync$ = new BehaviorSubject(
      FileSystemPushSyncState.IDLE as FileSystemPushSyncState,
    )

    if (params.autoStart) {
      this.start()
    }
  }

  protected setLocalFiles(files: FilesRecord): void {
    this.files$.next(files)
    this.changes$.next({ sync: false, timestamp: Date.now() })
  }

  protected async publish(): Promise<void> {
    this.pushSync$.next(FileSystemPushSyncState.PUSHING)
    try {
      this.error = undefined
      const payload = await encodePayload(
        { type: FILE_SYSTEM_NAME, data: { files: this.files$.value } },
        { key: this.feedParams.encryptionKey },
      )
      await this.sync.bzz.setFeedContent(
        this.feedParams.feed,
        payload,
        undefined,
        this.feedParams.signParams,
      )
      this.pushSync$.next(FileSystemPushSyncState.IDLE)
    } catch (err) {
      this.error = err
      this.pushSync$.next(FileSystemPushSyncState.FAILED)
    }
  }

  public async initialize(): Promise<void> {
    switch (this.pullSync$.value) {
      case FileSystemPullSyncState.DONE:
        return
      case FileSystemPullSyncState.PULLING:
        throw new Error('FileSystemWriter is already being initialized')
      default: {
        try {
          const res = await this.sync.bzz.getFeedContent(this.feedParams.feed, {
            mode: 'raw',
          })
          if (res != null) {
            const payload = await this.sync.core.decodeEntityStream<
              FileSystemData
            >(res.body, { key: this.feedParams.encryptionKey })
            this.files$.next(payload.data.files)
          }
          this.pullSync$.next(FileSystemPullSyncState.DONE)
        } catch (err) {
          this.pullSync$.next(FileSystemPullSyncState.FAILED)
        }
      }
    }
  }

  public start(period?: number): void {
    if (this.subscription != null) {
      this.subscription.unsubscribe()
    }
    this.subscription = interval(period || this.interval)
      .pipe(flatMap(async () => await this.push()))
      .subscribe()
  }

  public stop(): void {
    if (this.subscription != null) {
      this.subscription.unsubscribe()
      this.subscription = undefined
    }
  }

  public async push(): Promise<void> {
    if (this.changes$.value.sync) {
      // Nothing new to push
      return
    }

    // Keep track of timestamp at the time changes are being pushed
    const { timestamp } = this.changes$.value
    await this.publishQueue.add(() => this.publish())

    // If no other change has happened, changes are in sync
    if (this.changes$.value.timestamp === timestamp) {
      this.changes$.next({ sync: true, timestamp })
    }
  }

  public setFile(path: string, file: FileData): void {
    if (!isValidPath(path)) {
      throw new Error('Invalid path')
    }
    this.setLocalFiles({ ...this.files$.value, [path]: file })
  }

  public removeFile(path: string): boolean {
    if (this.files$.value[path] == null) {
      return false
    }
    const { [path]: _removeFile, ...otherFiles } = this.files$.value
    this.setLocalFiles(otherFiles)
    return true
  }

  public moveFile(fromPath: string, toPath: string): boolean {
    if (!isValidPath(toPath)) {
      throw new Error('Invalid path')
    }
    const file = this.files$.value[fromPath]
    if (file == null) {
      return false
    }
    const { [fromPath]: _removeFile, ...otherFiles } = this.files$.value
    this.setLocalFiles({ ...otherFiles, [toPath]: file })
    return true
  }

  public async uploadFile(
    path: string,
    data: string | Buffer | Readable | Record<string, any>,
    params?: FileUploadParams,
  ): Promise<FileData> {
    if (!isValidPath(path)) {
      throw new Error('Invalid path')
    }
    const file = await uploadFile(this.sync, data, params)
    this.setLocalFiles({ ...this.files$.value, [path]: file })
    return file
  }
}
