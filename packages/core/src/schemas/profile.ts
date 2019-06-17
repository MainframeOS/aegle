import { ethereumAddressProperty } from './ethereumAddress'

export interface Profile {
  displayName?: string
  walletAddress?: string
}

export const profileProperties = {
  displayName: {
    type: 'string',
    maxLength: 50,
  },
  walletAddress: ethereumAddressProperty,
}
