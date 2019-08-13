import { ACTOR_NAME, ActorData, ProfileData } from '@aegle/core'
import { Sync } from '@aegle/sync'
import { hexValue } from '@erebos/hex'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { ContactAgentData, ContactAgent } from './contact'
import { FileSystemWriter } from './fileSystem'

const FEED_PARAMS = { entityType: ACTOR_NAME, name: ACTOR_NAME }

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
): Promise<hexValue> {
  return await params.sync.writeFeed(
    { ...FEED_PARAMS, keyPair: params.keyPair },
    data,
  )
}

export function createActorWriter(params: ActorWriterParams) {
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

export interface ActorAgentParams {
  data: ActorAgentData
  sync: Sync
}

export class ActorAgent {
  protected data: ActorAgentData

  public contacts: Record<string, ContactAgent> = {}
  public fileSystem: FileSystemWriter
  public sync: Sync
  public writeActor: (data: ActorData) => Promise<hexValue>

  public constructor(params: ActorAgentParams) {
    this.data = params.data
    this.sync = params.sync

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
      keyPair: fsKeyPair,
      sync: this.sync,
      reader: this.data.actor.keyPair.getPublic('hex'),
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

    const contact = new ContactAgent({
      sync: this.sync,
      data: {
        read: {
          actorAddress: address,
          actorData: actor,
        },
        write: {
          keyPair: createKeyPair(),
          firstContact: {
            keyPair: this.data.actor.keyPair,
            actorKey: actorData.publicKey,
          },
        },
      },
    })
    await contact.initialize()

    this.contacts[address] = contact
    return contact
  }

  public removeContact(address: string): void {
    delete this.contacts[address]
  }
}
