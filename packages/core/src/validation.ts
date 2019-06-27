import { Readable } from 'stream'
import * as Ajv from 'ajv'
import getStream from 'get-stream'

import { getID } from './namespace'
import { fromBuffer } from './utils'
import { EntityPayload } from './types'

import { contactSchema } from './schemas/contact'
import { fileSystemSchema } from './schemas/fileSystem'
import { peerSchema } from './schemas/peer'
import { peerContactSchema } from './schemas/peerContact'

const ajv = new Ajv()
ajv.addSchema([contactSchema, fileSystemSchema, peerSchema, peerContactSchema])

export async function validateEntity<T = any>(
  entity: EntityPayload<T>,
): Promise<EntityPayload<T>> {
  await ajv.validate(getID(entity.type), entity.data)
  return entity
}

export async function validateBuffer<T = any>(
  buffer: Buffer,
): Promise<EntityPayload<T>> {
  return await validateEntity<T>(fromBuffer(buffer))
}

export async function validateStream<T = any>(
  stream: Readable,
): Promise<EntityPayload<T>> {
  const buffer = await getStream.buffer(stream)
  return await validateBuffer<T>(buffer)
}
