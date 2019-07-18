import { ethereumAddressProperty } from './scalars'

export interface ProfileData {
  displayName?: string
  walletAddress?: string
}

export const profileProperty = {
  type: 'object',
  properties: {
    displayName: {
      type: 'string',
      maxLength: 50,
    },
    walletAddress: ethereumAddressProperty,
  },
}
