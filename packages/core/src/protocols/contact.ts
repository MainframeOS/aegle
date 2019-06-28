import Bzz, { PollContentOptions } from '@erebos/api-bzz-base'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Contact, PeerContact } from '../schemas/contact'
import {
  createEntityFeedSubscriber,
  readFeedEntity,
  writeFeedEntity,
} from '../channels'
import { CONTACT_NAME, PEER_CONTACT_NAME } from '../namespace'

export interface ContactParams {
  bzz: Bzz<any>
  keyPair: any // TODO: keyPair type
  contactKey: string
}

export async function readContact(
  params: ContactParams,
): Promise<Contact | null> {
  return await readFeedEntity<Contact>({
    bzz: params.bzz,
    entityType: CONTACT_NAME,
    keyPair: params.keyPair,
    name: CONTACT_NAME,
    writer: params.contactKey,
  })
}

export async function writeContact(
  params: ContactParams,
  data: Contact,
): Promise<string> {
  return await writeFeedEntity<Contact>(
    {
      bzz: params.bzz,
      entityType: CONTACT_NAME,
      keyPair: params.keyPair,
      name: CONTACT_NAME,
      reader: params.contactKey,
    },
    data,
  )
}

export interface ContactSubscriberParams extends ContactParams {
  options: PollContentOptions
}

export function createContactSubscriber(
  params: ContactSubscriberParams,
): Observable<Contact> {
  return createEntityFeedSubscriber<Contact>({
    bzz: params.bzz,
    entityType: CONTACT_NAME,
    keyPair: params.keyPair,
    name: CONTACT_NAME,
    options: {
      whenEmpty: 'ignore',
      ...params.options,
      mode: 'raw',
    },
    writer: params.contactKey,
  }).pipe(map((payload: any) => payload.data))
}

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
  return createEntityFeedSubscriber<PeerContact>({
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
