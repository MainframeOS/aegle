import { MAILBOX_NAME, MESSAGE_NAME, MessageData } from '@aegle/core'
import { AegleSync } from '@aegle/sync'
import { KeyPair } from '@erebos/secp256k1'

interface MailboxParams {
  sync: AegleSync
  keyPair: KeyPair
}

export interface MailboxReaderParams extends MailboxParams {
  writer: string
}

export function createMailboxReader(params: MailboxReaderParams) {
  return params.sync.createReadTimeline<MessageData>({
    keyPair: params.keyPair,
    writer: params.writer,
    entityType: MESSAGE_NAME,
    name: MAILBOX_NAME,
  })
}

export interface MailboxWriterParams extends MailboxParams {
  reader: string
}

export function createMailboxWriter(params: MailboxWriterParams) {
  return params.sync.createTimelinePublisher<MessageData>({
    keyPair: params.keyPair,
    reader: params.reader,
    entityType: MESSAGE_NAME,
    name: MAILBOX_NAME,
  })
}
