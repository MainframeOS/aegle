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
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs'
import { map } from 'rxjs/operators'

import { FileSystemReader, FileSystemWriter } from './fileSystem'
import { InboxesAgent, InboxAgentData, OutboxesAgent } from './messaging'
import { SyncParams } from './types'

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

export interface FirstContactAgentData {
  keyPair: KeyPair
  actorKey: string
}

export interface ReadContactAgentData {
  actorAddress: string
  actorData?: ActorData
  contactPublicKey?: string // If knows, means first contact has been established
  contactData?: ContactData
  firstContact?: FirstContactAgentData
}

export interface WriteContactAgentData {
  keyPair: KeyPair
  fileSystemKeyPair?: KeyPair
  firstContact?: FirstContactAgentData
  mailboxes?: Record<string, KeyPair>
  profile?: ProfileData
}

export interface ContactAgentData {
  read: ReadContactAgentData
  write: WriteContactAgentData
}

export interface ContactAgentError {
  type: 'firstContact' | 'contact'
  error: Error
}

export interface ContactAgentParams extends SyncParams {
  sync: Sync
  data: ContactAgentData
}

export class ContactAgent {
  private autoStart: boolean
  private firstContactSub: Subscription | null = null
  private contactSub: Subscription | null = null
  private inFS: FileSystemReader | null

  protected data: ContactAgentData
  protected interval: number
  protected sync: Sync

  public connected$: BehaviorSubject<boolean>
  public data$: BehaviorSubject<ContactData | null>
  public error$: Subject<ContactAgentError>
  public inboxes: InboxesAgent
  public outboxes: OutboxesAgent | null = null
  public outboundFileSystem: FileSystemWriter | null = null

  public constructor(params: ContactAgentParams) {
    this.autoStart = params.autoStart || false
    this.data = params.data
    this.interval = params.interval || POLL_INTERVAL
    this.sync = params.sync

    const { read, write } = this.data

    this.inFS = this.createInboundFileSystem()
    this.connected$ = new BehaviorSubject(read.contactPublicKey != null)
    this.data$ = new BehaviorSubject(read.contactData || null)
    this.error$ = new Subject()

    const inboxes: Record<string, InboxAgentData> = {}
    if (read.contactData != null && read.contactData.mailboxes != null) {
      for (const [label, writer] of Object.entries(
        read.contactData.mailboxes,
      )) {
        inboxes[label] = { writer }
      }
    }
    this.inboxes = new InboxesAgent({
      sync: this.sync,
      keyPair: write.keyPair,
      inboxes,
      interval: params.interval,
      autoStart: this.autoStart,
    })

    if (read.contactPublicKey != null) {
      this.outboxes = new OutboxesAgent({
        sync: this.sync,
        reader: read.contactPublicKey,
        outboxes: write.mailboxes,
      })

      if (write.fileSystemKeyPair != null) {
        this.outboundFileSystem = new FileSystemWriter({
          sync: this.sync,
          keyPair: write.fileSystemKeyPair,
          reader: read.contactPublicKey,
          autoStart: this.autoStart,
        })
      }
    }

    if (this.autoStart) {
      this.startAll()
    }
  }

  private async pushContactData(): Promise<boolean> {
    const { contactPublicKey } = this.data.read
    if (contactPublicKey == null) {
      return false
    }

    const { keyPair, fileSystemKeyPair, mailboxes, profile } = this.data.write
    await writeContact(
      {
        sync: this.sync,
        keyPair,
        contactKey: contactPublicKey,
      },
      {
        fileSystemKey: fileSystemKeyPair
          ? fileSystemKeyPair.getPublic('hex')
          : undefined,
        mailboxes: mailboxes
          ? Object.entries(mailboxes).reduce(
              (acc, [label, keyPair]) => {
                acc[label] = keyPair.getPublic('hex')
                return acc
              },
              {} as Record<string, string>,
            )
          : undefined,
        profile,
      },
    )
    return true
  }

