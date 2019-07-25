import {
  CONTACT_NAME,
  FIRST_CONTACT_NAME,
  ActorData,
  ContactData,
  FirstContactData,
  ProfileData,
} from '@aegle/core'
import { Sync, getPublicAddress } from '@aegle/sync'
import { hexValue } from '@erebos/hex'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import { map } from 'rxjs/operators'

import { FileSystemReader, FileSystemWriter } from './fileSystem'
import { InboxesAgent, InboxAgentData, OutboxesAgent } from './messaging'

const CONTACT_FEED_PARAMS = { entityType: CONTACT_NAME, name: CONTACT_NAME }

const FIRST_CONTACT_FEED_PARAMS = {
  entityType: FIRST_CONTACT_NAME,
  name: FIRST_CONTACT_NAME,
}

const POLL_INTERVAL = 10 * 1000 // 10 secs

export interface ContactParams {
  sync: Sync
  keyPair: KeyPair
  contactKey: string
}

export async function readContact(
  params: ContactParams,
): Promise<ContactData | null> {
  return await params.sync.readFeed<ContactData>({
    ...CONTACT_FEED_PARAMS,
    keyPair: params.keyPair,
    writer: params.contactKey,
  })
}

export async function writeContact(
  params: ContactParams,
  data: ContactData,
): Promise<hexValue> {
  return await params.sync.writeFeed<ContactData>(
    {
      ...CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      reader: params.contactKey,
    },
    data,
  )
}

export interface ContactSubscriberParams extends ContactParams {
  interval: number
}

export function createContactSubscriber(
  params: ContactSubscriberParams,
): Observable<ContactData> {
  return params.sync
    .createFeedSubscriber<ContactData>({
      ...CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      options: { interval: params.interval },
      writer: params.contactKey,
    })
    .pipe(map((payload: any) => payload.data))
}

export interface FirstContactParams {
  actorKey: string
  keyPair: KeyPair
  sync: Sync
}

export async function readFirstContact(
  params: FirstContactParams,
): Promise<FirstContactData | null> {
  return await params.sync.readFeed<FirstContactData>({
    ...FIRST_CONTACT_FEED_PARAMS,
    keyPair: params.keyPair,
    writer: params.actorKey,
  })
}

export async function writeFirstContact(
  params: FirstContactParams,
  data: FirstContactData,
): Promise<string> {
  return await params.sync.writeFeed<FirstContactData>(
    {
      ...FIRST_CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      reader: params.actorKey,
    },
    data,
  )
}

export interface FirstContactSubscriberParams extends FirstContactParams {
  interval: number
}

export function createFirstContactSubscriber(
  params: FirstContactSubscriberParams,
): Observable<FirstContactData> {
  return params.sync
    .createFeedSubscriber<FirstContactData>({
      ...FIRST_CONTACT_FEED_PARAMS,
      keyPair: params.keyPair,
      options: { interval: params.interval },
      writer: params.actorKey,
    })
    .pipe(map((payload: any) => payload.data))
}

export interface ActorAgentData {
  keyPair: KeyPair
  profile?: ProfileData
}

export interface ReadContactAgentData {
  actorAddress: string
  actorData?: ActorData
  contactPublicKey?: string // If knows, means first contact has been established
  contactData?: ContactData
}

export interface WriteContactAgentData {
  keyPair: KeyPair
  firstContactWritten: boolean
  fileSystemKeyPair?: KeyPair
  mailboxes?: Record<string, KeyPair>
  profile?: ProfileData
}

export interface ContactAgentData {
  read: ReadContactAgentData
  write: WriteContactAgentData
}

export interface FirstContactAgentData {
  keyPair: KeyPair
  actorKey: string
}

export interface ContactAgentParams {
  sync: Sync
  data: ContactAgentData
  firstContact?: FirstContactAgentData
  interval?: number
}

export class ContactAgent {
  private firstContactSub: Subscription | null = null
  private contactSub: Subscription | null = null
  private inFS: FileSystemReader | null
  private outFS: FileSystemWriter | void
  private outboxesAgent: OutboxesAgent | null

  protected firstContact: FirstContactAgentData | void
  protected interval: number
  protected sync: Sync
  protected read: ReadContactAgentData
  protected write: WriteContactAgentData

  public connected$: BehaviorSubject<boolean>
  public data$: BehaviorSubject<ContactData | null>
  public inboxes: InboxesAgent

