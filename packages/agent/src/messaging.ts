import { MAILBOX_NAME, MESSAGE_NAME, MessageData } from '@aegle/core'
import { Sync } from '@aegle/sync'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { Chapter, Timeline } from '@erebos/timeline'
import { Subject, Subscription } from 'rxjs'

const POLL_INTERVAL = 60 * 1000 // 1 min

interface MailboxParams {
  sync: Sync
  keyPair: KeyPair
}

export interface MailboxReaderParams extends MailboxParams {
  writer: string
}

export function createMailboxReader(
  params: MailboxReaderParams,
): Timeline<MessageData> {
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

interface MailboxAgentParams {
  sync: Sync
  keyPair: KeyPair
  interval?: number
}

export interface InboxAgentParams extends MailboxAgentParams {
  publicKey: string
  messages?: Array<MessageData>
}

export class InboxAgent {
  protected subscription: Subscription

  public messages: Array<MessageData>
  public newMessage$: Subject<MessageData>

  public constructor(params: InboxAgentParams) {
    this.messages = params.messages || []
    this.newMessage$ = new Subject()

    this.subscription = createMailboxReader({
      sync: params.sync,
      keyPair: params.keyPair,
      writer: params.publicKey,
    })
      .live({ interval: params.interval || POLL_INTERVAL })
      .subscribe({
        next: (chapters: Array<Chapter<MessageData>>) => {
          const messages = chapters.map(c => c.content)
          this.messages = this.messages.concat(messages)
          messages.forEach(m => {
            this.newMessage$.next(m)
          })
        },
      })
  }
}

export interface InboxAgentData {
  publicKey: string
  messages?: Array<MessageData>
}

export interface InboxesAgentParams extends MailboxAgentParams {
  inboxes?: Record<string, InboxAgentData>
}

export interface InboxNewMessageData {
  inbox: string
  message: MessageData
}

export class InboxesAgent {
  protected sync: Sync
  protected keyPair: KeyPair
  protected interval: number | undefined
  protected inboxSubscriptions: Record<string, Subscription> = {}

  public inboxes: Record<string, InboxAgent> = {}
  public newMessage$: Subject<InboxNewMessageData>

  public constructor(params: InboxesAgentParams) {
    this.sync = params.sync
    this.keyPair = params.keyPair
    this.interval = params.interval
    this.newMessage$ = new Subject()

    if (params.inboxes != null) {
      for (const [label, data] of Object.entries(params.inboxes)) {
        this.addInbox(label, data)
      }
    }
  }

  public hasInbox(label: string): boolean {
    return this.inboxes[label] != null
  }

  public getInbox(label: string): InboxAgent | null {
    return this.inboxes[label] || null
  }

  public setInbox(label: string, inbox: InboxAgent): void {
    this.inboxes[label] = inbox
    this.inboxSubscriptions[label] = inbox.newMessage$.subscribe({
      next: message => {
        this.newMessage$.next({ inbox: label, message })
      },
    })
  }

  public addInbox(label: string, data: InboxAgentData): InboxAgent {
    const inbox = new InboxAgent({
      sync: this.sync,
      keyPair: this.keyPair,
      interval: this.interval,
      publicKey: data.publicKey,
      messages: data.messages,
    })
    this.setInbox(label, inbox)
    return inbox
  }

  public removeInbox(label: string): void {
    delete this.inboxes[label]

    const sub = this.inboxSubscriptions[label]
    if (sub != null) {
      sub.unsubscribe()
      delete this.inboxSubscriptions[label]
    }
  }
}

type SendMessage = (message: MessageData) => Promise<any>

export interface OutboxesAgentParams {
  sync: Sync
  publicKey: string
  outboxes?: Record<string, KeyPair>
}

export class OutboxesAgent {
  protected sync: Sync
  protected publicKey: string

  public outboxes: Record<string, SendMessage> = {}

  public constructor(params: OutboxesAgentParams) {
    this.sync = params.sync
    this.publicKey = params.publicKey

    if (params.outboxes != null) {
      for (const [label, keyPair] of Object.entries(params.outboxes)) {
        this.setOutbox(label, keyPair)
      }
    }
  }

  public hasOutbox(label: string): boolean {
    return this.outboxes[label] != null
  }

  public getOutbox(label: string): SendMessage | null {
    return this.outboxes[label] || null
  }

  public setOutbox(label: string, keyPair: KeyPair): void {
    this.outboxes[label] = createMailboxWriter({
      sync: this.sync,
      reader: this.publicKey,
      keyPair,
    })
  }

  public addOutbox(label: string): KeyPair {
    const keyPair = createKeyPair()
    this.setOutbox(label, keyPair)
    return keyPair
  }

  public removeOutbox(label: string): void {
    delete this.outboxes[label]
  }

  public async sendMessage(
    outbox: string,
    message: MessageData,
  ): Promise<void> {
    const send = this.getOutbox(outbox)
    if (send === null) {
      throw new Error('Invalid outbox label')
    }
    await send(message)
  }
}
