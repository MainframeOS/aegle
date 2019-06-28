import Bzz, { PollContentOptions } from '@erebos/api-bzz-base'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Peer } from '../schemas/peer'
import {
  createEntityFeedPublisher,
  createEntityFeedSubscriber,
  readFeedEntity,
  writeFeedEntity,
} from '../channels'
import { PEER_NAME } from '../namespace'

export interface PeerReaderParams {
  bzz: Bzz<any>
  peer: string
}

export async function readPeer(params: PeerReaderParams): Promise<Peer | null> {
  return await readFeedEntity({
    bzz: params.bzz,
    writer: params.peer,
    entityType: PEER_NAME,
    name: PEER_NAME,
  })
}

export interface PeerWriterParams {
  bzz: Bzz<any>
  keyPair: any // TODO: keyPair type
}

export async function writePeer(
  params: PeerWriterParams,
  data: Peer,
): Promise<string> {
  return await writeFeedEntity(
    {
      bzz: params.bzz,
      keyPair: params.keyPair,
      entityType: PEER_NAME,
      name: PEER_NAME,
    },
    data,
  )
}

export interface PeerSubscriberParams extends PeerReaderParams {
  options: PollContentOptions
}

export function createPeerSubscriber(
  params: PeerSubscriberParams,
): Observable<Peer> {
  return createEntityFeedSubscriber<Peer>({
    bzz: params.bzz,
    entityType: PEER_NAME,
    name: PEER_NAME,
    writer: params.peer,
    options: {
      whenEmpty: 'ignore',
      ...params.options,
      mode: 'raw',
    },
  }).pipe(map((payload: any) => payload.data))
}

export function createPeerPublisher(params: PeerWriterParams) {
  return createEntityFeedPublisher<Peer>({
    ...params,
    entityType: PEER_NAME,
    name: PEER_NAME,
  })
}
