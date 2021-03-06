import { CipherGCM } from 'crypto'

export interface CipherParams {
  algorithm: string
  cipher: CipherGCM
  iv: string
}

export interface EncryptionParams {
  algorithm: string
  iv: string
  authTag: string
}

export interface EncryptedPayload {
  data: Buffer
  params: EncryptionParams
}

export interface PayloadHeaders {
  encryption?: EncryptionParams
  size?: number
}

export interface EntityPayload<T = any> {
  type: string
  data: T
}

export interface DecodeParams {
  key?: Buffer
  maxSize?: number
}

export interface EncodeParams {
  algorithm?: string
  key?: Buffer
}
