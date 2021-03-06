export const NAMESPACE_PREFIX = 'aegle'

export const NAMESPACE_VERSION = 'v0'

export const PROTOCOL_NAME = 'aegle://'

export function getID(name: string): string {
  return name.startsWith(PROTOCOL_NAME) ? name : PROTOCOL_NAME + name
}

export function namespace(
  name: string,
  version: string = NAMESPACE_VERSION,
): string {
  return `${NAMESPACE_PREFIX}.${name}.${version}`
}

export const ACTOR_NAME = namespace('actor')
export const CONTACT_NAME = namespace('contact')
export const FILE_SYSTEM_NAME = namespace('fileSystem')
export const FIRST_CONTACT_NAME = namespace('firstContact')
export const MAILBOX_NAME = namespace('mailbox')
export const MESSAGE_NAME = namespace('message')
