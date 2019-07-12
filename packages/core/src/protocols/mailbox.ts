import { Bzz } from '@erebos/api-bzz-node'
import { KeyPair } from '@erebos/secp256k1'

import {
  createEntityReadTimeline,
  createEntityTimelinePublisher,
} from '../channels'
import { MAILBOX_NAME, MESSAGE_NAME } from '../namespace'

interface MailboxCommonParams {
  bzz: Bzz
  keyPair: KeyPair
}

export interface MailboxReaderParams extends MailboxCommonParams {
  writer: string
}

export function createMailboxReader(params: MailboxReaderParams) {
  return createEntityReadTimeline({
    ...params,
    entityType: MESSAGE_NAME,
    name: MAILBOX_NAME,
  })
}

export interface MailboxWriterParams extends MailboxCommonParams {
  reader: string
}

export function createMailboxPublisher(params: MailboxWriterParams) {
  return createEntityTimelinePublisher({
    ...params,
    entityType: MESSAGE_NAME,
    name: MAILBOX_NAME,
  })
}

export const mailbox = {
  createReader: createMailboxReader,
  createPublisher: createMailboxPublisher,
}
