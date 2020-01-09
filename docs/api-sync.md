# Sync API

## Installation

```sh
npm install @aegle/sync
```

## Interfaces and types

### FeedReadParams

Uses [`FeedParams` interface](https://erebos.js.org/docs/api-bzz#feedparams)

```ts
interface FeedReadParams {
  feed: FeedParams
  encryptionKey?: Buffer
}
```

### FeedWriteParams

Extends [`FeedReadParams` interface](#feedreaderparams)

```ts
interface FeedWriteParams extends FeedReadParams {
  signParams?: any
}
```

### ChannelParams

```ts
interface ChannelParams {
  entityType: string
  name?: string
}
```

### WriterParams

Extends [`ChannelParams`](#channelparams)
Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair) and [`UploadOptions` interface](https://erebos.js.org/docs/api-bzz#uploadoptions)

```ts
interface WriterParams extends ChannelParams {
  keyPair: KeyPair
  options?: UploadOptions
  reader?: string
}
```

### ReaderParams

Extends [`ChannelParams`](#channelparams)
Uses [`KeyPair` class](https://erebos.js.org/docs/secp256k1#keypair)

```ts
interface ReaderParams extends ChannelParams {
  writer: string
  keyPair?: KeyPair
}
```

### FeedReadParams

Extends [`ReaderParams`](#readerparams)
Uses [`PollFeedContentOptions`](https://erebos.js.org/docs/api-bzz#pollfeedcontentoptions)

```ts
interface SubscriberParams extends ReaderParams {
  options: PollFeedContentOptions
}
```

### SyncConfig

Uses [`Bzz` class](https://erebos.js.org/docs/api-bzz) and [`Core` class](api-core.md#core-class)

```ts
interface SyncConfig {
  bzz: Bzz
  core?: Core
}
```

## Sync class

### new Sync()

**Arguments**

1.  [`config: SyncConfig`](#syncconfig)

### .writeFeed()

**Arguments**

1.  [`params: WriterParams`](#writerparams)
1.  `data: T`

**Returns** `Promise<string>`

### .createFeedPublisher()

**Arguments**

1.  [`params: WriterParams`](#writerparams)

**Returns** `(entity: T) => Promise<string>`

### .createTimelineWriter()

**Arguments**

1.  [`params: WriterParams`](#writerparams)

**Returns** [`TimelineWriter<T>`](https://erebos.js.org/docs/timeline-api#timelinewriter-class)

### .createTimelinePublisher()

Uses [`Chapter` interface](https://erebos.js.org/docs/timeline-api#chapter) and [`EntityPayload` interface](api-core.md#entitypayload)

**Arguments**

1.  [`params: WriterParams`](#writerparams)

**Returns** `(data: T) => Promise<Chapter<EntityPayload<T>>>`

### .readFeed()

**Arguments**

1.  [`params: ReaderParams`](#readerparams)

**Returns** `Promise<T | null>`

### .createFeedReader()

**Arguments**

1.  [`params: ReaderParams`](#readerparams)

**Returns** `() => Promise<T | null>`

### .createFeedSubscriber()

Uses [`Observable` class](https://rxjs.dev/api/index/class/Observable) and [`EntityPayload` interface](api-core.md#entitypayload)

**Arguments**

1.  [`params: SubscriberParams`](#subscriberparams)

**Returns** `Observable<EntityPayload<T> | null>`

### .createTimelineReader()

Uses [`TimelineReader` class](https://erebos.js.org/docs/timeline-api#timelinereader-class) and [`EntityPayload` interface](api-core.md#entitypayload)

**Arguments**

1.  [`params: ReaderParams`](#readerparams)

**Returns** `TimelineReader<EntityPayload<T>>`
