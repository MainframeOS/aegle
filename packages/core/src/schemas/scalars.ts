import { FeedParams } from '@erebos/api-bzz-base'

export const ethereumAddressProperty = {
  type: 'string',
  pattern: '^0x[0-9a-f]{40}$',
}

export const publicKeyProperty = {
  type: 'string',
  pattern: '^[0-9a-f]{130}$',
}

export interface SwarmFeed extends FeedParams {}

export const swarmFeedProperty = {
  required: ['user'],
  properties: {
    user: ethereumAddressProperty,
    name: { type: 'string', maxLength: 32 },
    topic: { type: 'string', pattern: '^0x[0-9a-f]{64}$' },
  },
}

export const swarmHashProperty = {
  type: 'string',
  pattern: '^[0-9a-f]{64}$',
}
