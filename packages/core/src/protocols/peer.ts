import Bzz, { PollContentOptions } from '@erebos/api-bzz-base'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Peer } from '../schemas/peer'
import { createFeedPublisher, createFeedSubscriber } from '../channels'
import { PEER_NAME } from '../namespace'

export function createPeerSubscriber(
  bzz: Bzz<any>,
  peerKeyOrAddress: string,
  options: PollContentOptions,
): Observable<Peer> {
  return createFeedSubscriber<Peer>({
    bzz,
    entityType: PEER_NAME,
    name: PEER_NAME,
    publisher: peerKeyOrAddress,
    options: {
      whenEmpty: 'ignore',
      ...options,
      mode: 'raw',
    },
  }).pipe(map((payload: any) => payload.data))
}

// TODO: keyPair type
export function createPeerPublisher(bzz: Bzz<any>, keyPair: any) {
  return createFeedPublisher<Peer>({
    bzz,
    entityType: PEER_NAME,
    keyPair,
    name: PEER_NAME,
  })
}
