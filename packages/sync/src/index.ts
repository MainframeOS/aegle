import { Core, EntityPayload, encodePayload, getBodyStream } from '@aegle/core'
import {
  BaseResponse,
  Bzz,
  FeedParams,
  PollContentOptions,
  UploadOptions,
  getFeedTopic,
} from '@erebos/api-bzz-node'
import { createHex, hexValue } from '@erebos/hex'
import { hash, pubKeyToAddress } from '@erebos/keccak256'
import { KeyPair, createPublic } from '@erebos/secp256k1'
import {
  Chapter,
  PartialChapter,
  Timeline,
  validateChapter,
} from '@erebos/timeline'
import getStream from 'get-stream'
import PQueue from 'p-queue'
import { Observable } from 'rxjs'
import { flatMap } from 'rxjs/operators'

export function getPublicAddress(keyPair: KeyPair): string {
  return pubKeyToAddress(keyPair.getPublic('array'))
}

export function getSharedTopic(encryptionKey: Buffer, name?: string): hexValue {
  return getFeedTopic({ name, topic: createHex(hash(encryptionKey)).value })
}

export interface FeedReadParams {
  feed: FeedParams
  encryptionKey?: Buffer
}

export function getFeedReadParams(
  writer: string, // Can be a public key (130 chars long) or an address
  name?: string,
  keyPair?: KeyPair,
): FeedReadParams {
  const pubKey = writer.length === 130 ? createPublic(writer) : null
  const feed: FeedParams = {
    user: pubKey === null ? writer : getPublicAddress(pubKey),
  }

  let encryptionKey: Buffer | undefined
  if (keyPair != null) {
    if (pubKey === null) {
      throw new Error(
        'writer argument must be a public key when keyPair is provided to derive the shared key',
      )
    }
    encryptionKey = keyPair.derive(pubKey.getPublic()).toBuffer() as Buffer
    feed.topic = getSharedTopic(encryptionKey, name)
  } else if (name != null) {
    feed.name = name
  }

  return {
    feed,
    encryptionKey,
  }
}

export interface FeedWriteParams extends FeedReadParams {
  signParams?: any
}

export function getFeedWriteParams(
  keyPair: KeyPair,
  name?: string,
  reader?: string,
): FeedWriteParams {
  const user = getPublicAddress(keyPair)
  const feed: FeedParams = { user }

  let encryptionKey: Buffer | undefined
  if (reader != null) {
    const pubKey = createPublic(reader)
    encryptionKey = keyPair.derive(pubKey.getPublic()).toBuffer() as Buffer
    feed.topic = getSharedTopic(encryptionKey, name)
  } else if (name != null) {
    feed.name = name
  }

  return {
    feed,
    encryptionKey,
    signParams: keyPair.getPrivate(),
  }
}

export interface ChannelParams {
  entityType: string
  name?: string
}

export interface WriterParams extends ChannelParams {
  keyPair: KeyPair
  options?: UploadOptions
  reader?: string
}

export interface ReaderParams extends ChannelParams {
  writer: string
  keyPair?: KeyPair
}

export interface SubscriberParams extends ReaderParams {
  options: PollContentOptions
}

export interface SyncConfig {
  bzz: Bzz
  core: Core
}

export class Sync {
  public bzz: Bzz
  public core: Core

  public constructor(config: SyncConfig) {
    this.bzz = config.bzz
    this.core = config.core
  }

  public createPublisher<T, U>(push: (data: T) => Promise<U>) {
    const queue = new PQueue({ concurrency: 1 })
    return async (entity: T): Promise<U> => {
      return await queue.add(() => push(entity))
    }
  }

  public async writeFeed<T>(params: WriterParams, data: T): Promise<hexValue> {
    const { feed, encryptionKey, signParams } = getFeedWriteParams(
      params.keyPair,
      params.name,
      params.reader,
    )
    const payload = await this.core.encodeEntity(params.entityType, data, {
      key: encryptionKey,
    })
    return await this.bzz.setFeedContent(feed, payload, undefined, signParams)
  }

  public createFeedPublisher<T>(params: WriterParams) {
    const { feed, encryptionKey, signParams } = getFeedWriteParams(
      params.keyPair,
      params.name,
      params.reader,
    )
    const push = async (data: T): Promise<hexValue> => {
      const payload = await this.core.encodeEntity(params.entityType, data, {
        key: encryptionKey,
      })
      return await this.bzz.setFeedContent(feed, payload, undefined, signParams)
    }
    return this.createPublisher<T, hexValue>(push)
  }

  public createWriteTimeline<T>(params: WriterParams) {
    const { feed, encryptionKey, signParams } = getFeedWriteParams(
      params.keyPair,
      params.name,
      params.reader,
    )

    let encode
    if (params.reader != null) {
      encode = async (chapter: PartialChapter) => {
        return await encodePayload(chapter, { key: encryptionKey })
      }
    }

    return new Timeline({ bzz: this.bzz, feed, encode, signParams })
  }

  public createTimelinePublisher<T>(params: WriterParams) {
    const add = this.createWriteTimeline(params).createAddChapter()

    return this.createPublisher<T, Chapter<EntityPayload<T>>>(
      async (data: T): Promise<Chapter> => {
        const content = await this.core.validateEntity({
          type: params.entityType,
          data,
        })
        return await add({ content })
      },
    )
  }

  public async readFeed<T>(params: ReaderParams): Promise<T | null> {
    const { feed, encryptionKey } = getFeedReadParams(
      params.writer,
      params.name,
      params.keyPair,
    )

    const res = await this.bzz.getFeedContent(feed, { mode: 'raw' })
    if (res === null) {
      return null
    }

    const payload = await this.core.decodeEntityStream<T>(res.body, {
      key: encryptionKey,
    })
    return payload.data
  }

  public createFeedReader<T>(params: ReaderParams) {
    const { feed, encryptionKey } = getFeedReadParams(
      params.writer,
      params.name,
      params.keyPair,
    )

    return async (): Promise<T | null> => {
      const res = await this.bzz.getFeedContent(feed, { mode: 'raw' })
      if (res === null) {
        return null
      }

      const payload = await this.core.decodeEntityStream<T>(res.body, {
        key: encryptionKey,
      })
      return payload.data
    }
  }

  public createFeedSubscriber<T>(
    params: SubscriberParams,
  ): Observable<EntityPayload<T> | null> {
    const { feed, encryptionKey } = getFeedReadParams(
      params.writer,
      params.name,
      params.keyPair,
    )

    return this.bzz
      .pollFeedContent(feed, {
        whenEmpty: 'ignore',
        ...params.options,
        mode: 'raw',
      })
      .pipe(
        flatMap(async (res: any | null) => {
          return res
            ? await this.core.decodeEntityStream<T>(res.body, {
                key: encryptionKey,
              })
            : null
        }),
      )
  }

  public createReadTimeline<T = any>(params: ReaderParams) {
    const { feed, encryptionKey } = getFeedReadParams(
      params.writer,
      params.name,
      params.keyPair,
    )

    const decode = async (res: BaseResponse<NodeJS.ReadableStream>) => {
      const stream = await getBodyStream(res.body, { key: encryptionKey })
      const body = await getStream(stream)
      const chapter = validateChapter(JSON.parse(body))
      await this.core.validateEntity(chapter.content)
      return chapter
    }

    return new Timeline<T>({ bzz: this.bzz, feed, decode })
  }
}
