import { Readable } from 'stream'

import {
  AEGLE_BYTE,
  CRYPTO_ALGORITHM,
  HEADER_MAX_SIZE,
  HEADER_SIZE_BYTES,
} from './constants'
import { createDecipher, encrypt } from './crypto'
import {
  DecodeParams,
  EncodeParams,
  EntityPayload,
  PayloadHeaders,
} from './types'
import { CheckMaxSize, fromBuffer, toBuffer } from './utils'
import { validateEntity, validateStream } from './validation'

export function decodeHeaderSize(buffer: Buffer): number {
  if (buffer.length !== HEADER_SIZE_BYTES) {
    throw new Error('Invalid input')
  }
  return parseInt(buffer.toString('hex'), 16)
}

export function encodeHeaderSize(size: number): Buffer {
  if (size < 0 || size > HEADER_MAX_SIZE) {
    throw new Error('Out of bounds header size')
  }
  const hex = size.toString(16).padStart(4, '0')
  return Buffer.from(hex, 'hex')
}

export async function getBodyStream(
  stream: Readable,
  params: DecodeParams = {},
): Promise<Readable> {
  return new Promise((resolve, reject): void => {
    stream.on('error', err => {
      reject(err)
    })
    stream.once('readable', () => {
      // Check control byte
      const checkBuffer = stream.read(1)
      if (!AEGLE_BYTE.equals(checkBuffer)) {
        reject(new Error('Invalid stream'))
        return
      }

      try {
        // Decode headers
        const headerSize = decodeHeaderSize(stream.read(HEADER_SIZE_BYTES))
        const headers: PayloadHeaders =
          headerSize === 0 ? {} : fromBuffer(stream.read(headerSize))

        if (
          headers.size != null &&
          params.maxSize != null &&
          headers.size > params.maxSize
        ) {
          throw new Error('Body exceeds max size')
        }

        // Check max size is respected
        const maxSize = params.maxSize || headers.size || null
        const checkedStream =
          maxSize === null ? stream : stream.pipe(new CheckMaxSize(maxSize))

        // Decrypt stream if encrypted
        let bodyStream
        if (headers.encryption == null) {
          bodyStream = checkedStream
        } else {
          if (params.key == null) {
            throw new Error('Missing key to attempt decryption')
          }
          bodyStream = stream.pipe(
            createDecipher(params.key, headers.encryption),
          )
        }
        resolve(bodyStream)
      } catch (err) {
        reject(err)
      }
    })
  })
}

export async function decodeEntityStream<T>(
  stream: Readable,
  params: DecodeParams = {},
): Promise<EntityPayload<T>> {
  const bodyStream = await getBodyStream(stream, params)
  return await validateStream(bodyStream)
}

export async function encodePayload(
  payload: any,
  params: EncodeParams = {},
): Promise<Buffer> {
  const headers: PayloadHeaders = {}
  let body
  if (params.key == null) {
    body = toBuffer(payload)
  } else {
    const encrypted = await encrypt(
      params.algorithm || CRYPTO_ALGORITHM,
      params.key,
      payload,
    )
    body = encrypted.data
    headers.encryption = encrypted.params
  }
  headers.size = body.length

  const headersBuffer = toBuffer(headers)

  return Buffer.concat([
    AEGLE_BYTE,
    encodeHeaderSize(headersBuffer.length),
    headersBuffer,
    body,
  ])
}

export async function encodeEntity(
  type: string,
  data: any,
  params: EncodeParams = {},
): Promise<Buffer> {
  const payload = await validateEntity({ type, data })
  return await encodePayload(payload, params)
}
