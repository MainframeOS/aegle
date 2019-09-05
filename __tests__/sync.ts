import { Bzz, getFeedTopic } from '@erebos/api-bzz-node'
import { createHex } from '@erebos/hex'
import { hash } from '@erebos/keccak256'
import { createKeyPair, sign } from '@erebos/secp256k1'

import { Core, ACTOR_NAME } from '@aegle/core'
import {
  Sync,
  getFeedReadParams,
  getFeedWriteParams,
  getPublicAddress,
  getSharedTopic,
} from '@aegle/sync'

describe('sync', () => {
  test('getPublicAddress() returns the address from a KeyPair', () => {
    const keyPair = createKeyPair()
    const address = getPublicAddress(keyPair)
    expect(address).toMatch(/^0x[0-9a-f]{40}$/)
  })

  test('getSharedTopic() hashes the provided encryption key as topic', () => {
    const key = Buffer.alloc(32)
    const withName = getSharedTopic(key, 'hello')
    expect(withName).toMatch(/^0x[0-9a-f]{64}$/)
    const withoutName = getSharedTopic(key)
    expect(withoutName).toMatch(/^0x[0-9a-f]{64}$/)
    expect(withName).not.toBe(withoutName)
  })

  describe('getFeedReadParams() returns the parameter to read a given feed', () => {
    test('for a simple case (publisher public key only)', () => {
      const publisher = createKeyPair()
      const params = getFeedReadParams(publisher.getPublic('hex'))
      expect(params).toEqual({
        feed: { user: getPublicAddress(publisher) },
        encryptionKey: undefined,
      })
    })

    test('with a feed name', () => {
      const publisher = createKeyPair()
      const params = getFeedReadParams(publisher.getPublic('hex'), 'hello')
      expect(params).toEqual({
        feed: { user: getPublicAddress(publisher), name: 'hello' },
        encryptionKey: undefined,
      })
    })

    test('with a subscriber key pair', () => {
      const publisher = createKeyPair()
      const subscriber = createKeyPair()
      const params = getFeedReadParams(
        publisher.getPublic('hex'),
        'hello',
        subscriber,
      )
      const encryptionKey = subscriber.derive(publisher.getPublic()).toBuffer()
      expect(params).toEqual({
        feed: {
          user: getPublicAddress(publisher),
          topic: getFeedTopic({
            name: 'hello',
            topic: createHex(hash(encryptionKey)).value,
          }),
        },
        encryptionKey,
      })
    })

    test('publisher must be a public key when the subscriber key pair is provided', () => {
      const subscriber = createKeyPair()
      expect(() => {
        getFeedReadParams('invalid', 'hello', subscriber)
      }).toThrow(
        'writer argument must be a public key when keyPair is provided to derive the shared key',
      )
    })
  })

  describe('getFeedWriteParams() returns the parameter to write a given feed', () => {
    test('for a simple case (publisher key pair only)', () => {
      const keyPair = createKeyPair()
      const params = getFeedWriteParams(keyPair)
      expect(params).toEqual({
        feed: { user: getPublicAddress(keyPair) },
        encryptionKey: undefined,
        signParams: keyPair.getPrivate(),
      })
    })

    test('with a feed name', () => {
      const keyPair = createKeyPair()
      const params = getFeedWriteParams(keyPair, 'hello')
      expect(params).toEqual({
        feed: { user: getPublicAddress(keyPair), name: 'hello' },
        encryptionKey: undefined,
        signParams: keyPair.getPrivate(),
      })
    })

    test('with a subscriber public key', () => {
      const publisher = createKeyPair()
      const subscriber = createKeyPair()
      const params = getFeedWriteParams(
        publisher,
        'hello',
        subscriber.getPublic('hex'),
      )
      const encryptionKey = publisher.derive(subscriber.getPublic()).toBuffer()
      expect(params).toEqual({
        feed: {
          user: getPublicAddress(publisher),
          topic: getFeedTopic({
            name: 'hello',
            topic: createHex(hash(encryptionKey)).value,
          }),
        },
        encryptionKey,
        signParams: publisher.getPrivate(),
      })
    })
  })

  describe('Sync class', () => {
    const sync = new Sync({
      bzz: new Bzz({
        url: 'http://localhost:8500',
        signBytes: (bytes, key) => Promise.resolve(sign(bytes, key)),
      }),
      core: new Core(),
    })
    const aliceKP = createKeyPair()
    const alicePubKey = aliceKP.getPublic('hex')
    const bobKP = createKeyPair()
    const bobPubKey = bobKP.getPublic('hex')
    const testData = {
      publicKey:
        '04754036d637dcdc2c02a6466a38a7b37ae4bae4c207a9a6b5ceb76aa9d7c1a41c6d50c00d21c2943362c8463a6a736c8b37e1ca421cbb7f45428a77fd59b0f44e',
    }

    test('writeFeed() and readFeed()', async () => {
      const name = 'test-1'
      await sync.writeFeed(
        { entityType: ACTOR_NAME, keyPair: aliceKP, reader: bobPubKey, name },
        testData,
      )
      const data = await sync.readFeed({
        entityType: ACTOR_NAME,
        keyPair: bobKP,
        writer: alicePubKey,
        name,
      })
      expect(data).toEqual(testData)
    })

    test('createFeedPublisher() and createFeedReader()', async () => {
      const name = 'test-2'
      const publish = sync.createFeedPublisher({
        entityType: ACTOR_NAME,
        keyPair: aliceKP,
        reader: bobPubKey,
        name,
      })
      const read = sync.createFeedReader({
        entityType: ACTOR_NAME,
        keyPair: bobKP,
        writer: alicePubKey,
        name,
      })
      await publish(testData)
      const data = await read()
      expect(data).toEqual(testData)
    })

    test('createFeedSubscriber()', async done => {
      const name = 'test-3'
      const publish = sync.createFeedPublisher({
        entityType: ACTOR_NAME,
        keyPair: aliceKP,
        reader: bobPubKey,
        name,
      })

      const sequence = [
        { ...testData, profile: { displayName: 'Alice1' } },
        { ...testData, profile: { displayName: 'Alice2' } },
        { ...testData, profile: { displayName: 'Alice3' } },
      ]
      let i = 0

      const sub = sync
        .createFeedSubscriber({
          entityType: ACTOR_NAME,
          keyPair: bobKP,
          writer: alicePubKey,
          name,
          options: {
            interval: 1000,
          },
        })
        .subscribe({
          next: async payload => {
            expect(payload.data).toEqual(sequence[i++])
            if (i === sequence.length) {
              sub.unsubscribe()
              done()
            } else {
              await publish(sequence[i])
            }
          },
          error: err => {
            done(err)
          },
        })

      await publish(sequence[0])
    })

    test('createTimelinePublisher() and createReadTimeline()', async done => {
      const name = 'test-4'

      const publish = sync.createTimelinePublisher({
        entityType: ACTOR_NAME,
        keyPair: aliceKP,
        reader: bobPubKey,
        name,
      })
      const reader = sync.createReadTimeline({
        entityType: ACTOR_NAME,
        keyPair: bobKP,
        writer: alicePubKey,
        name,
      })

      await publish(testData)
      const firstChapter = await reader.getLatestChapter()
      expect(firstChapter.content.data).toEqual(testData)

      const sequence = [
        { ...testData, profile: { displayName: 'Alice1' } },
        { ...testData, profile: { displayName: 'Alice2' } },
        { ...testData, profile: { displayName: 'Alice3' } },
      ]
      let i = 0

      await publish(sequence[0])

      const sub = reader.pollLatestChapter({ interval: 1000 }).subscribe({
        next: async chapter => {
          expect(chapter.content.data).toEqual(sequence[i++])
          if (i === sequence.length) {
            sub.unsubscribe()
            done()
          } else {
            await publish(sequence[i])
          }
        },
        error: err => {
          done(err)
        },
      })
    })
  })
})