  public constructor(params: ContactAgentParams) {
    this.interval = params.interval || POLL_INTERVAL
    this.firstContact = params.firstContact
    this.sync = params.sync
    this.read = params.data.read
    this.write = params.data.write

    this.inFS = this.createInboundFileSystem()
    if (this.write.fileSystemKeyPair != null) {
      this.outFS = this.createOutboundFileSystem(this.write.fileSystemKeyPair)
    }

    this.connected$ = new BehaviorSubject(this.read.contactPublicKey != null)
    if (this.connected$.value) {
      this.createContactSubscription(this.read.contactPublicKey as string)
    } else if (this.firstContact != null) {
      this.createFirstContactSubscription(this.firstContact)
    }

    this.data$ = new BehaviorSubject(params.data.read.contactData || null)

    const inboxes: Record<string, InboxAgentData> = {}
    if (
      this.read.contactData != null &&
      this.read.contactData.mailboxes != null
    ) {
      for (const [label, publicKey] of Object.entries(
        this.read.contactData.mailboxes,
      )) {
        inboxes[label] = { publicKey }
      }
    }
    this.inboxes = new InboxesAgent({
      sync: this.sync,
      keyPair: this.write.keyPair,
      inboxes,
    })

    this.outboxesAgent = this.createOutboxes()
  }

  public async initialize() {
    const calls: Array<Promise<any>> = []

    // Write first contact information if provided
    if (this.firstContact != null) {
      calls.push(
        writeFirstContact(
          { ...this.firstContact, sync: this.sync },
          {
            contactPublicKey: this.write.keyPair.getPublic('hex'),
            actorAddress: getPublicAddress(this.firstContact.keyPair),
          },
        ),
      )
    }

    if (this.outFS != null) {
      calls.push(this.outFS.initialize())
    }

    await Promise.all(calls)
  }

  public createFirstContactSubscription(
    firstContact: FirstContactAgentData,
  ): void {
    if (this.firstContactSub != null) {
      this.firstContactSub.unsubscribe()
    }
    this.firstContactSub = createFirstContactSubscriber({
      sync: this.sync,
      interval: this.interval,
      keyPair: firstContact.keyPair,
      actorKey: firstContact.actorKey,
    }).subscribe({
      next: (data: FirstContactData) => {
        this.read.contactPublicKey = data.contactPublicKey
        this.createContactSubscription(data.contactPublicKey)
        if (this.firstContactSub != null) {
          this.firstContactSub.unsubscribe()
          this.firstContactSub = null
        }
        this.connected$.next(true)
      },
    })
  }

  public createContactSubscription(contactKey: string): void {
    if (this.contactSub != null) {
      this.contactSub.unsubscribe()
    }
    this.contactSub = createContactSubscriber({
      sync: this.sync,
      interval: this.interval,
      keyPair: this.write.keyPair,
      contactKey,
    }).subscribe({
      next: (data: ContactData) => {
        this.read.contactData = data
        this.data$.next(data)
      },
    })
  }

  protected createInboundFileSystem(): FileSystemReader | null {
    return this.read.contactData != null &&
      this.read.contactData.fileSystemKey != null
      ? new FileSystemReader({
          sync: this.sync,
          writer: this.read.contactData.fileSystemKey,
          keyPair: this.write.keyPair,
        })
      : null
  }

  protected createOutboundFileSystem(keyPair: KeyPair): FileSystemWriter {
    return new FileSystemWriter({ keyPair, sync: this.sync })
  }

  public get inboundFileSystem(): FileSystemReader | null {
    if (this.inFS == null) {
      this.inFS = this.createInboundFileSystem()
    }
    return this.inFS
  }

  public get outboundFileSystem(): FileSystemWriter {
    if (this.outFS == null) {
      this.write.fileSystemKeyPair = createKeyPair()
      this.outFS = this.createOutboundFileSystem(this.write.fileSystemKeyPair)
    }
    return this.outFS
  }

  protected createOutboxes(): OutboxesAgent | null {
    if (this.read.contactPublicKey != null) {
      return new OutboxesAgent({
        sync: this.sync,
        publicKey: this.read.contactPublicKey,
        outboxes: this.write.mailboxes,
      })
    }
    return null
  }

  public get outboxes(): OutboxesAgent | null {
    if (this.outboxesAgent == null) {
      this.outboxesAgent = this.createOutboxes()
    }
    return this.outboxesAgent
  }
}
