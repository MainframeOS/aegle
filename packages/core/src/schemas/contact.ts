import { CONTACT_NAME, getID } from '../namespace'

import { Mailboxes, mailboxesProperty } from './messaging'
import { Profile, profileProperty } from './profile'
import { publicKeyProperty } from './scalars'

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
