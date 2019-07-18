import { FILE_SYSTEM_NAME, getID } from '../namespace'
import { EncryptionParams } from '../types'

import { swarmHashProperty } from './scalars'

export interface FileEncryptionData extends EncryptionParams {
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

export interface FileData extends FileMetadata {
  hash: string
  encryption?: FileEncryptionData
}

export const fileProperty = {
  type: 'object',
  required: ['hash'],
  properties: {
    hash: swarmHashProperty,
    contentType: { type: 'string' },
    encryption: fileEncryptionProperty,
    size: { type: 'integer', minimum: 0 },
  },
}

// Nested files and folders tree (keys are relative paths)
export interface FolderData {
  files?: Record<string, FileData>
  folders?: Record<string, FolderData>
}

// Flattened list of files (keys are absolute paths)
export type FilesRecord = Record<string, FileData>

// Useful reference: https://json-schema.org/learn/file-system.html
export const fileSystemProperty = {
  type: 'object',
  patternProperties: {
    '^(/[^/]+)+$': fileProperty,
  },
  additionalProperties: false,
}

export interface FileSystemData {
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
