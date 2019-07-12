import { CONTACT_NAME, FIRST_CONTACT_NAME, getID } from '../namespace'

import { Mailboxes, mailboxesProperty } from './messaging'
import { Profile, profileProperty } from './profile'
import { ethereumAddressProperty, publicKeyProperty } from './scalars'

export interface Contact {
  fileSystemKey?: string
  mailboxes?: Mailboxes
  profile?: Profile
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

export interface FirstContact {
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
