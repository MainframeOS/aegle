import { Bzz, PollContentOptions } from '@erebos/api-bzz-node'
import { KeyPair } from '@erebos/secp256k1'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Actor } from '../schemas/actor'
import {
  createEntityFeedPublisher,
  createEntityFeedSubscriber,
  readFeedEntity,
  writeFeedEntity,
} from '../channels'
import { ACTOR_NAME } from '../namespace'

export interface ActorReaderParams {
  bzz: Bzz
  actor: string
}

export async function readActor(
  params: ActorReaderParams,
): Promise<Actor | null> {
  return await readFeedEntity({
    bzz: params.bzz,
    writer: params.actor,
    entityType: ACTOR_NAME,
    name: ACTOR_NAME,
  })
}

export interface ActorWriterParams {
  bzz: Bzz
  keyPair: KeyPair
}

export async function writeActor(
  params: ActorWriterParams,
  data: Actor,
): Promise<string> {
  return await writeFeedEntity(
    {
      bzz: params.bzz,
      keyPair: params.keyPair,
      entityType: ACTOR_NAME,
      name: ACTOR_NAME,
    },
    data,
  )
}

export interface ActorSubscriberParams extends ActorReaderParams {
  options: PollContentOptions
}

export function createActorSubscriber(
  params: ActorSubscriberParams,
): Observable<Actor> {
  return createEntityFeedSubscriber<Actor>({
    bzz: params.bzz,
    entityType: ACTOR_NAME,
    name: ACTOR_NAME,
    writer: params.actor,
    options: {
      whenEmpty: 'ignore',
      ...params.options,
      mode: 'raw',
    },
  }).pipe(map((payload: any) => payload.data))
}

export function createActorPublisher(params: ActorWriterParams) {
  return createEntityFeedPublisher<Actor>({
    ...params,
    entityType: ACTOR_NAME,
    name: ACTOR_NAME,
  })
}

export const actor = {
  read: readActor,
  write: writeActor,
  createSubscriber: createActorSubscriber,
  createPublisher: createActorPublisher,
}
