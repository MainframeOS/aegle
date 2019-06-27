import Bzz, { PollContentOptions } from '@erebos/api-bzz-base'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Contact } from '../schemas/contact'
import {
  createEntityFeedSubscriber,
  readFeedEntity,
  writeFeedEntity,
} from '../channels'
import { CONTACT_NAME } from '../namespace'

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
