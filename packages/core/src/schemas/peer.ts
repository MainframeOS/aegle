import { PEER_NAME, getID } from '../namespace'

import { Profile, profileProperty } from './profile'
import { publicKeyProperty } from './scalars'

export interface Peer {
  profile?: Profile
  publicKey: string
}

export const peerSchema = {
  $async: true,
  $id: getID(PEER_NAME),
  type: 'object',
  required: ['publicKey'],
  properties: {
    profile: profileProperty,
    publicKey: publicKeyProperty,
  },
  additionalProperties: false,
}
