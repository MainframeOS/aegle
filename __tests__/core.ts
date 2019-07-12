import { Bzz, getFeedTopic } from '@erebos/api-bzz-node'
import { createHex } from '@erebos/hex'
import { hash } from '@erebos/keccak256'
import { createKeyPair, sign } from '@erebos/secp256k1'
import getStream from 'get-stream'

import {
  // protocols
  actor,
  contact,
  fileSystem,
  mailbox,
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
} from '../packages/core'

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

  test('actor protocol', async done => {
    const keyPair = createKeyPair()
    const pubKey = keyPair.getPublic('hex')
    const actorData = {
      publicKey: pubKey,
      profile: {
        displayName: 'Alice',
      },
    }

    const subscription = actor
      .createSubscriber({
        bzz,
        actor: pubKey,
        options: {
          interval: 1000,
        },
      })
      .subscribe({
        next: loadedActor => {
          expect(loadedActor).toEqual(actorData)
          subscription.unsubscribe()
          done()
        },
      })

    const publish = actor.createPublisher({ bzz, keyPair })
    await publish(actorData)
  })

  describe('contact protocols', () => {
    test('firstContact', async () => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const sendFirstContact = {
        contactPublicKey: createKeyPair().getPublic('hex'),
        actorAddress: getPublicAddress(aliceKeyPair),
      }

      // Write Alice -> Bob first contact using Alice's private key and Bob's public key
      await contact.writeFirstContact(
        {
          bzz,
          keyPair: aliceKeyPair,
          actorKey: bobKeyPair.getPublic('hex'),
        },
        sendFirstContact,
      )

      // Read Alice -> Bob first contact using Alice's public key and Bob's private key
      const receivedFirstContact = await contact.readFirstContact({
        bzz,
        keyPair: bobKeyPair,
        actorKey: aliceKeyPair.getPublic('hex'),
      })
      expect(receivedFirstContact).toEqual(sendFirstContact)
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
      await contact.write(
        {
          bzz,
          keyPair: aliceKeyPair,
          contactKey: bobKeyPair.getPublic('hex'),
        },
        sendContact,
      )

      // Read Alice -> Bob contact using Alice's public key and Bob's private key
      const receivedContact = await contact.read({
        bzz,
        keyPair: bobKeyPair,
        contactKey: aliceKeyPair.getPublic('hex'),
      })
      expect(receivedContact).toEqual(sendContact)
    })
  })

  test('mailbox protocol', async done => {
    jest.setTimeout(10000)

    const aliceMailboxKeyPair = createKeyPair()
    const bobKeyPair = createKeyPair()

    const publish = mailbox.createPublisher({
      bzz,
      keyPair: aliceMailboxKeyPair,
      reader: bobKeyPair.getPublic('hex'),
    })

    const firstMessage = { title: 'test', body: 'first' }
    const chapter = await publish(firstMessage)

    const reader = mailbox.createReader({
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

  describe('fileSystem protocol', () => {
    test('fileSystem.uploadFile() and fileSystem.downloadFile()', async () => {
      const data = 'Hello test'
      const file = await fileSystem.uploadFile(bzz, data, { encrypt: true })
      expect(file.hash).toBeDefined()
      expect(file.encryption).toBeDefined()

      const res = await fileSystem.downloadFile(bzz, file)
      const text = await getStream(res)
      expect(text).toBe(data)
    })

    test('fileSystem.Reader and fileSystem.Writer classes', async () => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const writer = new fileSystem.Writer({
        bzz,
        keyPair: aliceKeyPair,
        reader: bobKeyPair.getPublic('hex'),
        files: {},
      })
      const reader = new fileSystem.Reader({
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
})

test('end-to-end flow', async () => {
  jest.setTimeout(30000)

  const bzz = new Bzz({
    url: 'http://localhost:8500',
    signBytes: async (bytes, key) => sign(bytes, key),
  })

  // Create key pairs for Alice and Bob
  const aliceKeyPair = createKeyPair()
  const aliceAddress = getPublicAddress(aliceKeyPair)
  const bobKeyPair = createKeyPair()
  const bobAddress = getPublicAddress(bobKeyPair)

  // Alice and Bob publish their public actor data to advertise their public keys
  await Promise.all([
    actor.write(
      { bzz, keyPair: aliceKeyPair },
      {
        profile: { displayName: 'Alice' },
        publicKey: aliceKeyPair.getPublic('hex'),
      },
    ),
    actor.write(
      { bzz, keyPair: bobKeyPair },
      {
        profile: { displayName: 'Bob' },
        publicKey: bobKeyPair.getPublic('hex'),
      },
    ),
  ])

  // Actor data can be loaded using their address after it's been published
  const [aliceActor, bobActor] = await Promise.all([
    actor.read({ bzz, actor: aliceAddress }),
    actor.read({ bzz, actor: bobAddress }),
  ])
  if (aliceActor == null) {
    throw new Error('Alice actor not found')
  }
  if (bobActor == null) {
    throw new Error('Bob actor not found')
  }

  // Based on these advertised public keys, they can publish an encrypted first contact payload
  const aliceBobKeyPair = createKeyPair()
  const bobAliceKeyPair = createKeyPair()
  await Promise.all([
    // Alice -> Bob
    contact.writeFirstContact(
      { bzz, keyPair: aliceKeyPair, actorKey: bobActor.publicKey },
      {
        contactPublicKey: aliceBobKeyPair.getPublic('hex'),
        actorAddress: aliceAddress,
      },
    ),
    // Bob -> Alice
    contact.writeFirstContact(
      { bzz, keyPair: bobKeyPair, actorKey: aliceActor.publicKey },
      {
        contactPublicKey: bobAliceKeyPair.getPublic('hex'),
        actorAddress: bobAddress,
      },
    ),
  ])

  // Both Alice and Bob can retrieve each other's contact public key, they will use for future exchanges
  const [aliceBobFirstContact, bobAliceFirstContact] = await Promise.all([
    contact.readFirstContact({
      bzz,
      keyPair: aliceKeyPair,
      actorKey: bobActor.publicKey,
    }),
    contact.readFirstContact({
      bzz,
      keyPair: bobKeyPair,
      actorKey: aliceActor.publicKey,
    }),
  ])
  if (aliceBobFirstContact == null) {
    throw new Error('Alice - Bob first contact not found')
  }
  if (bobAliceFirstContact == null) {
    throw new Error('Bob - Alice first contact not found')
  }

  // Create a FileSystem where Alice shares files with Bob
  const aliceFilesKeyPair = createKeyPair()
  const aliceBobFS = new fileSystem.Writer({
    bzz,
    keyPair: aliceFilesKeyPair,
    reader: aliceBobFirstContact.contactPublicKey,
  })

  // Push a file to Alice's FS and share the FS public key with Bob in their contact channel
  await aliceBobFS.uploadFile('/readme.txt', 'Hello!', { encrypt: true })
  await Promise.all([
    aliceBobFS.push(),
    contact.write(
      {
        bzz,
        keyPair: aliceBobKeyPair,
        contactKey: aliceBobFirstContact.contactPublicKey,
      },
      { fileSystemKey: aliceFilesKeyPair.getPublic('hex') },
    ),
  ])

  // Bob can now read the contact information from Alice
  const bobAliceContact = await contact.read({
    bzz,
    keyPair: bobAliceKeyPair,
    contactKey: bobAliceFirstContact.contactPublicKey,
  })
  if (bobAliceContact == null || bobAliceContact.fileSystemKey == null) {
    throw new Error('Bob - Alice FS not found')
  }

  // Bob can read from Alice's FileSystem and check the file
  const bobAliceFS = new fileSystem.Reader({
    bzz,
    keyPair: bobAliceKeyPair,
    writer: bobAliceContact.fileSystemKey,
  })
  await bobAliceFS.pull()
  const fileFromAlice = bobAliceFS.getFile('/readme.txt')
  expect(fileFromAlice).toBeDefined()

  // Now let's add a third user, Chloe, who is going to interact with Bob
  const chloeKeyPair = createKeyPair()
  const chloeAddress = getPublicAddress(chloeKeyPair)
  const chloeBobKeyPair = createKeyPair()

  // Publish Chloe's actor and first contact payloads using Bob's public key
  await Promise.all([
    actor.write(
      { bzz, keyPair: chloeKeyPair },
      {
        profile: { displayName: 'Chloe' },
        publicKey: chloeKeyPair.getPublic('hex'),
      },
    ),
    contact.writeFirstContact(
      { bzz, keyPair: chloeKeyPair, actorKey: bobActor.publicKey },
      {
        contactPublicKey: chloeBobKeyPair.getPublic('hex'),
        actorAddress: chloeAddress,
      },
    ),
  ])

  // Bob can now access Chloe's actor and first contact data
  const chloeActor = await actor.read({ bzz, actor: chloeAddress })
  if (chloeActor == null) {
    throw new Error('Chloe actor not found')
  }

  const bobChloeFirstContact = await contact.readFirstContact({
    bzz,
    keyPair: bobKeyPair,
    actorKey: chloeActor.publicKey,
  })
  if (bobChloeFirstContact == null) {
    throw new Error('Bob - Chloe first contact not found')
  }

  // Create Bob -> Chloe mailbox and contact
  const bobChloeKeyPair = createKeyPair()
  const bobMailboxKeyPair = createKeyPair()
  const publishMessage = mailbox.createPublisher({
    bzz,
    keyPair: bobMailboxKeyPair,
    reader: bobChloeFirstContact.contactPublicKey,
  })

  await Promise.all([
    publishMessage({
      title: 'Hello',
      body: 'See attachment',
      // Bob is attaching the metadata of the file Alice shared with him
      attachments: [{ name: 'readme.txt', file: fileFromAlice }],
    }),
    contact.write(
      {
        bzz,
        keyPair: bobChloeKeyPair,
        contactKey: bobChloeFirstContact.contactPublicKey,
      },
      { mailboxes: { outbox: bobMailboxKeyPair.getPublic('hex') } },
    ),
    contact.writeFirstContact(
      { bzz, keyPair: bobKeyPair, actorKey: chloeActor.publicKey },
      {
        contactPublicKey: bobChloeKeyPair.getPublic('hex'),
        actorAddress: bobAddress,
      },
    ),
  ])

  // Chloe reads Bob's first contact and contact payloads
  const chloeBobFirstContact = await contact.readFirstContact({
    bzz,
    keyPair: chloeKeyPair,
    actorKey: bobActor.publicKey,
  })
  if (chloeBobFirstContact == null) {
    throw new Error('Chloe - Bob first contact not found')
  }

  const chloeBobContact = await contact.read({
    bzz,
    keyPair: chloeBobKeyPair,
    contactKey: chloeBobFirstContact.contactPublicKey,
  })
  if (chloeBobContact == null || chloeBobContact.mailboxes == null) {
    throw new Error('Chloe - Bob mailboxes not found')
  }

  // Chloe reads from the mailbox Bob has created and loads the message sent
  const reader = mailbox.createReader({
    bzz,
    keyPair: chloeBobKeyPair,
    writer: chloeBobContact.mailboxes.outbox,
  })
  const chapter = await reader.getLatestChapter()
  if (chapter == null) {
    throw new Error('Message from Bob not found')
  }

  const attachment = chapter.content.data.attachments[0]
  expect(attachment).toBeDefined()

  // Chloe downloads the file originally shared by Alice
  const fileStream = await fileSystem.downloadFile(bzz, attachment.file)
  const text = await getStream(fileStream)
  expect(text).toBe('Hello!')
})
