import { FILE_SYSTEM_NAME, getID } from '../namespace'
import { EncryptionParams } from '../types'

import { swarmHashProperty } from './swarmHash'

export interface FileEncryption extends EncryptionParams {
  key: string
}

export const fileEncryptionProperty = {
  type: 'object',
  required: ['key'],
  properties: {
    algorithm: { type: 'string' },
    authTag: { type: 'string' },
    iv: { type: 'string' },
    key: { type: 'string' },
  },
}

export interface FileMetadata {
  contentType?: string
  size?: number
}

export interface File extends FileMetadata {
  hash: string
  encryption?: FileEncryption
}

export const fileProperty = {
  required: ['hash'],
  properties: {
    hash: swarmHashProperty,
    contentType: { type: 'string' },
    encryption: fileEncryptionProperty,
    size: { type: 'integer', minimum: 0 },
  },
}

// Nested files and folders tree (keys are relative paths)
export interface Folder {
  files?: Record<string, File>
  folders?: Record<string, Folder>
}

// Flattened list of files (keys are absolute paths)
export type FilesRecord = Record<string, File>

// Useful reference: https://json-schema.org/learn/file-system.html
export const fileSystemProperty = {
  type: 'object',
  patternProperties: {
    '^(/[^/]+)+$': fileProperty,
  },
  additionalProperties: false,
}

export interface FileSystem {
  files: FilesRecord
}

export const fileSystemSchema = {
  $async: true,
  $id: getID(FILE_SYSTEM_NAME),
  type: 'object',
  properties: {
    files: fileSystemProperty,
  },
}
