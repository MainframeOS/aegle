import { ACTOR_NAME, getID } from '../namespace'

import { ProfileData, profileProperty } from './profile'
import { publicKeyProperty } from './scalars'

export interface ActorData {
  profile?: ProfileData
  publicKey: string
}

export const actorSchema = {
  $async: true,
  $id: getID(ACTOR_NAME),
  type: 'object',
  required: ['publicKey'],
  properties: {
    profile: profileProperty,
    publicKey: publicKeyProperty,
  },
  additionalProperties: false,
}
