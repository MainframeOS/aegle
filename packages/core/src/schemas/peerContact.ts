import { ethereumAddressProperty } from './ethereumAddress'
import { publicKeyProperty } from './publicKey'

export interface PeerContact {
  contactPublicKey: string
  peerAddress: string
}

export const peerContactSchema = {
  $async: true,
  properties: {
    contactPublicKey: publicKeyProperty,
    peerAddress: ethereumAddressProperty,
  },
  required: ['contactPublicKey', 'peerAddress'],
}
