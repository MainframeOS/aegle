import Bzz, { PollContentOptions } from '@erebos/api-bzz-base'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { PeerContact } from '../schemas/peerContact'
import {
  createFeedSubscriber,
  readFeedEntity,
  writeFeedEntity,
} from '../channels'
import { PEER_CONTACT_NAME } from '../namespace'

export interface PeerContactParams {
  bzz: Bzz<any>
  keyPair: any // TODO: keyPair type
  peerKey: string
}

export async function readPeerContact(
  params: PeerContactParams,
): Promise<PeerContact | null> {
  return await readFeedEntity<PeerContact>({
    bzz: params.bzz,
    entityType: PEER_CONTACT_NAME,
    keyPair: params.keyPair,
    name: PEER_CONTACT_NAME,
    writer: params.peerKey,
  })
}

export async function writePeerContact(
  params: PeerContactParams,
  data: PeerContact,
): Promise<string> {
  return await writeFeedEntity<PeerContact>(
    {
      bzz: params.bzz,
      entityType: PEER_CONTACT_NAME,
      keyPair: params.keyPair,
      name: PEER_CONTACT_NAME,
      reader: params.peerKey,
    },
    data,
  )
}

export interface PeerContactSubscriberParams extends PeerContactParams {
  options: PollContentOptions
}

export function createPeerContactSubscriber(
  params: PeerContactSubscriberParams,
): Observable<PeerContact> {
  return createFeedSubscriber<PeerContact>({
    bzz: params.bzz,
    entityType: PEER_CONTACT_NAME,
    keyPair: params.keyPair,
    name: PEER_CONTACT_NAME,
    options: {
      whenEmpty: 'ignore',
      ...params.options,
      mode: 'raw',
    },
    writer: params.peerKey,
  }).pipe(map((payload: any) => payload.data))
}
