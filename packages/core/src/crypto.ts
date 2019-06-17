import { createCipheriv, createDecipheriv, Decipher, randomBytes } from 'crypto'

import { CRYPTO_ALGORITHM } from './constants'
import { EncryptionParams, EncryptedPayload } from './types'

export async function randomBytesAsync(size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    randomBytes(size, (err, bytes) => {
      if (err) reject(err)
      else resolve(bytes)
    })
  })
}

export function createDecipher(
  key: Buffer,
  params: EncryptionParams,
): Decipher {
  if (params.algorithm !== CRYPTO_ALGORITHM) {
    throw new Error('Unsupported algorithm')
  }
  const decipher = createDecipheriv(
    params.algorithm,
    key,
    Buffer.from(params.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(params.authTag, 'base64'))
  return decipher
}

export async function decrypt<T>(
  key: Buffer,
  payload: EncryptedPayload,
): Promise<T> {
  const decipher = createDecipher(key, payload.params)
  let decrypted = decipher.update(payload.data, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return JSON.parse(decrypted)
}

export async function encrypt<T>(
  algorithm: string,
  key: Buffer,
  data: T,
): Promise<EncryptedPayload> {
  if (algorithm !== CRYPTO_ALGORITHM) {
    throw new Error('Unsupported algorithm')
  }
  const iv = await randomBytesAsync(16)
  const cipher = createCipheriv(algorithm, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ])
  return {
    data: encrypted,
    params: {
      algorithm,
      authTag: cipher.getAuthTag().toString('base64'),
      iv: iv.toString('base64'),
    },
  }
}
