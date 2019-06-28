import { CONTACT_NAME, PEER_CONTACT_NAME, getID } from '../namespace'

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

export interface PeerContact {
  contactPublicKey: string
  peerAddress: string
}

export const peerContactSchema = {
  $async: true,
  $id: getID(PEER_CONTACT_NAME),
  type: 'object',
  required: ['contactPublicKey', 'peerAddress'],
  properties: {
    contactPublicKey: publicKeyProperty,
    peerAddress: ethereumAddressProperty,
  },
  additionalProperties: false,
}
