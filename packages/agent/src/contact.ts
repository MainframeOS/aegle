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

  protected data: ContactAgentData
  protected firstContact: FirstContactAgentData | void
  protected interval: number
  protected sync: Sync

  public connected$: BehaviorSubject<boolean>
  public data$: BehaviorSubject<ContactData | null>
  public inboxes: InboxesAgent
  public outboxes: OutboxesAgent | null = null
  public outboundFileSystem: FileSystemWriter | null = null

  public constructor(params: ContactAgentParams) {
    this.data = params.data
    this.firstContact = params.firstContact
    this.interval = params.interval || POLL_INTERVAL
    this.sync = params.sync

    const { read, write } = this.data

    this.inFS = this.createInboundFileSystem()
    if (write.fileSystemKeyPair != null) {
      this.outboundFileSystem = new FileSystemWriter({
        keyPair: write.fileSystemKeyPair,
        sync: this.sync,
      })
    }

    this.connected$ = new BehaviorSubject(read.contactPublicKey != null)
    if (this.connected$.value) {
      this.createContactSubscription(read.contactPublicKey as string)
    } else if (this.firstContact != null) {
      this.createFirstContactSubscription(this.firstContact)
    }

    this.data$ = new BehaviorSubject(read.contactData || null)

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
    })

    if (read.contactPublicKey != null) {
      this.outboxes = new OutboxesAgent({
        sync: this.sync,
        reader: read.contactPublicKey,
        outboxes: write.mailboxes,
      })
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

  public async initialize() {
    const calls: Array<Promise<any>> = []

    // Write first contact information if provided
    if (this.firstContact != null) {
      calls.push(
        writeFirstContact(
          { ...this.firstContact, sync: this.sync },
          {
            contactPublicKey: this.data.write.keyPair.getPublic('hex'),
            actorAddress: getPublicAddress(this.firstContact.keyPair),
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
        this.data.read.contactData = data
        this.data$.next(data)
      },
    })
  }

  protected createInboundFileSystem(): FileSystemReader | null {
    const { read, write } = this.data
    return read.contactData != null && read.contactData.fileSystemKey != null
      ? new FileSystemReader({
          sync: this.sync,
          writer: read.contactData.fileSystemKey,
          keyPair: write.keyPair,
        })
      : null
  }

  public get inboundFileSystem(): FileSystemReader | null {
    if (this.inFS == null) {
      this.inFS = this.createInboundFileSystem()
    }
    return this.inFS
  }

  public async createOutboundFileSystem(): Promise<KeyPair> {
    if (this.data.write.fileSystemKeyPair == null) {
      this.data.write.fileSystemKeyPair = createKeyPair()
      this.outboundFileSystem = new FileSystemWriter({
        keyPair: this.data.write.fileSystemKeyPair,
        sync: this.sync,
      })
      await this.pushContactData()
    }
    return this.data.write.fileSystemKeyPair
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

  public async setProfile(profile: ProfileData): Promise<void> {
    this.data.write.profile = profile
    await this.pushContactData()
  }
}
