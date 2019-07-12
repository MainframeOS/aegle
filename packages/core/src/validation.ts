import { Readable } from 'stream'
import * as Ajv from 'ajv'
import getStream from 'get-stream'

import { getID } from './namespace'
import { fromBuffer } from './utils'
import { EntityPayload } from './types'

import { actorSchema } from './schemas/actor'
import { contactSchema, firstContactSchema } from './schemas/contact'
import { fileSystemSchema } from './schemas/fileSystem'
import { messageSchema } from './schemas/messaging'

const ajv = new Ajv()
ajv.addSchema([
  actorSchema,
  contactSchema,
  firstContactSchema,
  fileSystemSchema,
  messageSchema,
])

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
