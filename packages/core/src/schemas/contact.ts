import { CONTACT_NAME, getID } from '../namespace'

import { FileSystem, fileSystemProperty } from './fileSystem'
import { Mailboxes, mailboxesProperty } from './messaging'
import { Profile, profileProperty } from './profile'

export interface Contact {
  files?: FileSystem
  mailboxes?: Mailboxes
  profile?: Profile
}

export const contactSchema = {
  $async: true,
  $id: getID(CONTACT_NAME),
  type: 'object',
  properties: {
    files: fileSystemProperty,
    mailboxes: mailboxesProperty,
    profile: profileProperty,
  },
  additionalProperties: false,
}
