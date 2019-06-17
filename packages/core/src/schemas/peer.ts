import { Profile, profileProperties } from './profile'
import { publicKeyProperty } from './publicKey'

export interface Peer {
  profile?: Profile
  publicKey: string
}

export const peerSchema = {
  $async: true,
  properties: {
    profile: profileProperties,
    publicKey: publicKeyProperty,
  },
  required: ['publicKey'],
}
