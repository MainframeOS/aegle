import { Readable } from 'stream'
import * as Ajv from 'ajv'
import getStream from 'get-stream'

import { CONTACT_NAME, PEER_NAME, PEER_CONTACT_NAME } from './namespace'
import { fromBuffer } from './utils'
import { EntityPayload } from './types'

import { contactSchema } from './schemas/contact'
import { peerSchema } from './schemas/peer'
import { peerContactSchema } from './schemas/peerContact'

const ajv = new Ajv()
ajv.addSchema(contactSchema, CONTACT_NAME)
ajv.addSchema(peerSchema, PEER_NAME)
ajv.addSchema(peerContactSchema, PEER_CONTACT_NAME)

export async function validateEntity(
  entity: EntityPayload,
): Promise<EntityPayload> {
  await ajv.validate(entity.type, entity.data)
  return entity
}

export async function validateBuffer(buffer: Buffer): Promise<EntityPayload> {
  return await validateEntity(fromBuffer(buffer))
}

export async function validateStream(stream: Readable): Promise<EntityPayload> {
  const buffer = await getStream.buffer(stream)
  return await validateBuffer(buffer)
}
