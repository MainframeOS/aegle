import Bzz from '@erebos/api-bzz-node'
import { createKeyPair, sign } from '@erebos/secp256k1'

import {
  // protocols
  createPeerPublisher,
  createPeerSubscriber,
  // channels
  getPublicAddress,
  getFeedReadParams,
  getFeedWriteParams,
  // constants
  HEADER_MAX_SIZE,
  HEADER_SIZE_BYTES,
  // crypto
  randomBytesAsync,
  decrypt,
  encrypt,
  // encoding
  encodeHeaderSize,
  decodeHeaderSize,
} from '../packages/core/src'

describe('channels', () => {
  test('getPublicAddress() returns the address from a KeyPair', () => {
    const keyPair = createKeyPair()
    const address = getPublicAddress(keyPair)
    expect(address).toMatch(/^0x[0-9a-f]{40}$/)
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
      const publisher = createKeyPair(
        '1d64177e47720f8a23b96815400a4375fb069f9245bbb219107e250c531d0815',
      )
      const subscriber = createKeyPair(
        'b80c8c86f96a6137629b34126434d852bdbeb0f7f2ca0b81f4321163e97c2eb0',
      )
      const params = getFeedReadParams(
        publisher.getPublic('hex'),
        'hello',
        subscriber,
      )
      expect(params).toEqual({
        feed: {
          user: getPublicAddress(publisher),
          topic:
            '0x637d335c780a0685255fc84f6495d05de5732a06000000000000000000000000',
        },
        encryptionKey: Buffer.from(
          'GULmdGUtw7mLiJa3sxRmcYZfX3iASunp/3sDadsBMrA=',
          'base64',
        ),
      })
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
      const publisher = createKeyPair(
        '1d64177e47720f8a23b96815400a4375fb069f9245bbb219107e250c531d0815',
      )
      const subscriber = createKeyPair(
        'b80c8c86f96a6137629b34126434d852bdbeb0f7f2ca0b81f4321163e97c2eb0',
      )
      const params = getFeedWriteParams(
        publisher,
        'hello',
        subscriber.getPublic('hex'),
      )
      expect(params).toEqual({
        feed: {
          user: getPublicAddress(publisher),
          topic:
            '0x637d335c780a0685255fc84f6495d05de5732a06000000000000000000000000',
        },
        encryptionKey: Buffer.from(
          'GULmdGUtw7mLiJa3sxRmcYZfX3iASunp/3sDadsBMrA=',
          'base64',
        ),
        signParams: publisher.getPrivate(),
      })
    })
  })

  test.todo('createEntityPublisher()')
  test.todo('createFeedPublisher()')
  test.todo('createTimelinePublisher()')
  test.todo('createFeedSubscriber()')
  test.todo('createTimelineDecoder()')
  test.todo('createReadTimeline()')
  test.todo('createTimelineLatestSubscriber()')
  test.todo('createTimelineLiveSubscriber()')
})

describe('crypto', () => {
  test('randomBytesAsync()', async () => {
    const [someBytes, otherBytes] = await Promise.all([
      randomBytesAsync(16),
      randomBytesAsync(16),
    ])
    expect(someBytes.length).toBe(16)
    expect(otherBytes.length).toBe(16)
    expect(someBytes.equals(otherBytes)).toBe(false)
  })

  test('encrypts and decrypts', async () => {
    const key = await randomBytesAsync(32)
    const data = { hello: 'test' }
    const payload = await encrypt('aes-256-gcm', key, data)
    const decrypted = await decrypt(key, payload)
    expect(decrypted).toEqual(data)

    const otherKey = await randomBytesAsync(32)
    await expect(decrypt(otherKey, payload)).rejects.toThrow(
      'Unsupported state or unable to authenticate data',
    )
  })
})

describe('encoding', () => {
  test('encodes header size', () => {
    const encoded = encodeHeaderSize(1000)
    expect(encoded).toHaveLength(HEADER_SIZE_BYTES)

    expect(() => {
      encodeHeaderSize(-1)
    }).toThrow('Out of bounds header size')
    expect(() => {
      encodeHeaderSize(HEADER_MAX_SIZE + 1)
    }).toThrow('Out of bounds header size')
  })

  test('decodes header size', () => {
    const encoded = encodeHeaderSize(1000)
    expect(decodeHeaderSize(encoded)).toBe(1000)

    expect(() => {
      decodeHeaderSize(Buffer.alloc(HEADER_SIZE_BYTES + 1))
    }).toThrow('Invalid input')
  })
})

describe('protocols', () => {
  test('peer', async done => {
    const bzz = new Bzz({
      url: 'http://localhost:8500',
      signBytes: async (bytes, key) => sign(bytes, key),
    })
    const keyPair = createKeyPair()
    const pubKey = keyPair.getPublic('hex')
    const peer = {
      publicKey: pubKey,
      profile: {
        displayName: 'Alice',
      },
    }

    const subscription = createPeerSubscriber(bzz, pubKey, {
      interval: 1000,
    }).subscribe({
      next: loadedPeer => {
        expect(loadedPeer).toEqual(peer)
        subscription.unsubscribe()
        done()
      },
    })

    const publish = createPeerPublisher(bzz, keyPair)
    await publish(peer)
  })
})
