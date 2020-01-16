# Agent API

## Installation

```sh
npm install @aegle/agent
```

## Interfaces and types

### SyncParams

```ts
interface SyncParams {
  autoStart?: boolean
  interval?: number
}
```

### ActorAgentActorData

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair) and [`ProfileData` interface](api-core.md#profiledata)

```ts
interface ActorAgentActorData {
  keyPair: KeyPair
  profile?: ProfileData
}
```

### ActorAgentData

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair), [`ActorAgentActorData` interface](#actoragentactordata) and [`ContactAgentData` interface](#contactagentdata)

```ts
interface ActorAgentData {
  actor: ActorAgentActorData
  contacts?: Record<string, ContactAgentData>
  fileSystemKeyPair?: KeyPair
}
```

### ActorAgentParams

Extends [`SyncParams`](#syncparams)

Uses [`Sync` class](api-sync.md#sync-class) and [`ActorAgentData` interface](#actoragentdata)

```ts
interface ActorAgentParams extends SyncParams {
  sync: Sync
  data: ActorAgentData
}
```

### FirstContactAgentData

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair)

```ts
interface FirstContactAgentData {
  keyPair: KeyPair
  actorKey: string
}
```

### ReadContactAgentData

Uses [`ActorData` interface](api-core.md#actordata), [`ContactData` interface](api-core.md#contactdata) and [`FirstContactAgentData` interface](#firstcontactagentdata)

```ts
interface ReadContactAgentData {
  actorAddress: string
  actorData?: ActorData
  contactPublicKey?: string
  contactData?: ContactData
  firstContact?: FirstContactAgentData
}
```

### WriteContactAgentData

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair), [`ProfileData` interface](api-core.md#profiledata) and [`FirstContactAgentData` interface](#firstcontactagentdata)

```ts
interface WriteContactAgentData {
  keyPair: KeyPair
  fileSystemKeyPair?: KeyPair
  firstContact?: FirstContactAgentData
  mailboxes?: Record<string, KeyPair>
  profile?: ProfileData
}
```

### ContactAgentData

Uses [`ReadContactAgentData` interface](#readcontactagentdata) and [`WriteContactAgentData` interface](#writecontactagentdata)

```ts
interface ContactAgentData {
  read: ReadContactAgentData
  write: WriteContactAgentData
}
```

### ContactAgentError

```ts
interface ContactAgentError {
  type: 'firstContact' | 'contact'
  error: Error
}
```

### ContactAgentParams

Extends [`SyncParams`](#syncparams)

Uses [`Sync` class](api-sync.md#sync-class) and [`ContactAgentData` interface](#contactagentdata)

```ts
interface ContactAgentParams extends SyncParams {
  sync: Sync
  data: ContactAgentData
}
```

### FileUploadParams

Extends [`FileMetadata`](api-core.md#filemetadata)

```ts
interface FileUploadParams extends FileMetadata {
  encrypt?: boolean
}
```

### FileUploadParams

Uses [`Sync` class](api-sync.md#sync-class) and [`FilesRecord` type](api-core.md#filesrecord)

```ts
interface FileSystemParams {
  sync: Sync
  files?: FilesRecord
}
```

### FileSystemPullSyncState

```ts
enum FileSystemPullSyncState {
  PENDING,
  PULLING,
  FAILED,
  DONE,
}
```

### FileSystemPushSyncState

```ts
enum FileSystemPushSyncState {
  IDLE,
  PUSHING,
  FAILED,
}
```

### FileSystemReaderParams

Extends [`FileSystemParams`](#filesystemparams) and [`SyncParams`](#syncparams)

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair)

```ts
interface FileSystemReaderParams extends FileSystemParams, SyncParams {
  writer: string
  keyPair?: KeyPair
}
```

### FileSystemChanges

```ts
interface FileSystemChanges {
  sync: boolean
  timestamp: number
}
```

### FileSystemWriterParams

Extends [`FileSystemParams`](#filesystemparams) and [`SyncParams`](#syncparams)

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair) and [`FilesRecord` type](api-core.md#filesrecord)

```ts
interface FileSystemWriterParams extends FileSystemParams, SyncParams {
  keyPair: KeyPair
  files?: FilesRecord
  reader?: string
}
```

### MailboxAgentParams

Extends [`SyncParams`](#syncparams)

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair) and [`Sync` class](api-sync.md#sync-class)

```ts
interface MailboxAgentParams extends SyncParams {
  sync: Sync
  keyPair: KeyPair
}
```

### InboxState

```ts
enum InboxState {
  STOPPED,
  STARTED,
  ERROR,
}
```

### InboxAgentData

Uses [`MessageData` interface](api-core.md#messagedata)

```ts
interface InboxAgentData {
  writer: string
  messages?: Array<MessageData>
}
```

### InboxAgentParams

Extends [`MailboxAgentParams` interface](#mailboxagentparams) and [`InboxAgentData` interface](#inboxagentdata)

```ts
interface InboxAgentParams extends MailboxAgentParams, InboxAgentData {}
```

### InboxesAgentInboxParams

Extends [`SyncParams`](#syncparams)

Uses [`MessageData` interface](api-core.md#messagedata)

```ts
interface InboxesAgentInboxParams extends SyncParams {
  writer: string
  messages?: Array<MessageData>
}
```

### InboxesAgentParams

Extends [`MailboxAgentParams` interface](#mailboxagentparams)

Uses [`InboxesAgentInboxParams` interface](#inboxesagentinboxparams)

```ts
interface InboxesAgentParams extends MailboxAgentParams {
  inboxes?: Record<string, InboxesAgentInboxParams>
}
```

### InboxNewMessageData

Uses [`MessageData` interface](api-core.md#messagedata)

```ts
interface InboxNewMessageData {
  inbox: string
  message: MessageData
}
```

### SendMessage

Uses [`Chapter` interface](https://erebos.js.org/docs/timeline-api#chapter), [`EntityPayload` interface](api-core.md#entitypayload) and [`MessageData` interface](api-core.md#messagedata)

```ts
type SendMessage = (
  message: MessageData,
) => Promise<Chapter<EntityPayload<MessageData>>>
```

### OutboxesAgentParams

Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair) and [`Sync` class](api-sync.md#sync-class)

```ts
interface OutboxesAgentParams {
  sync: Sync
  reader: string
  outboxes?: Record<string, KeyPair>
}
```

## ActorAgent class

### new ActorAgent()

**Arguments**

1.  [`params: ActorAgentParams`](#actoragentparams)

### .address

**Returns** `string` the address associated to this actor

### .contacts

**Returns** `Record<string, ContactAgent>` all the [`ContactAgent`](#contactagent-class) instances keyed by address

### .fileSystem

**Returns** [`FileSystemWriter`](#filesystemwriter-class) instance owned by the actor

### .startAll()

Starts synchrononising all the bound agents (contacts and file system)

**Returns** `void`

### .stopAll()

Stops synchrononising all the bound agents (contacts and file system)

**Returns** `void`

### .writeActor()

Writes the provided [`ActorData`](api-core.md#actordata) to the actor's public feed

**Arguments**

1. [`data: ActorData`](api-core.md#actordata)

**Returns** `Promise<void>`

### .publishActor()

Publishes the actor's current [`ActorData`](api-core.md#actordata) to its public feed

**Returns** `Promise<void>`

### .lookupActor()

Returns the [`ActorData`](api-core.md#actordata) at the given `address`, if available

**Arguments**

1.  `address: string`

**Returns** `Promise<ActorData | null>`

### .hasContact()

**Arguments**

1.  `address: string`

**Returns** `boolean`

### .getContact()

**Arguments**

1.  `address: string`

**Returns** [`ContactAgent | null`](#contactagent-class)

### .addContact()

**Arguments**

1.  `address: string`
1.  [`actor?: ActorData`](api-core.md#actordata), if not provided it will be fetched using the `address`
1.  [`params: SyncParams = {}`](#syncparams)

**Returns** [`Promise<ContactAgent>`](#contactagent-class)

### .removeContact()

**Arguments**

1.  `address: string`

**Returns** `void`

## ContactAgent class

### new ContactAgent()

**Arguments**

1.  [`params: ContactAgentParams`](#contactagentparams)

### .inboxes

**Returns** [`InboxesAgent`](#inboxesagent-class)

### .inboundFileSystem

The [`FileSystemReader`](#filesystemreader-class) instance if made available by the contact, `null` otherwise

**Returns** `FileSystemReader | null`

### .outboxes

The [`OutboxesAgent`](#outboxesagent-class) instance if created using the provided [`ContactAgentParams`](#contactagentparams) or after calling [the `createOutboxes()` method](#createoutboxes), `null` otherwise

### .outboundFileSystem

The [`FileSystemWriter`](#filesystemwriter-class) instance if created using the provided [`ContactAgentParams`](#contactagentparams) or after calling [the `createOutboundFileSystem()` method](#createoutboundfilesystem), `null` otherwise

**Returns** `FileSystemWriter | null`

### .connected\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of the connection with the contact, set to `true` when the contact feed is available, `false` otherwise

**Returns** [`BehaviorSubject<boolean>`](https://rxjs.dev/api/index/class/BehaviorSubject)

### .data\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`ContactData`](api-core.md#contactdata) available, or `null` if no data is fetched

**Returns** `BehaviorSubject<ContactData | null>`

### .error\$

[`Subject`](https://rxjs.dev/api/index/class/Subject) of [`ContactAgentError`](#contactagenterror) happening

**Returns** `Subject<ContactAgentError>`

### .initialize()

Writes the first contact and outbound file system feeds as necessary

**Returns** `Promise<void>`

### .createFirstContactSubscription()

Starts subscribing to the first contact feed in order to retrieve the contact data feed information. Once available, it starts subscribing to the contact data feed using [the `createContactSubscription()` method](#createcontactsubscription).

**Arguments**

1.  [`firstContact: FirstContactAgentData`](#firstcontactagentdata)

**Returns** `void`

### .createContactSubscription()

Subscribes to the contact data feed

**Arguments**

1.  `contactKey: string`

**Returns** `void`

### .start()

Calls the [`createFirstContactSubscription()`](#createfirstcontactsubscription) or [`createContactSubscription()`](#createcontactsubscription) method based on the available data about the contact

**Returns** `void`

### .startAll()

Starts the relevant subscriptions for the contact data and inboxes

**Returns** `void`

### .stop()

Stops the first contact or contact data subscription as needed

**Returns** `void`

### .stopAll()

Stops all active subscriptions

**Returns** `void`

### .createOutboundFileSystem()

Creates an outbound [`FileSystemWriter`](#filesystemwriter-class) from the actor to the contact

> This method should only be called _after_ the actor and contact are connected, and will have no effect if called before.

**Returns** `Promise<boolean>` whether the outbound [`FileSystemWriter`](#filesystemwriter-class) has been created or not

### .createOutboxes()

Creates an [`OutboxesAgent`](#outboxesagent-class) from the actor to the contact

> This method should only be called _after_ the actor and contact are connected, and will have no effect if called before

**Returns** `Promise<boolean>` whether the [`OutboxesAgent`](#outboxesagent-class) has been created or not

### .addOutbox()

Adds an outbox with the given `label`

> This method should only be called _after_ the actor and contact are connected, and will have no effect if called before

**Arguments**

1. `label: string`

**Returns** `Promise<boolean>` whether the outbox has been created or not

### .addOutbox()

Adds an outbox with the given `label`

> This method should only be called _after_ the actor and contact are connected, and will have no effect if called before

**Arguments**

1. `label: string`

**Returns** `Promise<boolean>` whether the outbox has been created or not

### .setProfile()

Sets the actor's `profile` information provided to the contact

> This method should only be called _after_ the actor and contact are connected, and will have no effect if called before

**Arguments**

1. [`profile: ProfileData`](api-core.md#profiledata)

**Returns** `Promise<boolean>` whether the profile has been set or not

## FileSystem class

### new FileSystem()

**Arguments**

1. [`params: FileSystemParams`](#filesystemparams)

### .files\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`FilesRecord`](api-core.md#filesrecord)

**Returns** `BehaviorSubject<FilesRecord>`

### .hasFile()

**Arguments**

1. `path: string`

**Returns** `boolean`

### .getFile()

Returns the [`FileData`](#api-core.md#filedata) at the given `path` if available, `null` otherwise

**Arguments**

1. `path: string`

**Returns** `FileData | null`

### .downloadFile()

**Arguments**

1. `path: string`

**Returns** [`Promise<Readable>`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_class_stream_readable)

### .downloadText()

Download the file and parses its contents as text

**Arguments**

1. `path: string`

**Returns** `Promise<string>`

### .downloadJSON()

Download the file and parses its contents as JSON

**Arguments**

1. `path: string`

**Returns** `Promise<T = any>`

## FileSystemReader class

Extends [`FileSystem` class](#filesystem-class)

### new FileSystemReader()

**Arguments**

1. [`params: FileSystemReaderParams`](#filesystemreaderparams)

### .pullSync\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`FileSystemPullSyncState`](#filesystempullsyncstate) allowing to keep track of the pulling state

**Returns** `BehaviorSubject<FileSystemPullSyncState>`

### .start()

Starts polling changes at the given interval `period` or using the class parameter

**Arguments**

1. `period?: number`

**Returns** `void`

### .stop()

Stops polling changes

**Returns** `void`

### .pull()

Fetches the latest contents of the file system from the feed

**Returns** `Promise<void>`

## FileSystemWriter class

Extends [`FileSystem` class](#filesystem-class)

### new FileSystemWriter()

**Arguments**

1. [`params: FileSystemWriterParams`](#filesystemwriterparams)

### .changes\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`FileSystemChanges`](#filesystemchanges) allowing to keep track of the changes sync status

**Returns** `BehaviorSubject<FileSystemChanges>`

### .pullSync\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`FileSystemPullSyncState`](#filesystempullsyncstate) allowing to keep track of the pulling state

**Returns** `BehaviorSubject<FileSystemPullSyncState>`

### .pushSync\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`FileSystemPushSyncState`](#filesystempullsyncstate) allowing to keep track of the pushing state

**Returns** `BehaviorSubject<FileSystemPushSyncState>`

### .initialize()

Pulls the existing (remote) contents of the file system

> If the `files` haven't been provided in the constructor and the feed has been written before, this method should be called before using any of the methods mutating the local state to make sure the local and remote state are the same

**Returns** `Promise<void>`

### .start()

Starts pushing changes at the given interval `period` or using the class parameter

**Arguments**

1. `period?: number`

**Returns** `void`

### .stop()

Stops pushing changes

**Returns** `void`

### .push()

Pushes the local file system state to the feed

**Returns** `Promise<void>`

### .setFile()

Writes the provided [`FileData`](api-core.md#filedata) at the given `path` in the local state

**Arguments**

1. `path: string`
1. [`file: FileData`](api-core.md#filedata)

**Returns** `void`

### .removeFile()

**Arguments**

1. `path: string`

**Returns** `boolean` whether the local state has changed or not

### .moveFile()

**Arguments**

1. `fromPath: string`
1. `toPath: string`

**Returns** `boolean` whether the local state has changed or not

### .uploadFile()

Uploads the provided `data` and writes its [`FileData`](api-core.md#filedata) at the given `path` in the local state

**Arguments**

1. `path: string`
1. `data: string | Buffer | Readable | Record<string, any>`
1. [`params?: FileUploadParams`](#fileuploadparams)

**Returns** [`Promise<FileData>`](api-core.md#filedata)

## InboxAgent class

### new InboxAgent()

**Arguments**

1. [`params: InboxAgentParams`](#inboxagentparams)

### .messages

**Returns** [`Array<MessageData>`](api-core.md#messagedata) the messages collected in the inbox

### .newMessage\$

[`Subject`](https://rxjs.dev/api/index/class/Subject) of [`MessageData`](api-core.md#messagedata) allowing to keep track of incoming messages

**Returns** `Subject<MessageData>`

### .state\$

[`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) of [`InboxState`](#inboxstate) allowing to keep track of the inbox state

**Returns** `Subject<MessageData>`

### .start()

Starts polling for new messages

**Returns** `void`

### .stop()

Stops polling for new messages

**Returns** `void`

### .isWriter()

Checks whether the given `key` is the writer of the inbox or not

**Arguments**

1. `key: string`

**Returns** `boolean`

### .setWriter()

Replaces the inbox writer's key if different from the existing one

**Arguments**

1. `key: string`

**Returns** `boolean` whether the key has been changed

## InboxesAgent class

### new InboxesAgent()

**Arguments**

1. [`params: InboxesAgentParams`](#inboxesagentparams)

### .inboxes

**Returns** `Record<string, InboxAgent>` the [`InboxAgent`](#inboxagent-class) instances keyed by their label

### .newMessage\$

[`Subject`](https://rxjs.dev/api/index/class/Subject) of [`InboxNewMessageData`](#inboxnewmessagedata) allowing to keep track of incoming messages in all listening inboxes

**Returns** `Subject<InboxNewMessageData>`

### .startAll()

Starts polling for new messages in all inboxes

**Returns** `void`

### .stopAll()

Stops polling for new messages in all inboxes

**Returns** `void`

### .hasInbox()

**Arguments**

1. `label: string`

**Returns** `boolean`

### .getInbox()

Returns the [`InboxAgent`](#inboxagent-class) instance with the given `label` if existing, `null` otherwise

**Arguments**

1. `label: string`

**Returns** `InboxAgent | null`

### .setInbox()

**Arguments**

1. `label: string`
1. [`inbox: InboxAgent`](#inboxagent-class)

**Returns** `void`

### .addInbox()

**Arguments**

1. `label: string`
1. [`params: InboxesAgentInboxParams`](#inboxesaggentinboxparams)

**Returns** `void`

### .removeInbox()

**Arguments**

1. `label: string`

**Returns** `void`

### .changeInboxes()

Adds, removes and updates keys as needed using the given `mailboxes`

**Arguments**

1. [`mailboxes: MailboxesRecord`](api-core.md#mailboxesrecord)

**Returns** `void`

## OutboxesAgent class

### new OutboxesAgent()

**Arguments**

1. [`params: OutboxesAgentParams`](#outboxesagentparams)

### .outboxes

**Returns** [`Record<string, SendMessage>`](#sendmessage) the outboxes keyed by label

### .hasOutbox()

**Arguments**

1. `label: string`

**Returns** `boolean`

### .getOutbox()

Returns the [`SendMessage`](#sendmessage) function with the given `label` if existing, `null` otherwise

**Arguments**

1. `label: string`

**Returns** `SendMessage | null`

### .setOutbox()

**Arguments**

1. `label: string`
1. [`keyPair: KeyPair`](https://erebos.js.org/docs/secp256k1#keypair)

**Returns** `void`

### .addOutbox()

**Arguments**

1. `label: string`

**Returns** [`KeyPair`](https://erebos.js.org/docs/secp256k1#keypair) used to write the mailbox

### .removeOutbox()

**Arguments**

1. `label: string`

**Returns** `void`

### .sendMessage()

**Arguments**

1. `label: string`: label of the mailbox
1. [`message: MessageData`](api-core.md#messagedata)

**Returns** `Promise<string>` the chapter ID of the added message
