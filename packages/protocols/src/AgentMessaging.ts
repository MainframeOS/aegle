import { MessageData } from '@aegle/core'
import { AegleSync } from '@aegle/sync'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { Subject, Subscription } from 'rxjs'

import { createMailboxReader, createMailboxWriter } from './messaging'

const POLL_INTERVAL = 60 * 1000 // 1 min

interface AgentMailboxParams {
  sync: AegleSync
  keyPair: KeyPair
  interval?: number
}

export interface AgentInboxParams extends AgentMailboxParams {
  publicKey: string
  messages?: Array<MessageData>
}

export class AgentInbox {
  protected subscription: Subscription

  public messages: Array<MessageData>
  public newMessage$: Subject<MessageData>

  public constructor(params: AgentInboxParams) {
    this.messages = params.messages || []
    this.newMessage$ = new Subject()

    this.subscription = createMailboxReader({
      sync: params.sync,
      keyPair: params.keyPair,
      writer: params.publicKey,
    })
      .live({ interval: params.interval || POLL_INTERVAL })
      .subscribe({
        next: chapters => {
          const messages = chapters.map(c => c.content)
          this.messages = this.messages.concat(messages)
          messages.forEach(m => {
            this.newMessage$.next(m)
          })
        },
      })
  }
}

export interface AgentInboxData {
  publicKey: string
  messages?: Array<MessageData>
}

export interface AgentInboxesParams extends AgentMailboxParams {
  inboxes?: Record<string, AgentInboxData>
}

export interface AgentInboxNewMessageData {
  inbox: string
  message: MessageData
}

export class AgentInboxes {
  protected sync: AegleSync
  protected keyPair: KeyPair
  protected interval: number | undefined
  protected inboxSubscriptions: Record<string, Subscription> = {}

  public inboxes: Record<string, AgentInbox> = {}
  public newMessage$: Subject<AgentInboxNewMessageData>

  public constructor(params: AgentInboxesParams) {
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

  public getInbox(label: string): AgentInbox | null {
    return this.inboxes[label] || null
  }

  public setInbox(label: string, inbox: AgentInbox): void {
    this.inboxes[label] = inbox
    this.inboxSubscriptions[label] = inbox.newMessage$.subscribe({
      next: message => {
        this.newMessage$.next({ inbox: label, message })
      },
    })
  }

  public addInbox(label: string, data: AgentInboxData): AgentInbox {
    const inbox = new AgentInbox({
      sync: this.sync,
      keyPair: this.keyPair,
      interval: this.interval,
      publicKey: data.publicKey,
      messages: data.messages,
    })
    this.setInbox(label, inbox)
    return inbox
  }

  public removeInbox(label: string): boolean {
    const inbox = this.getInbox(label)
    if (inbox == null) {
      return false
    }

    delete this.inboxes[label]

    const sub = this.inboxSubscriptions[label]
    if (sub != null) {
      sub.unsubscribe()
      delete this.inboxSubscriptions[label]
    }

    return true
  }
}

type SendMessage = (message: MessageData) => Promise<any>

export interface AgentOutboxesParams {
  sync: AegleSync
  publicKey: string
  outboxes?: Record<string, KeyPair>
}

export class AgentOutboxes {
  protected sync: AegleSync
  protected publicKey: string

  public outboxes: Record<string, SendMessage> = {}

  public constructor(params: AgentOutboxesParams) {
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

  public removeOutbox(label: string): boolean {
    if (!this.hasOutbox(label)) {
      return false
    }

    delete this.outboxes[label]
    return true
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
