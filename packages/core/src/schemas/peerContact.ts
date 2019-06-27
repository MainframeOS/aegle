import { PEER_CONTACT_NAME, getID } from '../namespace'

import { ethereumAddressProperty } from './ethereumAddress'
import { publicKeyProperty } from './publicKey'

export interface PeerContact {
  contactPublicKey: string
  peerAddress: string
}

export const peerContactSchema = {
  $async: true,
  $id: getID(PEER_CONTACT_NAME),
  type: 'object',
  required: ['contactPublicKey', 'peerAddress'],
  properties: {
    contactPublicKey: publicKeyProperty,
    peerAddress: ethereumAddressProperty,
  },
  additionalProperties: false,
}
