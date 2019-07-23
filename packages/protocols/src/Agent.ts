import { ActorData, ProfileData } from '@aegle/core'
import { AegleSync } from '@aegle/sync'
import { hexValue } from '@erebos/hex'
import { KeyPair } from '@erebos/secp256k1'

import { createActorWriter } from './actor'
import { AgentContactData, AgentContact } from './AgentContact'

interface AgentActorData {
  keyPair: KeyPair
  profile?: ProfileData
}

interface AgentData {
  actor: AgentActorData
  contacts?: Record<string, AgentContactData>
  fileSystemKeyPair?: KeyPair
}

export interface AgentParams {
  data: AgentData
  sync: AegleSync
}

export class Agent {
  protected data: AgentData

  public contacts: Record<string, AgentContact> = {}
  public sync: AegleSync
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
        this.contacts[address] = new AgentContact({ sync: this.sync, data })
      }
    }

    // TODO: setup FS
  }

  // TODO: methods to lookup actors, add and remove contacts
}
