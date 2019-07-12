import { Bzz, PollContentOptions } from '@erebos/api-bzz-node'
import { KeyPair } from '@erebos/secp256k1'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Contact, FirstContact } from '../schemas/contact'
import {
  createEntityFeedSubscriber,
  readFeedEntity,
  writeFeedEntity,
} from '../channels'
import { CONTACT_NAME, FIRST_CONTACT_NAME } from '../namespace'

export interface ContactParams {
  bzz: Bzz
  keyPair: KeyPair
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

export interface FirstContactParams {
  actorKey: string
  bzz: Bzz
  keyPair: KeyPair
}

export async function readFirstContact(
  params: FirstContactParams,
): Promise<FirstContact | null> {
  return await readFeedEntity<FirstContact>({
    bzz: params.bzz,
    entityType: FIRST_CONTACT_NAME,
    keyPair: params.keyPair,
    name: FIRST_CONTACT_NAME,
    writer: params.actorKey,
  })
}

export async function writeFirstContact(
  params: FirstContactParams,
  data: FirstContact,
): Promise<string> {
  return await writeFeedEntity<FirstContact>(
    {
      bzz: params.bzz,
      entityType: FIRST_CONTACT_NAME,
      keyPair: params.keyPair,
      name: FIRST_CONTACT_NAME,
      reader: params.actorKey,
    },
    data,
  )
}

export interface FirstContactSubscriberParams extends FirstContactParams {
  options: PollContentOptions
}

export function createFirstContactSubscriber(
  params: FirstContactSubscriberParams,
): Observable<FirstContact> {
  return createEntityFeedSubscriber<FirstContact>({
    bzz: params.bzz,
    entityType: FIRST_CONTACT_NAME,
    keyPair: params.keyPair,
    name: FIRST_CONTACT_NAME,
    options: {
      whenEmpty: 'ignore',
      ...params.options,
      mode: 'raw',
    },
    writer: params.actorKey,
  }).pipe(map((payload: any) => payload.data))
}

export const contact = {
  read: readContact,
  write: writeContact,
  createSubscriber: createContactSubscriber,
  readFirstContact,
  writeFirstContact,
  createFirstContactSubscriber,
}
