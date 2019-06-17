import elliptic from 'elliptic'

export type KeyPair = elliptic.ec.KeyPair

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

export enum ResourceProtocol {
  BzzHash = 'bzz.hash',
  BzzFeed = 'bzz.feed',
  TimelineChapter = 'timeline.chapter',
  TimelineFeed = 'timeline.feed',
}
