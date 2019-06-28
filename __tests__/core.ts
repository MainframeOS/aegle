import Bzz from '@erebos/api-bzz-node'
import { createKeyPair, sign } from '@erebos/secp256k1'
import getStream from 'get-stream'

import {
  // protocols
  readContact,
  writeContact,
  createMailboxPublisher,
  createMailboxReader,
  FileSystemReader,
  FileSystemWriter,
  downloadFile,
  uploadFile,
  createPeerPublisher,
  createPeerSubscriber,
  readPeerContact,
  writePeerContact,
  // channels
  getPublicAddress,
  getFeedReadParams,
  getFeedWriteParams,
  // constants
  CRYPTO_KEY_LENGTH,
  HEADER_MAX_SIZE,
  HEADER_SIZE_BYTES,
  // crypto
  createKey,
  createRandomBytes,
  decryptJSON,
  encryptJSON,
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
  test.todo('createFeedEntityReader()')
  test.todo('createFeedSubscriber()')
  test.todo('createTimelineDecoder()')
  test.todo('createReadTimeline()')
  test.todo('createTimelineLatestSubscriber()')
  test.todo('createTimelineLiveSubscriber()')
})

describe('crypto', () => {
  test('createRandomBytes()', async () => {
    const [someBytes, otherBytes] = await Promise.all([
      createRandomBytes(16),
      createRandomBytes(16),
    ])
    expect(someBytes.length).toBe(16)
    expect(otherBytes.length).toBe(16)
    expect(someBytes.equals(otherBytes)).toBe(false)
  })

  test('createKey()', async () => {
    const [key1, key2] = await Promise.all([createKey(), createKey()])
    expect(key1.length).toBe(CRYPTO_KEY_LENGTH)
    expect(key2.length).toBe(CRYPTO_KEY_LENGTH)
    expect(key1.equals(key2)).toBe(false)
  })

  test('encrypts and decrypts JSON', async () => {
    const key = await createKey()
    const data = { hello: 'test' }
    const payload = await encryptJSON('aes-256-gcm', key, data)
    const decrypted = await decryptJSON(key, payload)
    expect(decrypted).toEqual(data)

    const otherKey = await createKey()
    await expect(decryptJSON(otherKey, payload)).rejects.toThrow(
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
  const bzz = new Bzz({
    url: 'http://localhost:8500',
    signBytes: async (bytes, key) => sign(bytes, key),
  })

  test('contact', async () => {
    const aliceKeyPair = createKeyPair()
    const bobKeyPair = createKeyPair()

    const sendContact = {
      profile: {
        displayName: 'Alice',
      },
    }

    // Write Alice -> Bob contact using Alice's private key and Bob's public key
    await writeContact(
      {
        bzz,
        keyPair: aliceKeyPair,
        contactKey: bobKeyPair.getPublic('hex'),
      },
      sendContact,
    )

    // Read Alice -> Bob contact using Alice's public key and Bob's private key
    const receivedContact = await readContact({
      bzz,
      keyPair: bobKeyPair,
      contactKey: aliceKeyPair.getPublic('hex'),
    })
    expect(receivedContact).toEqual(sendContact)
  })

  test('messaging', async done => {
    jest.setTimeout(10000)

    const aliceMailboxKeyPair = createKeyPair()
    const bobKeyPair = createKeyPair()

    const publish = createMailboxPublisher({
      bzz,
      keyPair: aliceMailboxKeyPair,
      reader: bobKeyPair.getPublic('hex'),
    })

    const firstMessage = { title: 'test', body: 'first' }
    const chapter = await publish(firstMessage)

    const reader = createMailboxReader({
      bzz,
      keyPair: bobKeyPair,
      writer: aliceMailboxKeyPair.getPublic('hex'),
    })

    const firstChapter = await reader.getLatestChapter()
    expect(firstChapter).toBeDefined()
    expect(firstChapter.content.data).toEqual(firstMessage)

    const secondMessage = { thread: chapter.id, title: 'test', body: 'second' }

    const sub = reader.pollLatestChapter({ interval: 1000 }).subscribe({
      next: chapter => {
        const { data } = chapter.content
        if (data.thread != null) {
          expect(data).toEqual(secondMessage)
          sub.unsubscribe()
          done()
        }
      },
      error: err => {
        sub.unsubscribe()
        throw err
      },
    })

    await publish(secondMessage)
  })

  describe('fileSystem', () => {
    test('uploadFile() and downloadFile()', async () => {
      const data = 'Hello test'
      const file = await uploadFile(bzz, data, { encrypt: true })
      expect(file.hash).toBeDefined()
      expect(file.encryption).toBeDefined()

      const res = await downloadFile(bzz, file)
      const text = await getStream(res)
      expect(text).toBe(data)
    })

    test('FileSystemReader and FileSystemWriter classes', async () => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const writer = new FileSystemWriter({
        bzz,
        keyPair: aliceKeyPair,
        reader: bobKeyPair.getPublic('hex'),
        files: {},
      })
      const reader = new FileSystemReader({
        bzz,
        keyPair: bobKeyPair,
        writer: aliceKeyPair.getPublic('hex'),
      })

      const filePath = '/hello.txt'
      const fileText = 'Hello there!'

      await writer.uploadFile(filePath, fileText, { encrypt: true })
      await writer.push()

      await reader.pull()
      expect(reader.hasFile(filePath)).toBe(true)

      const text = await reader.downloadText(filePath)
      expect(text).toBe(fileText)

      const otherPath = '/other.json'
      const otherData = { hello: 'Bob' }

      expect(reader.hasFile(otherPath)).toBe(false)
      await writer.uploadFile(otherPath, otherData, {
        encrypt: true,
      })
      await writer.push()

      await reader.pull()
      expect(reader.hasFile(otherPath)).toBe(true)

      const data = await reader.downloadJSON(otherPath)
      expect(data).toEqual(otherData)
    })
  })

  test('peer', async done => {
    const keyPair = createKeyPair()
    const pubKey = keyPair.getPublic('hex')
    const peer = {
      publicKey: pubKey,
      profile: {
        displayName: 'Alice',
      },
    }

    const subscription = createPeerSubscriber({
      bzz,
      peer: pubKey,
      options: {
        interval: 1000,
      },
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

  test('peerContact', async () => {
    const aliceKeyPair = createKeyPair()
    const bobKeyPair = createKeyPair()

    const sendPeerContact = {
      contactPublicKey: createKeyPair().getPublic('hex'),
      peerAddress: getPublicAddress(aliceKeyPair),
    }

    // Write Alice -> Bob peerContact using Alice's private key and Bob's public key
    await writePeerContact(
      {
        bzz,
        keyPair: aliceKeyPair,
        peerKey: bobKeyPair.getPublic('hex'),
      },
      sendPeerContact,
    )

    // Read Alice -> Bob peerContact using Alice's public key and Bob's private key
    const receivedPeerContact = await readPeerContact({
      bzz,
      keyPair: bobKeyPair,
      peerKey: aliceKeyPair.getPublic('hex'),
    })
    expect(receivedPeerContact).toEqual(sendPeerContact)
  })
})
