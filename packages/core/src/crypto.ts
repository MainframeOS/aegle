import { createCipheriv, createDecipheriv, Decipher, randomBytes } from 'crypto'

import {
  CRYPTO_ALGORITHM,
  CRYPTO_IV_LENGTH,
  CRYPTO_KEY_LENGTH,
} from './constants'
import { CipherParams, EncryptionParams, EncryptedPayload } from './types'

export async function createRandomBytes(size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    randomBytes(size, (err, bytes) => {
      if (err) reject(err)
      else resolve(bytes)
    })
  })
}

export async function createKey(): Promise<Buffer> {
  return await createRandomBytes(CRYPTO_KEY_LENGTH)
}

export async function createCipher(
  algorithm: string,
  key: Buffer,
): Promise<CipherParams> {
  if (algorithm !== CRYPTO_ALGORITHM) {
    throw new Error('Unsupported algorithm')
  }
  const iv = await createRandomBytes(CRYPTO_IV_LENGTH)
  const cipher = createCipheriv(algorithm, key, iv)
  return {
    algorithm,
    cipher,
    iv: iv.toString('base64'),
  }
}

export function createDecipher(
  key: Buffer | string,
  params: EncryptionParams,
): Decipher {
  if (params.algorithm !== CRYPTO_ALGORITHM) {
    throw new Error('Unsupported algorithm')
  }
  const decipher = createDecipheriv(
    params.algorithm,
    typeof key === 'string' ? Buffer.from(key, 'base64') : key,
    Buffer.from(params.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(params.authTag, 'base64'))
  return decipher
}

export async function decrypt(
  key: Buffer,
  payload: EncryptedPayload,
): Promise<Buffer> {
  const decipher = createDecipher(key, payload.params)
  return Buffer.concat([decipher.update(payload.data), decipher.final()])
}

export async function decryptJSON<T>(
  key: Buffer,
  payload: EncryptedPayload,
): Promise<T> {
  const decipher = createDecipher(key, payload.params)
  let decrypted = decipher.update(payload.data, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return JSON.parse(decrypted)
}

export async function encrypt(
  algorithm: string,
  key: Buffer,
  data: Buffer,
): Promise<EncryptedPayload> {
  const { cipher, iv } = await createCipher(algorithm, key)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  return {
    data: encrypted,
    params: {
      algorithm,
      authTag: cipher.getAuthTag().toString('base64'),
      iv,
    },
  }
}

export async function encryptJSON<T>(
  algorithm: string,
  key: Buffer,
  data: T,
): Promise<EncryptedPayload> {
  const { cipher, iv } = await createCipher(algorithm, key)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ])
  return {
    data: encrypted,
    params: {
      algorithm,
      authTag: cipher.getAuthTag().toString('base64'),
      iv,
    },
  }
}
