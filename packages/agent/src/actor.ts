import { ACTOR_NAME, ActorData } from '@aegle/core'
import { Sync } from '@aegle/sync'
import { hexValue } from '@erebos/hex'
import { KeyPair } from '@erebos/secp256k1'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

const FEED_PARAMS = { entityType: ACTOR_NAME, name: ACTOR_NAME }

export interface ActorReaderParams {
  actor: string
  sync: Sync
}

export async function readActor(
  config: ActorReaderParams,
): Promise<ActorData | null> {
  return await config.sync.readFeed({ ...FEED_PARAMS, writer: config.actor })
}

export interface ActorSubscriberParams extends ActorReaderParams {
  interval: number
}

export function createActorSubscriber(
  params: ActorSubscriberParams,
): Observable<ActorData> {
  return params.sync
    .createFeedSubscriber<ActorData>({
      ...FEED_PARAMS,
      writer: params.actor,
      options: { interval: params.interval },
    })
    .pipe(map((payload: any) => payload.data))
}

export interface ActorWriterParams {
  keyPair: KeyPair
  sync: Sync
}

export async function writeActor(
  params: ActorWriterParams,
  data: ActorData,
): Promise<hexValue> {
  return await params.sync.writeFeed(
    { ...FEED_PARAMS, keyPair: params.keyPair },
    data,
  )
}

export function createActorWriter(params: ActorWriterParams) {
  return params.sync.createFeedPublisher<ActorData>({
    ...FEED_PARAMS,
    keyPair: params.keyPair,
  })
}
