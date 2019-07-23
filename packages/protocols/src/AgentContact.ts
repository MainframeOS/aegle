import {
  ActorData,
  ContactData,
  FirstContactData,
  ProfileData,
} from '@aegle/core'
import { AegleSync, getPublicAddress } from '@aegle/sync'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { BehaviorSubject, Subscription } from 'rxjs'

import { AgentInboxes, AgentInboxData, AgentOutboxes } from './AgentMessaging'
import {
  createContactSubscriber,
  createFirstContactSubscriber,
  writeFirstContact,
} from './contact'
import { FileSystemReader, FileSystemWriter } from './fileSystem'

const POLL_INTERVAL = 10 * 1000 // 10 secs

export interface AgentActorData {
  keyPair: KeyPair
  profile?: ProfileData
}

export interface AgentReadContactData {
  actorAddress: string
  actorData?: ActorData
  contactPublicKey?: string // If knows, means first contact has been established
  contactData?: ContactData
}

export interface AgentWriteContactData {
  keyPair: KeyPair
  firstContactWritten: boolean
  fileSystemKeyPair?: KeyPair
  mailboxes?: Record<string, KeyPair>
  profile?: ProfileData
}

export interface AgentContactData {
  read: AgentReadContactData
  write: AgentWriteContactData
}

export interface AgentFirstContactData {
  keyPair: KeyPair
  actorKey: string
}

export interface AgentContactParams {
  sync: AegleSync
  data: AgentContactData
  firstContact?: AgentFirstContactData
  interval?: number
}

export class AgentContact {
  private firstContactSub: Subscription | null = null
  private contactSub: Subscription | null = null
  private inFS: FileSystemReader | null
  private outFS: FileSystemWriter | void
  private agentOutboxes: AgentOutboxes | null

  protected firstContact: AgentFirstContactData | void
  protected interval: number
  protected sync: AegleSync
  protected read: AgentReadContactData
  protected write: AgentWriteContactData

  public connected$: BehaviorSubject<boolean>
  public data$: BehaviorSubject<ContactData | null>
  public inboxes: AgentInboxes

  public constructor(params: AgentContactParams) {
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

    const inboxes: Record<string, AgentInboxData> = {}
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
    this.inboxes = new AgentInboxes({
      sync: this.sync,
      keyPair: this.write.keyPair,
      inboxes,
    })

    this.agentOutboxes = this.createOutboxes()
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
    firstContact: AgentFirstContactData,
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

  protected createOutboxes(): AgentOutboxes | null {
    if (this.read.contactPublicKey != null) {
      return new AgentOutboxes({
        sync: this.sync,
        publicKey: this.read.contactPublicKey,
        outboxes: this.write.mailboxes,
      })
    }
    return null
  }

  public get outboxes(): AgentOutboxes | null {
    if (this.agentOutboxes == null) {
      this.agentOutboxes = this.createOutboxes()
    }
    return this.agentOutboxes
  }
}
