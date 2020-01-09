import { Readable } from 'stream'
import { Bzz } from '@erebos/api-bzz-node'
import { createKeyPair, sign } from '@erebos/secp256k1'
// eslint-disable-next-line import/default
import getStream from 'get-stream'
import { BehaviorSubject, combineLatest } from 'rxjs'
import { filter, flatMap, map } from 'rxjs/operators'

import { Core, FilesRecord } from '@aegle/core'
import { Sync, getPublicAddress } from '@aegle/sync'
import {
  // actor
  createActorSubscriber,
  createActorWriter,
  writeActor,
  readActor,
  ActorAgent,
  // contact
  createFirstContactSubscriber,
  writeFirstContact,
  readFirstContact,
  createContactSubscriber,
  writeContact,
  readContact,
  ContactAgent,
  // messaging
  createMailboxWriter,
  createMailboxReader,
  InboxAgent,
  InboxState,
  InboxesAgent,
  OutboxesAgent,
  // fileSystem
  uploadFile,
  downloadFile,
  FileSystem,
  FileSystemWriter,
  FileSystemReader,
} from '@aegle/agent'

describe('agent', () => {
  const bzz = new Bzz({
    url: 'http://localhost:8500',
    signBytes: (bytes, key) => Promise.resolve(sign(bytes, key)),
  })
  const core = new Core()
  const sync = new Sync({ bzz, core })

  function toReadable(chunk: string | Buffer): Readable {
    return new Readable({
      read() {
        this.push(chunk)
        this.push(null)
      },
    })
  }

  describe('actor protocol', () => {
    test('writes and subscribes to an actor feed', async done => {
      const keyPair = createKeyPair()
      const pubKey = keyPair.getPublic('hex')
      const actorData = {
        publicKey: pubKey,
        profile: {
          displayName: 'Alice',
        },
      }

      const subscription = createActorSubscriber({
        sync,
        actor: pubKey,
        interval: 1000,
      }).subscribe({
        next: loadedActor => {
          expect(loadedActor).toEqual(actorData)
          subscription.unsubscribe()
          done()
        },
      })

      const write = createActorWriter({ sync, keyPair })
      await write(actorData)
    })

    describe('ActorAgent', () => {
      test('sets the actor address, contacts and file system', () => {
        const agent = new ActorAgent({
          sync,
          data: {
            actor: {
              keyPair: createKeyPair(),
            },
            fileSystemKeyPair: createKeyPair(),
          },
        })
        expect(agent.address).toBeDefined()
        expect(agent.contacts).toBeDefined()
        expect(agent.fileSystem).toBeInstanceOf(FileSystemWriter)
      })

      test('adds and removes contacts', async () => {
        const alice = new ActorAgent({
          sync,
          data: {
            actor: {
              keyPair: createKeyPair(),
            },
          },
        })

        const bob = new ActorAgent({
          sync,
          data: {
            actor: {
              keyPair: createKeyPair(),
            },
          },
        })

        await bob.publishActor()

        await alice.addContact(bob.address)
        expect(alice.hasContact(bob.address)).toBe(true)

        alice.removeContact(bob.address)
        expect(alice.hasContact(bob.address)).toBe(false)
      })
    })
  })

  describe('contact protocols', () => {
    test('writeFirstContact() and readFirstContact()', async () => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const sendFirstContact = {
        contactPublicKey: createKeyPair().getPublic('hex'),
        actorAddress: getPublicAddress(aliceKeyPair),
      }

      // Write Alice -> Bob first contact using Alice's private key and Bob's public key
      await writeFirstContact(
        {
          sync,
          keyPair: aliceKeyPair,
          actorKey: bobKeyPair.getPublic('hex'),
        },
        sendFirstContact,
      )

      // Read Alice -> Bob first contact using Alice's public key and Bob's private key
      const receivedFirstContact = await readFirstContact({
        sync,
        keyPair: bobKeyPair,
        actorKey: aliceKeyPair.getPublic('hex'),
      })
      expect(receivedFirstContact).toEqual(sendFirstContact)
    })

    test('createFirstContactSubscriber()', async done => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const sendFirstContact = {
        contactPublicKey: createKeyPair().getPublic('hex'),
        actorAddress: getPublicAddress(aliceKeyPair),
      }

      const sub = createFirstContactSubscriber({
        sync,
        keyPair: bobKeyPair,
        actorKey: aliceKeyPair.getPublic('hex'),
        interval: 1000,
      }).subscribe({
        next: data => {
          expect(data).toEqual(sendFirstContact)
          sub.unsubscribe()
          done()
        },
        error: err => {
          done(err)
        },
      })

      await writeFirstContact(
        {
          sync,
          keyPair: aliceKeyPair,
          actorKey: bobKeyPair.getPublic('hex'),
        },
        sendFirstContact,
      )
    })

    test('writeContact() and readContact()', async () => {
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
          sync,
          keyPair: aliceKeyPair,
          contactKey: bobKeyPair.getPublic('hex'),
        },
        sendContact,
      )

      // Read Alice -> Bob contact using Alice's public key and Bob's private key
      const receivedContact = await readContact({
        sync,
        keyPair: bobKeyPair,
        contactKey: aliceKeyPair.getPublic('hex'),
      })
      expect(receivedContact).toEqual(sendContact)
    })

    test('createContactSubscriber()', async done => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const sendContact = {
        profile: {
          displayName: 'Alice',
        },
      }

      const sub = createContactSubscriber({
        sync,
        keyPair: bobKeyPair,
        contactKey: aliceKeyPair.getPublic('hex'),
        interval: 1000,
      }).subscribe({
        next: data => {
          expect(data).toEqual(sendContact)
          sub.unsubscribe()
          done()
        },
        error: err => {
          done(err)
        },
      })

      await writeContact(
        {
          sync,
          keyPair: aliceKeyPair,
          contactKey: bobKeyPair.getPublic('hex'),
        },
        sendContact,
      )
    })

    describe('ContactAgent class', () => {
      test('establishes first contact if needed and provided', async done => {
        const aliceActorKeyPair = createKeyPair()
        const aliceContactKeyPair = createKeyPair()
        const bobActorKeyPair = createKeyPair()
        const bobContactKeyPair = createKeyPair()

        const alice = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(bobActorKeyPair),
              firstContact: {
                keyPair: aliceActorKeyPair,
                actorKey: bobActorKeyPair.getPublic('hex'),
              },
            },
            write: {
              keyPair: aliceContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        const bob = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(aliceActorKeyPair),
              contactPublicKey: aliceContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: bobContactKeyPair,
              firstContact: {
                keyPair: bobActorKeyPair,
                actorKey: aliceActorKeyPair.getPublic('hex'),
              },
            },
          },
        })

        expect(alice.connected$.value).toBe(false)
        expect(bob.connected$.value).toBe(true)

        alice.connected$.subscribe({
          next: connected => {
            if (connected) {
              alice.stop()
              bob.stop()
              done()
            }
          },
        })

        await bob.initialize()
      })

      test('publishes and subscribes to contact feed', async done => {
        const aliceActorKeyPair = createKeyPair()
        const aliceContactKeyPair = createKeyPair()
        const bobActorKeyPair = createKeyPair()
        const bobContactKeyPair = createKeyPair()

        const alice = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(bobActorKeyPair),
              contactPublicKey: bobContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: aliceContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        const bob = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(aliceActorKeyPair),
              contactPublicKey: aliceContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: bobContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        expect(alice.connected$.value).toBe(true)
        expect(bob.connected$.value).toBe(true)

        alice.data$.subscribe({
          next: data => {
            if (
              data != null &&
              data.profile != null &&
              data.profile.displayName === 'Bobby'
            ) {
              alice.stop()
              bob.stop()
              done()
            }
          },
        })

        await bob.setProfile({ displayName: 'Bobby' })
      })

      test('inboxes and outboxes', async done => {
        const aliceActorKeyPair = createKeyPair()
        const aliceContactKeyPair = createKeyPair()
        const bobActorKeyPair = createKeyPair()
        const bobContactKeyPair = createKeyPair()

        const alice = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(bobActorKeyPair),
              contactPublicKey: bobContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: aliceContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        const bob = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(aliceActorKeyPair),
              contactPublicKey: aliceContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: bobContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        await alice.addOutbox('test')
        await alice.outboxes.sendMessage('test', { body: 'hello' })

        bob.data$.subscribe({
          next: async () => {
            const inbox = bob.inboxes.getInbox('test')
            if (inbox != null) {
              inbox.start()
              inbox.newMessage$.subscribe({
                next: msg => {
                  if (msg.body === 'world') {
                    alice.stopAll()
                    bob.stopAll()
                    done()
                  }
                },
              })
              await alice.outboxes.sendMessage('test', { body: 'world' })
            }
          },
        })
      })

      test('inboundFileSystem and outboundFileSystem', async done => {
        jest.setTimeout(15000)

        const aliceActorKeyPair = createKeyPair()
        const aliceContactKeyPair = createKeyPair()
        const bobActorKeyPair = createKeyPair()
        const bobContactKeyPair = createKeyPair()

        const alice = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(bobActorKeyPair),
              contactPublicKey: bobContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: aliceContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        const bob = new ContactAgent({
          sync,
          data: {
            read: {
              actorAddress: getPublicAddress(aliceActorKeyPair),
              contactPublicKey: aliceContactKeyPair.getPublic('hex'),
            },
            write: {
              keyPair: bobContactKeyPair,
            },
          },
          autoStart: true,
          interval: 1000,
        })

        await alice.createOutboundFileSystem()
        const outFS = alice.outboundFileSystem
        await outFS.uploadFile('/test', 'hello')
        await outFS.push()

        bob.data$.subscribe({
          next: async () => {
            const fs = bob.inboundFileSystem
            if (fs != null) {
              const sub = fs.files$.subscribe({
                next: () => {
                  if (fs.hasFile('/test')) {
                    sub.unsubscribe()
                    alice.stopAll()
                    bob.stopAll()
                    done()
                  }
                },
              })
              await fs.pull()
            }
          },
        })
      })
    })
  })

  describe('fileSystem protocol', () => {
    test('uploadFile() and downloadFile() with encryption', async () => {
      const data = 'Hello test'
      const file = await uploadFile(sync, data, { encrypt: true })
      expect(file.hash).toBeDefined()
      expect(file.encryption).toBeDefined()

      const res = await downloadFile(sync, file)
      const text = await getStream(res)
      expect(text).toBe(data)
    })

    test('uploadFile() and downloadFile() without encryption', async () => {
      const data = Buffer.from('Hello test')
      const file = await uploadFile(sync, data)
      expect(file.hash).toBeDefined()
      expect(file.encryption).not.toBeDefined()

      const res = await downloadFile(sync, file)
      const text = await getStream(res)
      expect(text).toBe('Hello test')
    })

    test('uploadFile() supports a stream as input', async () => {
      const file1 = await uploadFile(sync, toReadable('hello'), {
        encrypt: true,
        size: 5,
      })
      const res1 = await downloadFile(sync, file1)
      const text1 = await getStream(res1)
      expect(text1).toBe('hello')

      const file2 = await uploadFile(sync, toReadable('hello'), { size: 5 })
      const res2 = await downloadFile(sync, file2)
      const text2 = await getStream(res2)
      expect(text2).toBe('hello')
    })

    describe('FileSystem class', () => {
      let files: FilesRecord = {}
      beforeAll(async () => {
        const [plaintext, encrypted, data] = await Promise.all([
          uploadFile(sync, 'hello world'),
          uploadFile(sync, 'encrypted', { encrypt: true }),
          uploadFile(sync, { hello: 'world' }),
        ])
        files = {
          '/plain.txt': plaintext,
          '/my/secret/file': encrypted,
          '/data/hello.json': data,
        }
      })

      test('stores the files references in a BehaviorSubject', () => {
        const fs = new FileSystem({ sync, files })
        expect(fs.files$).toBeInstanceOf(BehaviorSubject)
        expect(fs.files$.value).toEqual(files)
      })

      test('hasFile() method', () => {
        const fs = new FileSystem({ sync, files })
        expect(fs.hasFile('/plain.txt')).toBe(true)
        expect(fs.hasFile('/nothere')).toBe(false)
      })

      test('getFile() method', () => {
        const fs = new FileSystem({ sync, files })
        expect(fs.getFile('/my/secret/file')).toBe(files['/my/secret/file'])
        expect(fs.getFile('/nothere')).toBe(null)
      })

      test('downloadFile() method', async () => {
        const fs = new FileSystem({ sync, files })
        await expect(fs.downloadFile('/plain.txt')).resolves.toBeInstanceOf(
          Readable,
        )
        await expect(fs.downloadFile('/nothere')).rejects.toThrow(
          'File not found',
        )
      })

      test('downloadText() method', async () => {
        const fs = new FileSystem({ sync, files })
        await expect(fs.downloadText('/plain.txt')).resolves.toBe('hello world')
        await expect(fs.downloadText('/my/secret/file')).resolves.toBe(
          'encrypted',
        )
        await expect(fs.downloadText('/nothere')).rejects.toThrow(
          'File not found',
        )
      })

      test('downloadJSON() method', async () => {
        const fs = new FileSystem({ sync, files })
        await expect(fs.downloadJSON('/data/hello.json')).resolves.toEqual({
          hello: 'world',
        })
        await expect(fs.downloadJSON('/my/secret/file')).rejects.toThrow()
        await expect(fs.downloadJSON('/nothere')).rejects.toThrow(
          'File not found',
        )
      })
    })

    test('FileSystemWriter class flow', async () => {
      const actorKeyPair = createKeyPair()
      const actorPubKey = actorKeyPair.getPublic('hex')
      const fsKeyPair = createKeyPair()

      const fs = new FileSystemWriter({
        sync,
        keyPair: fsKeyPair,
        reader: actorPubKey,
      })

      await expect(fs.uploadFile('test.txt', 'hello')).rejects.toThrow(
        'Invalid path',
      )

      expect(fs.moveFile('/test.txt', '/hello.txt')).toBe(false)
      await fs.uploadFile('/test.txt', 'hello')
      expect(fs.moveFile('/test.txt', '/hello.txt')).toBe(true)
      expect(fs.removeFile('/test.txt')).toBe(false)

      const sameFile = fs.getFile('/hello.txt')
      expect(sameFile).toBeDefined()
      fs.setFile('/same.txt', sameFile)
      expect(fs.removeFile('/hello.txt')).toBe(true)
      await fs.push()

      const clone = new FileSystemWriter({
        sync,
        keyPair: fsKeyPair,
        reader: actorPubKey,
      })
      await clone.initialize()
      expect(clone.hasFile('/hello.txt')).toBe(false)
      await expect(clone.downloadText('/same.txt')).resolves.toBe('hello')
    })

    test('FileSystemWriter and FileSystemReader manual flow', async () => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const writer = new FileSystemWriter({
        sync,
        keyPair: aliceKeyPair,
        reader: bobKeyPair.getPublic('hex'),
        files: {},
      })
      const reader = new FileSystemReader({
        sync,
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

    test('FileSystemWriter and FileSystemReader auto flow', async done => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const writer = new FileSystemWriter({
        sync,
        keyPair: aliceKeyPair,
        reader: bobKeyPair.getPublic('hex'),
        files: {},
        interval: 1000,
        autoStart: true,
      })
      const reader = new FileSystemReader({
        sync,
        keyPair: bobKeyPair,
        writer: aliceKeyPair.getPublic('hex'),
        interval: 1000,
        autoStart: true,
      })

      const filePath = '/hello.txt'
      const fileText = 'Hello there!'

      reader.files$.subscribe({
        next: async () => {
          if (reader.hasFile(filePath)) {
            const text = await reader.downloadText(filePath)
            expect(text).toBe(fileText)
            reader.stop()
            writer.stop()
            done()
          }
        },
      })

      await writer.uploadFile(filePath, fileText, { encrypt: true })
    })
  })

  describe('messaging protocol', () => {
    test('createMailboxReader() and createMailboxWriter()', async done => {
      jest.setTimeout(10000)

      const aliceMailboxKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const write = createMailboxWriter({
        sync,
        keyPair: aliceMailboxKeyPair,
        reader: bobKeyPair.getPublic('hex'),
      })

      const firstMessage = { title: 'test', body: 'first' }
      const chapter = await write(firstMessage)

      const reader = createMailboxReader({
        sync,
        keyPair: bobKeyPair,
        writer: aliceMailboxKeyPair.getPublic('hex'),
      })

      const firstChapter = await reader.getLatestChapter()
      expect(firstChapter).toBeDefined()
      expect(firstChapter.content.data).toEqual(firstMessage)

      const secondMessage = {
        thread: chapter.id,
        title: 'test',
        body: 'second',
      }

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

      await write(secondMessage)
    })

    describe('InboxAgent class', () => {
      const aliceMailboxKeyPair = createKeyPair()
      const aliceMailboxPublicKey = aliceMailboxKeyPair.getPublic('hex')
      const bobKeyPair = createKeyPair()
      const bobPublicKey = bobKeyPair.getPublic('hex')

      test('starts in stopped state and can be started and stopped', () => {
        const inbox = new InboxAgent({
          sync,
          keyPair: bobKeyPair,
          writer: aliceMailboxPublicKey,
        })
        expect(inbox.state$.value).toBe(InboxState.STOPPED)
        inbox.start()
        expect(inbox.state$.value).toBe(InboxState.STARTED)
        inbox.stop()
        expect(inbox.state$.value).toBe(InboxState.STOPPED)
      })

      test('receives messages', async done => {
        jest.setTimeout(10000)

        const inbox = new InboxAgent({
          sync,
          keyPair: bobKeyPair,
          writer: aliceMailboxPublicKey,
          interval: 1000,
          autoStart: true,
        })
        expect(inbox.state$.value).toBe(InboxState.STARTED)

        const write = createMailboxWriter({
          sync,
          keyPair: aliceMailboxKeyPair,
          reader: bobPublicKey,
        })
        const messages = [{ body: 'hello' }, { body: 'world' }]

        const sub = inbox.newMessage$.subscribe({
          next: async msg => {
            if (msg.body === 'world') {
              expect(inbox.messages).toEqual(messages)
              sub.unsubscribe()
              inbox.stop()
              done()
            } else if (msg.body === 'hello') {
              await write(messages[1])
            } else {
              throw new Error('Unexpected message')
            }
          },
        })
        await write(messages[0])
      })
    })

    test('InboxesAgent and OutboxesAgent classes', async done => {
      const aliceKeyPair = createKeyPair()
      const bobKeyPair = createKeyPair()

      const outboxes = new OutboxesAgent({
        sync,
        reader: bobKeyPair.getPublic('hex'),
        outboxes: {
          first: aliceKeyPair,
        },
      })

      const inboxes = new InboxesAgent({
        sync,
        keyPair: bobKeyPair,
        interval: 1000,
        autoStart: true,
        inboxes: {
          firstFromAlice: { writer: aliceKeyPair.getPublic('hex') },
        },
      })

      inboxes.newMessage$.subscribe(inboxMessage => {
        if (inboxMessage.inbox === 'last') {
          inboxes.stopAll()
          done()
        } else {
          const newKeyPair = outboxes.addOutbox('test')
          inboxes.addInbox('last', { writer: newKeyPair.getPublic('hex') })
          outboxes.sendMessage('test', { body: 'world' })
        }
      })

      await outboxes.sendMessage('first', { body: 'hello' })
    })
  })

  describe('end-to-end flow', () => {
    test('using individual function calls', async () => {
      jest.setTimeout(30000)

      // Create key pairs for Alice and Bob
      const aliceKeyPair = createKeyPair()
      const aliceAddress = getPublicAddress(aliceKeyPair)
      const bobKeyPair = createKeyPair()
      const bobAddress = getPublicAddress(bobKeyPair)

      // Alice and Bob publish their public actor data to advertise their public keys
      await Promise.all([
        writeActor(
          { sync, keyPair: aliceKeyPair },
          {
            profile: { displayName: 'Alice' },
            publicKey: aliceKeyPair.getPublic('hex'),
          },
        ),
        writeActor(
          { sync, keyPair: bobKeyPair },
          {
            profile: { displayName: 'Bob' },
            publicKey: bobKeyPair.getPublic('hex'),
          },
        ),
      ])

      // Actor data can be loaded using their address after it's been published
      const [aliceActor, bobActor] = await Promise.all([
        readActor({ sync, actor: aliceAddress }),
        readActor({ sync, actor: bobAddress }),
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
        writeFirstContact(
          { sync, keyPair: aliceKeyPair, actorKey: bobActor.publicKey },
          {
            contactPublicKey: aliceBobKeyPair.getPublic('hex'),
            actorAddress: aliceAddress,
          },
        ),
        // Bob -> Alice
        writeFirstContact(
          { sync, keyPair: bobKeyPair, actorKey: aliceActor.publicKey },
          {
            contactPublicKey: bobAliceKeyPair.getPublic('hex'),
            actorAddress: bobAddress,
          },
        ),
      ])

      // Both Alice and Bob can retrieve each other's contact public key, they will use for future exchanges
      const [aliceBobFirstContact, bobAliceFirstContact] = await Promise.all([
        readFirstContact({
          sync,
          keyPair: aliceKeyPair,
          actorKey: bobActor.publicKey,
        }),
        readFirstContact({
          sync,
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
      const aliceBobFS = new FileSystemWriter({
        sync,
        keyPair: aliceFilesKeyPair,
        reader: aliceBobFirstContact.contactPublicKey,
      })

      // Push a file to Alice's FS and share the FS public key with Bob in their contact channel
      await aliceBobFS.uploadFile('/readme.txt', 'Hello!', { encrypt: true })
      await Promise.all([
        aliceBobFS.push(),
        writeContact(
          {
            sync,
            keyPair: aliceBobKeyPair,
            contactKey: aliceBobFirstContact.contactPublicKey,
          },
          { fileSystemKey: aliceFilesKeyPair.getPublic('hex') },
        ),
      ])

      // Bob can now read the contact information from Alice
      const bobAliceContact = await readContact({
        sync,
        keyPair: bobAliceKeyPair,
        contactKey: bobAliceFirstContact.contactPublicKey,
      })
      if (bobAliceContact == null || bobAliceContact.fileSystemKey == null) {
        throw new Error('Bob - Alice FS not found')
      }

      // Bob can read from Alice's FileSystem and check the file
      const bobAliceFS = new FileSystemReader({
        sync,
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
        writeActor(
          { sync, keyPair: chloeKeyPair },
          {
            profile: { displayName: 'Chloe' },
            publicKey: chloeKeyPair.getPublic('hex'),
          },
        ),
        writeFirstContact(
          { sync, keyPair: chloeKeyPair, actorKey: bobActor.publicKey },
          {
            contactPublicKey: chloeBobKeyPair.getPublic('hex'),
            actorAddress: chloeAddress,
          },
        ),
      ])

      // Bob can now access Chloe's actor and first contact data
      const chloeActor = await readActor({ sync, actor: chloeAddress })
      if (chloeActor == null) {
        throw new Error('Chloe actor not found')
      }

      const bobChloeFirstContact = await readFirstContact({
        sync,
        keyPair: bobKeyPair,
        actorKey: chloeActor.publicKey,
      })
      if (bobChloeFirstContact == null) {
        throw new Error('Bob - Chloe first contact not found')
      }

      // Create Bob -> Chloe mailbox and contact
      const bobChloeKeyPair = createKeyPair()
      const bobMailboxKeyPair = createKeyPair()
      const publishMessage = createMailboxWriter({
        sync,
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
        writeContact(
          {
            sync,
            keyPair: bobChloeKeyPair,
            contactKey: bobChloeFirstContact.contactPublicKey,
          },
          { mailboxes: { outbox: bobMailboxKeyPair.getPublic('hex') } },
        ),
        writeFirstContact(
          { sync, keyPair: bobKeyPair, actorKey: chloeActor.publicKey },
          {
            contactPublicKey: bobChloeKeyPair.getPublic('hex'),
            actorAddress: bobAddress,
          },
        ),
      ])

      // Chloe reads Bob's first contact and contact payloads
      const chloeBobFirstContact = await readFirstContact({
        sync,
        keyPair: chloeKeyPair,
        actorKey: bobActor.publicKey,
      })
      if (chloeBobFirstContact == null) {
        throw new Error('Chloe - Bob first contact not found')
      }

      const chloeBobContact = await readContact({
        sync,
        keyPair: chloeBobKeyPair,
        contactKey: chloeBobFirstContact.contactPublicKey,
      })
      if (chloeBobContact == null || chloeBobContact.mailboxes == null) {
        throw new Error('Chloe - Bob mailboxes not found')
      }

      // Chloe reads from the mailbox Bob has created and loads the message sent
      const reader = createMailboxReader({
        sync,
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
      const fileStream = await downloadFile(sync, attachment.file)
      const text = await getStream(fileStream)
      expect(text).toBe('Hello!')
    })
  })

  test('using agent classes', async done => {
    jest.setTimeout(30000)

    const createActorAgent = (displayName: string): ActorAgent => {
      return new ActorAgent({
        autoStart: true,
        interval: 1000,
        data: {
          actor: {
            keyPair: createKeyPair(),
            profile: { displayName },
          },
        },
        sync,
      })
    }

    const alice = createActorAgent('Alice')
    const bob = createActorAgent('Bob')
    const chloe = createActorAgent('Chloe')

    // Alice, Bob and Chloe need to publish their actor data
    await Promise.all([
      alice.publishActor(),
      bob.publishActor(),
      chloe.publishActor(),
    ])
    // Alice, Bob need to get one another's address using a side-channel
    const [aliceToBob, bobToAlice, bobToChloe, chloeToBob] = await Promise.all([
      alice.addContact(bob.address),
      bob.addContact(alice.address),
      bob.addContact(chloe.address),
      chloe.addContact(bob.address),
    ])

    const aliceFileSent$ = aliceToBob.connected$.pipe(
      filter(Boolean),
      flatMap(async () => {
        await aliceToBob.createOutboundFileSystem()
        await aliceToBob.outboundFileSystem.uploadFile('/test', 'hello!')
        await aliceToBob.outboundFileSystem.push()
      }),
    )

    const aliceFileReceived$ = bobToAlice.data$.pipe(
      map(() => bobToAlice.inboundFileSystem),
      filter(Boolean),
      flatMap(fs => fs.files$),
      map(() => bobToAlice.inboundFileSystem.getFile('/test')),
      filter(Boolean),
    )

    const bobOutboxCreated$ = bobToChloe.connected$.pipe(
      filter(Boolean),
      flatMap(async () => {
        await bobToChloe.addOutbox('hello')
      }),
    )

    const bobMessageSent$ = combineLatest(
      aliceFileReceived$,
      bobOutboxCreated$,
    ).pipe(
      flatMap(async ([file]) => {
        await bobToChloe.outboxes.sendMessage('hello', {
          title: 'hello',
          body: 'check this file!',
          attachments: [{ file, name: 'hello' }],
        })
      }),
    )

    const chloeMessageReceived$ = chloeToBob.data$.pipe(
      map(() => chloeToBob.inboxes.getInbox('hello')),
      filter(Boolean),
      flatMap(inbox => inbox.newMessage$),
      filter(msg => msg.title === 'hello'),
    )

    combineLatest(
      aliceFileSent$,
      bobMessageSent$,
      chloeMessageReceived$,
    ).subscribe({
      next: () => {
        alice.stopAll()
        bob.stopAll()
        chloe.stopAll()
        done()
      },
    })
  })
})
