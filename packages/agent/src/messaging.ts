import {
  MAILBOX_NAME,
  MESSAGE_NAME,
  EntityPayload,
  MailboxesRecord,
  MessageData,
} from '@aegle/core'
import { Sync } from '@aegle/sync'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { Chapter, TimelineReader } from '@erebos/timeline'
import { BehaviorSubject, Subject, Subscription } from 'rxjs'

import { SyncParams } from './types'

const POLL_INTERVAL = 60 * 1000 // 1 min

export interface MailboxParams {
  sync: Sync
  keyPair: KeyPair
}

export interface MailboxReaderParams extends MailboxParams {
  writer: string
}

export function createMailboxReader(
  params: MailboxReaderParams,
): TimelineReader<EntityPayload<MessageData>> {
  return params.sync.createTimelineReader<MessageData>({
    keyPair: params.keyPair,
    writer: params.writer,
    entityType: MESSAGE_NAME,
    name: MAILBOX_NAME,
  })
}

export interface MailboxWriterParams extends MailboxParams {
  reader: string
}

export function createMailboxWriter(
  params: MailboxWriterParams,
): (data: MessageData) => Promise<Chapter<EntityPayload<MessageData>>> {
  return params.sync.createTimelinePublisher<MessageData>({
    keyPair: params.keyPair,
    reader: params.reader,
    entityType: MESSAGE_NAME,
    name: MAILBOX_NAME,
  })
}

export interface MailboxAgentParams extends SyncParams {
  sync: Sync
  keyPair: KeyPair
}

export enum InboxState {
  STOPPED,
  STARTED,
  ERROR,
}

export interface InboxAgentData {
  writer: string
  messages?: Array<MessageData>
}

export interface InboxAgentParams extends MailboxAgentParams, InboxAgentData {}

export class InboxAgent {
  protected params: InboxAgentParams
  protected subscription: Subscription | null = null

  public readonly newMessage$: Subject<MessageData>
  public readonly state$: BehaviorSubject<InboxState>

  public error: Error | undefined
  public messages: Array<MessageData>

  public constructor(params: InboxAgentParams) {
    this.params = params
    this.messages = params.messages || []
    this.newMessage$ = new Subject()
    this.state$ = new BehaviorSubject(InboxState.STOPPED as InboxState)

    if (params.autoStart) {
      this.start()
    }
  }

  public start(): void {
    if (this.subscription !== null) {
      this.subscription.unsubscribe()
    }

    this.subscription = createMailboxReader({
      sync: this.params.sync,
      keyPair: this.params.keyPair,
      writer: this.params.writer,
    })
      .live({ interval: this.params.interval || POLL_INTERVAL })
      .subscribe({
        next: (chapters: Array<Chapter<EntityPayload<MessageData>>>) => {
          const messages = chapters.map(c => c.content.data)
          this.messages = this.messages.concat(messages)
          messages.forEach(m => {
            this.newMessage$.next(m)
          })
        },
        error: err => {
          this.error = err
          this.state$.next(InboxState.ERROR)
        },
      })
    this.state$.next(InboxState.STARTED)
  }

  public stop(): void {
    if (this.subscription !== null) {
      this.subscription.unsubscribe()
      this.subscription = null
      this.state$.next(InboxState.STOPPED)
    }
  }

  public isWriter(key: string): boolean {
    return this.params.writer === key
  }

  public setWriter(key: string): boolean {
    if (this.params.writer === key) {
      return false
    }

    this.params.writer = key
    if (this.subscription !== null) {
      this.start()
    }
    return true
  }
}

export interface InboxesAgentInboxParams extends SyncParams {
  writer: string
  messages?: Array<MessageData>
}

export interface InboxesAgentParams extends MailboxAgentParams {
  inboxes?: Record<string, InboxesAgentInboxParams>
}

export interface InboxNewMessageData {
  inbox: string
  message: MessageData
}

export class InboxesAgent {
  protected autoStart: boolean
  protected sync: Sync
  protected keyPair: KeyPair
  protected interval: number | undefined
  protected inboxSubscriptions: Record<string, Subscription> = {}

  public readonly inboxes: Record<string, InboxAgent> = {}
  public readonly newMessage$: Subject<InboxNewMessageData>

  public constructor(params: InboxesAgentParams) {
    this.autoStart = params.autoStart || false
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

  public startAll(): void {
    Object.values(this.inboxes).forEach(inbox => {
      inbox.start()
    })
  }

  public stopAll(): void {
    Object.values(this.inboxes).forEach(inbox => {
      inbox.stop()
    })
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

  public addInbox(label: string, params: InboxesAgentInboxParams): void {
    const inbox = new InboxAgent({
      sync: this.sync,
      keyPair: this.keyPair,
      writer: params.writer,
      messages: params.messages,
      autoStart: params.autoStart == null ? this.autoStart : params.autoStart,
      interval: params.interval || this.interval,
    })
    this.setInbox(label, inbox)
  }

  public removeInbox(label: string): void {
    delete this.inboxes[label]

    const sub = this.inboxSubscriptions[label]
    if (sub != null) {
      sub.unsubscribe()
      delete this.inboxSubscriptions[label]
    }
  }

  public changeInboxes(mailboxes: MailboxesRecord): void {
    const labels: Array<string> = []

    Object.entries(mailboxes).forEach(([label, key]) => {
      labels.push(label)
      const inbox = this.inboxes[label]
      if (inbox == null) {
        this.addInbox(label, { writer: key })
      } else if (!inbox.isWriter(key)) {
        inbox.setWriter(key)
      }
    })

    Object.keys(this.inboxes).forEach(label => {
      if (!labels.includes(label)) {
        this.removeInbox(label)
      }
    })
  }
}

type SendMessage = (
  message: MessageData,
) => Promise<Chapter<EntityPayload<MessageData>>>

export interface OutboxesAgentParams {
  sync: Sync
  reader: string
  outboxes?: Record<string, KeyPair>
}

export class OutboxesAgent {
  protected sync: Sync
  protected reader: string

  public readonly outboxes: Record<string, SendMessage> = {}

  public constructor(params: OutboxesAgentParams) {
    this.sync = params.sync
    this.reader = params.reader

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
      reader: this.reader,
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
  ): Promise<string> {
    const send = this.getOutbox(outbox)
    if (send === null) {
      throw new Error('Invalid outbox label')
    }
    const chapter = await send(message)
    return chapter.id
  }
}
