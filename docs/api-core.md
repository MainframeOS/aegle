# Core API

## Installation

```sh
npm install @aegle/core
```

## Interfaces and types

### CipherParams

Uses [`CipherGCM` interface](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/node/crypto.d.ts#L220)

```ts
interface CipherParams {
  algorithm: string
  cipher: CipherGCM
  iv: string
}
```

### EncryptionParams

```ts
interface EncryptionParams {
  algorithm: string
  iv: string
  authTag: string
}
```

### EncryptedPayload

Uses [`EncryptionParams` interface](#encryptionparams)

```ts
interface EncryptedPayload {
  data: Buffer
  params: EncryptionParams
}
```

### PayloadHeaders

Uses [`EncryptionParams` interface](#encryptionparams)

```ts
interface PayloadHeaders {
  encryption?: EncryptionParams
  size?: number
}
```

### EntityPayload

```ts
interface EntityPayload<T = any> {
  type: string
  data: T
}
```

### DecodeParams

```ts
interface DecodeParams {
  key?: Buffer
  maxSize?: number
}
```

### EncodeParams

```ts
interface EncodeParams {
  algorithm?: string
  key?: Buffer
}
```

### ActorData

Uses [`ProfileData` interface](#profiledata)

```ts
interface ActorData {
  profile?: ProfileData
  publicKey: string
}
```

### ContactData

Uses [`MailboxesRecord` interface](#mailboxesrecord) and [`ProfileData` interface](#profiledata)

```ts
interface ContactData {
  fileSystemKey?: string
  mailboxes?: MailboxesRecord
  profile?: ProfileData
}
```

### FirstContactData

```ts
interface FirstContactData {
  actorAddress: string
  contactPublicKey: string
}
```

### FileEncryptionData

Extends [`EncryptionParams`](#encryptionparams)

```ts
interface FileEncryptionData extends EncryptionParams {
  key: string
}
```

### FileMetadata

```ts
interface FileMetadata {
  contentType?: string
  size?: number
}
```

### FileData

Extends [`FileMetadata`](#filemetadata)

```ts
interface FileData extends FileMetadata {
  hash: string
  encryption?: FileEncryptionData
}
```

### FolderData

Uses [`FileData` interface](#filedata)

```ts
interface FolderData {
  files?: Record<string, FileData>
  folders?: Record<string, FolderData>
}
```

### FilesRecord

Uses [`FileData` interface](#filedata)

```ts
type FilesRecord = Record<string, FileData>
```

### FileSystemData

Uses [`FilesRecord` type](#filesrecord)

```ts
interface FileSystemData {
  files: FilesRecord
}
```

### MessageAttachmentData

Uses [`FileData` interface](#filedata)

```ts
interface MessageAttachmentData {
  file: FileData
  name?: string
}
```

### MessageData

Uses [`MessageAttachmentData` interface](#messageattachmentdata)

```ts
interface MessageData {
  body: string
  attachments?: Array<MessageAttachmentData>
  replyTo?: string
  thread?: string
  title?: string
}
```

### MailboxesRecord

```ts
type MailboxesRecord = Record<string, string>
```

### ProfileData

```ts
interface ProfileData {
  displayName?: string
  walletAddress?: string
}
```

## Schemas

JSON schemas used to validate entities

### actorSchema

Validates the [`ActorData` interface](#actordata)

### contactSchema

Validates the [`ContactData` interface](#contactdata)

### firstContactSchema

Validates the [`FirstContactData` interface](#firstcontactdata)

### fileSystemSchema

Validates the [`FileSystemData` interface](#filesystemdata)

### messageSchema

Validates the [`MessageData` interface](#messagedata)

## Core class

### .validateEntity()

**Arguments**

1.  [`entity: EntityPayload<T = any>`](#entitypayload)

**Returns** `Promise<EntityPayload<T>>`

### .validateBuffer()

**Arguments**

1.  `buffer: Buffer`

**Returns** `Promise<EntityPayload<T = any>>`

### .decodeEntityStream()

**Arguments**

1.  [`stream: Readable`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_class_stream_readable)
1.  [`params: DecodeParams = {}`](#decodeparams)

**Returns** `Promise<EntityPayload<T = any>>`

### .encodeEntity()

**Arguments**

1.  `type: string`
1.  `data: T = any`
1.  [`params: EncodeParams = {}`](#encodeparams)

**Returns** `Promise<Buffer>`
