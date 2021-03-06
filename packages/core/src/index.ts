import ajv from 'ajv'

import { decodeStream, encodePayload } from './encoding'
import { getID } from './namespace'
import { fromBuffer } from './utils'
import { DecodeParams, EncodeParams, EntityPayload } from './types'

import { actorSchema } from './schemas/actor'
import { contactSchema, firstContactSchema } from './schemas/contact'
import { fileSystemSchema } from './schemas/fileSystem'
import { messageSchema } from './schemas/messaging'

export * from './schemas'
export * from './constants'
export * from './crypto'
export * from './encoding'
export * from './namespace'
export * from './types'
export * from './utils'

export class Core {
  private ajv: ajv.Ajv

  public constructor() {
    this.ajv = ajv()
    this.ajv.addSchema([
      actorSchema,
      contactSchema,
      firstContactSchema,
      fileSystemSchema,
      messageSchema,
    ])
  }

  public async validateEntity<T = any>(
    entity: EntityPayload<T>,
  ): Promise<EntityPayload<T>> {
    await this.ajv.validate(getID(entity.type), entity.data)
    return entity
  }

  public async validateBuffer<T = any>(
    buffer: Buffer,
  ): Promise<EntityPayload<T>> {
    return await this.validateEntity<T>(fromBuffer(buffer))
  }

  public async decodeEntityStream<T>(
    stream: NodeJS.ReadableStream,
    params: DecodeParams = {},
  ): Promise<EntityPayload<T>> {
    const buffer = await decodeStream(stream, params)
    return await this.validateBuffer<T>(buffer)
  }

  public async encodeEntity<T = any>(
    type: string,
    data: T,
    params: EncodeParams = {},
  ): Promise<Buffer> {
    const payload = await this.validateEntity<T>({ type, data })
    return await encodePayload(payload, params)
  }
}