  public async initialize(): Promise<void> {
    const { write } = this.data
    const calls: Array<Promise<any>> = []

    // Write first contact information if provided
    if (write.firstContact != null) {
      calls.push(
        writeFirstContact(
          { ...write.firstContact, sync: this.sync },
          {
            contactPublicKey: write.keyPair.getPublic('hex'),
            actorAddress: getPublicAddress(write.firstContact.keyPair),
          },
        ),
      )
    }

    if (this.outboundFileSystem != null) {
      calls.push(this.outboundFileSystem.initialize())
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
        this.data.read.contactPublicKey = data.contactPublicKey
        this.createContactSubscription(data.contactPublicKey)
        if (this.firstContactSub != null) {
          this.firstContactSub.unsubscribe()
          this.firstContactSub = null
        }
        this.connected$.next(true)
      },
      error: err => {
        this.error$.next({ type: 'firstContact', error: err })
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
      keyPair: this.data.write.keyPair,
      contactKey,
    }).subscribe({
      next: (data: ContactData) => {
        this.inboxes.changeInboxes(data.mailboxes || {})
        this.data.read.contactData = data
        this.data$.next(data)
      },
      error: err => {
        this.error$.next({ type: 'contact', error: err })
      },
    })
  }

  public start(): void {
    if (this.connected$.value) {
      this.createContactSubscription(this.data.read.contactPublicKey as string)
    } else if (this.data.read.firstContact != null) {
      this.createFirstContactSubscription(this.data.read.firstContact)
    }
  }

  public startAll(): void {
    this.start()
    this.inboxes.startAll()
  }

  public stop(): void {
    if (this.contactSub != null) {
      this.contactSub.unsubscribe()
      this.contactSub = null
    }
    if (this.firstContactSub != null) {
      this.firstContactSub.unsubscribe()
      this.firstContactSub = null
    }
  }

  public stopAll(): void {
    this.stop()
    this.inboxes.stopAll()
    if (this.inFS != null) {
      this.inFS.stop()
    }
    if (this.outboundFileSystem != null) {
      this.outboundFileSystem.stop()
    }
  }

  protected createInboundFileSystem(): FileSystemReader | null {
    const { read, write } = this.data
    return read.contactData != null && read.contactData.fileSystemKey != null
      ? new FileSystemReader({
          sync: this.sync,
          writer: read.contactData.fileSystemKey,
          keyPair: write.keyPair,
          autoStart: this.autoStart,
          interval: this.interval,
        })
      : null
  }

  public get inboundFileSystem(): FileSystemReader | null {
    if (this.inFS == null) {
      this.inFS = this.createInboundFileSystem()
    }
    return this.inFS
  }

  public async createOutboundFileSystem(): Promise<boolean> {
    const { read, write } = this.data
    if (write.fileSystemKeyPair != null) {
      return true
    }
    if (read.contactPublicKey == null) {
      return false
    }
    this.data.write.fileSystemKeyPair = createKeyPair()
    this.outboundFileSystem = new FileSystemWriter({
      sync: this.sync,
      keyPair: this.data.write.fileSystemKeyPair,
      reader: read.contactPublicKey,
      autoStart: this.autoStart,
    })
    return await this.pushContactData()
  }

  public async createOutboxes(): Promise<boolean> {
    if (this.outboxes != null) {
      return true
    }
    if (this.data.read.contactPublicKey == null) {
      return false
    }
    this.outboxes = new OutboxesAgent({
      sync: this.sync,
      reader: this.data.read.contactPublicKey,
      outboxes: this.data.write.mailboxes,
    })
    return await this.pushContactData()
  }

  public async addOutbox(label: string): Promise<boolean> {
    if (this.data.write.mailboxes == null) {
      this.data.write.mailboxes = {}
    }
    this.data.write.mailboxes[label] = createKeyPair()

    if (this.outboxes == null) {
      return await this.createOutboxes()
    } else {
      this.outboxes.setOutbox(label, this.data.write.mailboxes[label])
      return await this.pushContactData()
    }
  }

  public async setProfile(profile: ProfileData): Promise<boolean> {
    this.data.write.profile = profile
    return await this.pushContactData()
  }
}
