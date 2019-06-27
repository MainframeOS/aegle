import { FeedParams } from '@erebos/api-bzz-base'

import { ethereumAddressProperty } from './ethereumAddress'

export interface SwarmFeed extends FeedParams {}

export const swarmFeedProperty = {
  required: ['user'],
  properties: {
    user: ethereumAddressProperty,
    name: { type: 'string', maxLength: 32 },
    topic: { type: 'string', pattern: '^0x[0-9a-f]{64}$' },
  },
}
