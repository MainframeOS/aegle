import { Readable } from 'stream'
import Bzz, {
  FeedParams,
  PollContentOptions,
  UploadOptions,
  getFeedTopic,
} from '@erebos/api-bzz-base'
import { hexValue } from '@erebos/hex'
import { pubKeyToAddress } from '@erebos/keccak256'
import { createPublic } from '@erebos/secp256k1'
import {
  Chapter,
  PartialChapter,
  Timeline,
  validateChapter,
} from '@erebos/timeline'
import getStream from 'get-stream'
import PQueue from 'p-queue'
import { flatMap } from 'rxjs/operators'

import { decodeEntityStream, encodePayload, getBodyStream } from './encoding'
import { DecodeParams, EntityPayload, KeyPair } from './types'
import { validateEntity } from './validation'

export function createEntityPublisher<T, U>(
  type: string,
  push: (data: any) => Promise<U>,
) {
  const queue = new PQueue({ concurrency: 1 })
  return async function publish(data: T): Promise<U> {
    const entity = await validateEntity<T>({ type, data })
    return await queue.add(() => push(entity))
  }
}

// TODO: KeyPair type
export function getPublicAddress(keyPair: any): string {
  return pubKeyToAddress(keyPair.getPublic('array'))
}

export interface FeedReadParams {
  feed: FeedParams
  encryptionKey?: Buffer
}

export function getFeedReadParams(
  writer: string, // Can be a public key (130 chars long) or an address
  name?: string,
  keyPair?: any, // TODO: KeyPair type
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
    encryptionKey = keyPair.derive(pubKey.getPublic()).toBuffer()
    feed.topic = getFeedTopic({
      name,
      topic: getPublicAddress(keyPair),
    })
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
  keyPair: any, // TODO: KeyPair type
  name?: string,
  reader?: string,
): FeedWriteParams {
  const user = getPublicAddress(keyPair)
  const feed: FeedParams = { user }

  let encryptionKey: Buffer | undefined
  if (reader != null) {
    const pubKey = createPublic(reader)
    encryptionKey = keyPair.derive(pubKey.getPublic()).toBuffer()
    feed.topic = getFeedTopic({
      name,
      topic: getPublicAddress(pubKey),
    })
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
  bzz: Bzz<any>
  entityType: string
  name?: string
}

export interface WriterParams extends ChannelParams {
  keyPair: KeyPair
  options?: UploadOptions
  reader?: string
}

export async function writeFeedEntity<T>(
  params: WriterParams,
  data: T,
): Promise<string> {
  const { feed, encryptionKey, signParams } = getFeedWriteParams(
    params.keyPair,
    params.name,
    params.reader,
  )
  const payload = await encodePayload(
    { type: params.entityType, data },
    { key: encryptionKey },
  )
  return await params.bzz.setFeedContent(feed, payload, undefined, signParams)
}

export function createEntityFeedPublisher<T>(params: WriterParams) {
  const { feed, encryptionKey, signParams } = getFeedWriteParams(
    params.keyPair,
    params.name,
    params.reader,
  )
  const push = async (content: T): Promise<hexValue> => {
    const payload = await encodePayload(content, { key: encryptionKey })
    return await params.bzz.setFeedContent(feed, payload, undefined, signParams)
  }
  return createEntityPublisher<T, hexValue>(params.entityType, push)
}

export function createEntityTimelinePublisher<T>(params: WriterParams) {
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
  const timeline = new Timeline({
    bzz: params.bzz,
    feed,
    encode,
    signParams,
  })
  const add = timeline.createAddChapter()
  const push = async (content: T): Promise<Chapter> => await add({ content })

  return createEntityPublisher<T, Chapter<EntityPayload<T>>>(
    params.entityType,
    push,
  )
}

export interface ReaderParams extends ChannelParams {
  writer: string
  keyPair?: KeyPair
}

export async function readFeedEntity<T>(
  params: ReaderParams,
): Promise<T | null> {
  const { feed, encryptionKey } = getFeedReadParams(
    params.writer,
    params.name,
    params.keyPair,
  )

  const res = await params.bzz.getFeedContent(feed, { mode: 'raw' })
  if (res === null) {
    return null
  }

  const payload = await decodeEntityStream<T>(res.body, { key: encryptionKey })
  return payload.data
}

export function createEntityFeedReader<T>(params: ReaderParams) {
  const { feed, encryptionKey } = getFeedReadParams(
    params.writer,
    params.name,
    params.keyPair,
  )

  return async function read(): Promise<T | null> {
    const res = await params.bzz.getFeedContent(feed, { mode: 'raw' })
    if (res === null) {
      return null
    }

    const payload = await decodeEntityStream<T>(res.body, {
      key: encryptionKey,
    })
    return payload.data
  }
}

export interface SubscriberParams extends ReaderParams {
  options: PollContentOptions
}

export function createEntityFeedSubscriber<T>(params: SubscriberParams) {
  const { feed, encryptionKey } = getFeedReadParams(
    params.writer,
    params.name,
    params.keyPair,
  )

  return params.bzz.pollFeedContent(feed, params.options).pipe(
    flatMap(async (res: any | null) => {
      return res
        ? await decodeEntityStream<T>(res.body, { key: encryptionKey })
        : null
    }),
  )
}

export function createEntityTimelineDecoder(params?: DecodeParams) {
  return async function decode(res: Readable) {
    const stream = await getBodyStream(res, params)
    const body = await getStream(stream)
    const chapter = validateChapter(JSON.parse(body))
    await validateEntity(chapter.content)
    return chapter
  }
}

export function createEntityReadTimeline(params: ReaderParams) {
  const { feed, encryptionKey } = getFeedReadParams(
    params.writer,
    params.name,
    params.keyPair,
  )
  return new Timeline({
    bzz: params.bzz,
    feed,
    decode: createEntityTimelineDecoder({ key: encryptionKey }),
  })
}

export function createEntityTimelineLatestSubscriber(params: SubscriberParams) {
  const timeline = createEntityReadTimeline(params)
  return timeline.pollLatestChapter(params.options)
}

export function createEntityTimelineLiveSubscriber(params: SubscriberParams) {
  const timeline = createEntityReadTimeline(params)
  return timeline.live(params.options)
}
