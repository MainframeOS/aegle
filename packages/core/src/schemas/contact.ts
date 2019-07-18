import { CONTACT_NAME, FIRST_CONTACT_NAME, getID } from '../namespace'

import { MailboxesRecord, mailboxesProperty } from './messaging'
import { ProfileData, profileProperty } from './profile'
import { ethereumAddressProperty, publicKeyProperty } from './scalars'

export interface ContactData {
  fileSystemKey?: string
  mailboxes?: MailboxesRecord
  profile?: ProfileData
}

export const contactSchema = {
  $async: true,
  $id: getID(CONTACT_NAME),
  type: 'object',
  properties: {
    fileSystemKey: publicKeyProperty,
    mailboxes: mailboxesProperty,
    profile: profileProperty,
  },
  additionalProperties: false,
}

export interface FirstContactData {
  actorAddress: string
  contactPublicKey: string
}

export const firstContactSchema = {
  $async: true,
  $id: getID(FIRST_CONTACT_NAME),
  type: 'object',
  required: ['actorAddress', 'contactPublicKey'],
  properties: {
    actorAddress: ethereumAddressProperty,
    contactPublicKey: publicKeyProperty,
  },
  additionalProperties: false,
}
