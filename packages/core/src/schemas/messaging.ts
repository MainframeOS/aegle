import { File, fileProperty } from './fileSystem'
import { publicKeyProperty } from './publicKey'
import { SwarmFeed, swarmFeedProperty } from './swarmFeed'
import { swarmHashProperty } from './swarmHash'

export interface MessageAttachment {
  file: File
  name?: string
}

export const messageAttachmentProperty = {
  type: 'object',
  required: ['file'],
  properties: {
    file: fileProperty,
    name: { type: 'string', maxLength: 100 },
  },
}

export interface Message {
  body: string
  attachments?: Array<MessageAttachment>
  replyTo?: string
  thread?: string
  title?: string
}

export const messageSchema = {
  $async: true,
  type: 'object',
  required: ['body'],
  properties: {
    body: { type: 'string' },
    attachments: {
      type: 'array',
      items: messageAttachmentProperty,
    },
    replyTo: swarmHashProperty,
    thread: swarmHashProperty,
    title: { type: 'string', maxLength: 100 },
  },
}

export interface Mailbox {
  timeline: SwarmFeed
  publicKey?: string
}

export const mailboxProperty = {
  type: 'object',
  required: ['timeline'],
  properties: {
    timeline: swarmFeedProperty,
    publicKey: publicKeyProperty,
  },
  additionalProperties: false,
}

export type Mailboxes = Record<string, Mailbox>

export const mailboxesProperty = {
  type: 'object',
  patternProperties: {
    '^[0-9a-zA-Z-_. ]{1,50}$': swarmFeedProperty,
  },
  additionalProperties: false,
}
