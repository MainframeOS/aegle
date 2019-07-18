import {
  CONTACT_NAME,
  FIRST_CONTACT_NAME,
  ContactData,
  FirstContactData,
} from '@aegle/core'
import { AegleSync } from '@aegle/sync'
import { hexValue } from '@erebos/hex'
import { KeyPair } from '@erebos/secp256k1'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

const CONTACT_FEED_PARAMS = { entityType: CONTACT_NAME, name: CONTACT_NAME }
const FIRST_CONTACT_FEED_PARAMS = {
  entityType: FIRST_CONTACT_NAME,
  name: FIRST_CONTACT_NAME,
}

export interface ContactParams {
  sync: AegleSync
  keyPair: KeyPair
  contactKey: string
}

export async function readContact(
  params: ContactParams,
): Promise<ContactData | null> {
  return await params.sync.readFeed<ContactData>({
    ...CONTACT_FEED_PARAMS,
    keyPair: params.keyPair,
    writer: params.contactKey,
  })
}

export async function writeContact(
  params: ContactParams,
  data: ContactData,
): Promise<hexValue> {
  return await params.sync.writeFeed<ContactData>(
    {
      ...CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      reader: params.contactKey,
    },
    data,
  )
}

export interface ContactSubscriberParams extends ContactParams {
  interval: number
}

export function createContactSubscriber(
  params: ContactSubscriberParams,
): Observable<ContactData> {
  return params.sync
    .createFeedSubscriber<ContactData>({
      ...CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      options: { interval: params.interval },
      writer: params.contactKey,
    })
    .pipe(map((payload: any) => payload.data))
}

export interface FirstContactParams {
  actorKey: string
  keyPair: KeyPair
  sync: AegleSync
}

export async function readFirstContact(
  params: FirstContactParams,
): Promise<FirstContactData | null> {
  return await params.sync.readFeed<FirstContactData>({
    ...FIRST_CONTACT_FEED_PARAMS,
    keyPair: params.keyPair,
    writer: params.actorKey,
  })
}

export async function writeFirstContact(
  params: FirstContactParams,
  data: FirstContactData,
): Promise<string> {
  return await params.sync.writeFeed<FirstContactData>(
    {
      ...FIRST_CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      reader: params.actorKey,
    },
    data,
  )
}

export interface FirstContactSubscriberParams extends FirstContactParams {
  interval: number
}

export function createFirstContactSubscriber(
  params: FirstContactSubscriberParams,
): Observable<FirstContactData> {
  return params.sync
    .createFeedSubscriber<FirstContactData>({
      ...FIRST_CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      options: { interval: params.interval },
      writer: params.actorKey,
    })
    .pipe(map((payload: any) => payload.data))
}
