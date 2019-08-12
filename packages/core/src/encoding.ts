import getStream from 'get-stream'

import {
  AEGLE_BYTE,
  CRYPTO_ALGORITHM,
  HEADER_MAX_SIZE,
  HEADER_SIZE_BYTES,
} from './constants'
import { createDecipher, encryptJSON } from './crypto'
import { DecodeParams, EncodeParams, PayloadHeaders } from './types'
import { fromBuffer, toBuffer } from './utils'

export function decodeHeaderSize(buffer?: Buffer): number {
  if (buffer == null || buffer.length !== HEADER_SIZE_BYTES) {
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

export async function decodeStream(
  stream: NodeJS.ReadableStream,
  params: DecodeParams = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    stream.on('error', err => {
      reject(err)
    })
    stream.once('readable', () => {
      // Check control byte
      const checkBuffer = stream.read(1) as Buffer
      if (!AEGLE_BYTE.equals(checkBuffer)) {
        reject(new Error('Invalid stream'))
        return
      }

      try {
        // Decode headers
        const headerSize = decodeHeaderSize(stream.read(
          HEADER_SIZE_BYTES,
        ) as Buffer)
        const headers: PayloadHeaders =
          headerSize === 0 ? {} : fromBuffer(stream.read(headerSize) as Buffer)

        if (
          headers.size != null &&
          params.maxSize != null &&
          headers.size > params.maxSize
        ) {
          throw new Error('Body exceeds maximum allowed size')
        }

        // Decrypt stream if encrypted
        let bodyStream
        if (headers.encryption == null) {
          bodyStream = stream
        } else {
          if (params.key == null) {
            throw new Error('Missing key to attempt decryption')
          }
          bodyStream = stream.pipe(
            createDecipher(params.key, headers.encryption),
          )
        }

        // Check max size is respected
        let maxBuffer = headers.size
        if (params.maxSize != null) {
          maxBuffer = headers.size
            ? Math.min(params.maxSize, headers.size)
            : params.maxSize
        }

        getStream.buffer(bodyStream, { maxBuffer }).then(resolve, reject)
      } catch (err) {
        reject(err)
      }
    })
  })
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
    const encrypted = await encryptJSON(
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
