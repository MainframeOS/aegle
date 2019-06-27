import Bzz, { PollContentOptions } from '@erebos/api-bzz-base'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Peer } from '../schemas/peer'
import {
  createEntityFeedPublisher,
  createEntityFeedSubscriber,
} from '../channels'
import { PEER_NAME } from '../namespace'

export interface PeerSubscriberParams {
  bzz: Bzz<any>
  peer: string
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

// TODO: keyPair type
export function createPeerPublisher(bzz: Bzz<any>, keyPair: any) {
  return createEntityFeedPublisher<Peer>({
    bzz,
    entityType: PEER_NAME,
    keyPair,
    name: PEER_NAME,
  })
}
