import { ACTOR_NAME, ActorData, ProfileData } from '@aegle/core'
import { Sync, getPublicAddress } from '@aegle/sync'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { ContactAgentData, ContactAgent } from './contact'
import { FileSystemWriter } from './fileSystem'
import { SyncParams } from './types'

const FEED_PARAMS = { entityType: ACTOR_NAME, name: ACTOR_NAME }

const POLL_INTERVAL = 10 * 1000 // 10 secs
export interface ActorReaderParams {
  actor: string
  sync: Sync
}

export async function readActor(
  config: ActorReaderParams,
): Promise<ActorData | null> {
  return await config.sync.readFeed({ ...FEED_PARAMS, writer: config.actor })
}

export interface ActorSubscriberParams extends ActorReaderParams {
  interval: number
}

export function createActorSubscriber(
  params: ActorSubscriberParams,
): Observable<ActorData> {
  return params.sync
    .createFeedSubscriber<ActorData>({
      ...FEED_PARAMS,
      writer: params.actor,
      options: { interval: params.interval },
    })
    .pipe(map((payload: any) => payload.data))
}

export interface ActorWriterParams {
  keyPair: KeyPair
  sync: Sync
}

export async function writeActor(
  params: ActorWriterParams,
  data: ActorData,
): Promise<string> {
  return await params.sync.writeFeed(
    { ...FEED_PARAMS, keyPair: params.keyPair },
    data,
  )
}

export function createActorWriter(
  params: ActorWriterParams,
): (data: ActorData) => Promise<string> {
  return params.sync.createFeedPublisher<ActorData>({
    ...FEED_PARAMS,
    keyPair: params.keyPair,
  })
}

export interface ActorAgentActorData {
  keyPair: KeyPair
  profile?: ProfileData
}

export interface ActorAgentData {
  actor: ActorAgentActorData
  contacts?: Record<string, ContactAgentData>
  fileSystemKeyPair?: KeyPair
}

export interface ActorAgentParams extends SyncParams {
  sync: Sync
  data: ActorAgentData
}

export class ActorAgent {
  protected autoStart: boolean
  protected data: ActorAgentData
  protected interval: number

  public readonly address: string
  public readonly contacts: Record<string, ContactAgent> = {}
  public readonly fileSystem: FileSystemWriter
  public readonly sync: Sync
  public readonly writeActor: (data: ActorData) => Promise<string>

  public constructor(params: ActorAgentParams) {
    this.autoStart = params.autoStart || false
    this.data = params.data
    this.interval = params.interval || POLL_INTERVAL
    this.sync = params.sync

    this.address = getPublicAddress(params.data.actor.keyPair)
    this.writeActor = createActorWriter({
      keyPair: this.data.actor.keyPair,
      sync: this.sync,
    })

    if (this.data.contacts != null) {
      for (const [address, data] of Object.entries(this.data.contacts)) {
        this.contacts[address] = new ContactAgent({ sync: this.sync, data })
      }
    }

    let fsKeyPair
    if (this.data.fileSystemKeyPair == null) {
      fsKeyPair = createKeyPair()
      this.data.fileSystemKeyPair = fsKeyPair
    } else {
      fsKeyPair = this.data.fileSystemKeyPair
    }
    this.fileSystem = new FileSystemWriter({
      autoStart: this.autoStart,
      interval: this.interval,
      keyPair: fsKeyPair,
      sync: this.sync,
      reader: this.data.actor.keyPair.getPublic('hex'),
    })

    // TODO: call startAll() here if autoStart is true?
  }

  public startAll(): void {
    Object.values(this.contacts).forEach(contact => {
      contact.startAll()
    })
    this.fileSystem.start()
  }

  public stopAll(): void {
    Object.values(this.contacts).forEach(contact => {
      contact.stopAll()
    })
    this.fileSystem.stop()
  }

  public async publishActor(): Promise<void> {
    await this.writeActor({
      profile: this.data.actor.profile,
      publicKey: this.data.actor.keyPair.getPublic('hex'),
    })
  }

  public async lookupActor(address: string): Promise<ActorData | null> {
    return await readActor({ sync: this.sync, actor: address })
  }

  public hasContact(address: string): boolean {
    return this.contacts[address] != null
  }

  public getContact(address: string): ContactAgent | null {
    return this.contacts[address] || null
  }

  public async addContact(
    address: string,
    actor?: ActorData,
    params: SyncParams = {},
  ): Promise<ContactAgent> {
    let actorData: ActorData | null = null
    if (actor == null) {
      actorData = await this.lookupActor(address)
    } else {
      actorData = actor
    }
    if (actorData == null) {
      throw new Error('Actor not found')
    }

    const firstContact = {
      keyPair: this.data.actor.keyPair,
      actorKey: actorData.publicKey,
    }
    const contact = new ContactAgent({
      autoStart: this.autoStart,
      interval: this.interval,
      ...params,
      sync: this.sync,
      data: {
        read: {
          actorAddress: address,
          actorData: actor,
          firstContact,
        },
        write: {
          keyPair: createKeyPair(),
          firstContact,
        },
      },
    })
    await contact.initialize()

    this.contacts[address] = contact
    return contact
  }

  public removeContact(address: string): void {
    const contact = this.contacts[address]
    if (contact != null) {
      contact.stopAll()
      delete this.contacts[address]
    }
  }
}
