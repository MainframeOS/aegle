import { Readable } from 'stream'
import Bzz, {
  FeedParams,
  PollContentOptions,
  UploadOptions,
  getFeedTopic,
} from '@erebos/api-bzz-base'
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
import { DecodeParams, KeyPair } from './types'
import { validateEntity } from './validation'

export function createEntityPublisher<T>(
  type: string,
  push: (data: any) => Promise<T>,
) {
  const queue = new PQueue({ concurrency: 1 })
  return async function publish(data: any): Promise<T> {
    const entity = await validateEntity({ type, data })
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
  publisher: string, // Can be a public key (130 chars long) or an address
  name?: string,
  keyPair?: any, // TODO: KeyPair type
): FeedReadParams {
  const pubKey = publisher.length === 130 ? createPublic(publisher) : null
  const feed: FeedParams = {
    user: pubKey === null ? publisher : getPublicAddress(pubKey),
  }

  let encryptionKey: Buffer | undefined
  if (keyPair != null) {
    if (pubKey === null) {
      throw new Error(
        'publisher argument must be a public key when keyPair is provided to derive the shared key',
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
  subscriber?: string,
): FeedWriteParams {
  const user = getPublicAddress(keyPair)
  const feed: FeedParams = { user }

  let encryptionKey: Buffer | undefined
  if (subscriber != null) {
    const pubKey = createPublic(subscriber)
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

export interface PublisherParams extends ChannelParams {
  keyPair: KeyPair
  options?: UploadOptions
  subscriber?: string
}

export function createFeedPublisher<T>(params: PublisherParams) {
  const { feed, encryptionKey, signParams } = getFeedWriteParams(
    params.keyPair,
    params.name,
    params.subscriber,
  )
  const push = async (content: T) => {
    const payload = await encodePayload(content, { key: encryptionKey })
    return await params.bzz.setFeedContent(feed, payload, undefined, signParams)
  }
  return createEntityPublisher(params.entityType, push)
}

export function createTimelinePublisher<T>(params: PublisherParams) {
  const { feed, encryptionKey, signParams } = getFeedWriteParams(
    params.keyPair,
    params.name,
    params.subscriber,
  )

  let encode
  if (params.subscriber != null) {
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

  return createEntityPublisher(params.entityType, push)
}

export interface ReaderParams extends ChannelParams {
  publisher: string
  keyPair?: KeyPair
}

export interface SubscriberParams extends ReaderParams {
  options: PollContentOptions
}

export function createFeedSubscriber<T>(params: SubscriberParams) {
  const { feed, encryptionKey } = getFeedReadParams(
    params.publisher,
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

export function createTimelineDecoder(params?: DecodeParams) {
  return async function decode(res: Readable) {
    const stream = await getBodyStream(res, params)
    const body = await getStream(stream)
    const chapter = validateChapter(JSON.parse(body))
    await validateEntity(chapter.content)
    return chapter
  }
}

export function createReadTimeline(params: ReaderParams) {
  const { feed, encryptionKey } = getFeedReadParams(
    params.publisher,
    params.name,
    params.keyPair,
  )
  return new Timeline({
    bzz: params.bzz,
    feed,
    decode: createTimelineDecoder({ key: encryptionKey }),
  })
}

export function createTimelineLatestSubscriber(params: SubscriberParams) {
  const timeline = createReadTimeline(params)
  return timeline.pollLatestChapter(params.options)
}

export function createTimelineLiveSubscriber(params: SubscriberParams) {
  const timeline = createReadTimeline(params)
  return timeline.live(params.options)
}
