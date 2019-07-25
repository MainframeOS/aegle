import { ActorData, ProfileData } from '@aegle/core'
import { Sync } from '@aegle/sync'
import { hexValue } from '@erebos/hex'
import { KeyPair, createKeyPair } from '@erebos/secp256k1'

import { createActorWriter, readActor } from './actor'
import { ContactAgentData, ContactAgent } from './contact'
import { FileSystemWriter } from './fileSystem'

export * from './actor'
export * from './contact'
export * from './fileSystem'
export * from './messaging'

export interface AgentActorData {
  keyPair: KeyPair
  profile?: ProfileData
}

export interface AgentData {
  actor: AgentActorData
  contacts?: Record<string, ContactAgentData>
  fileSystemKeyPair?: KeyPair
}

export interface AgentParams {
  data: AgentData
  sync: Sync
}

export class Agent {
  protected data: AgentData

  public contacts: Record<string, ContactAgent> = {}
  public fileSystem: FileSystemWriter
  public sync: Sync
  public writeActor: (data: ActorData) => Promise<hexValue>

  public constructor(params: AgentParams) {
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
          firstContactWritten: false,
        },
      },
      firstContact: {
        keyPair: this.data.actor.keyPair,
        actorKey: actorData.publicKey,
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
