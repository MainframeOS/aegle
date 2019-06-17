import { Profile, profileProperties } from './profile'

export interface Contact {
  data?: Record<string, any>
  profile?: Profile
}

export const contactSchema = {
  $async: true,
  properties: {
    data: { type: 'object' },
    profile: profileProperties,
  },
}
