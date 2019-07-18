import { getFeedTopic } from '@erebos/api-bzz-node'
import { createHex } from '@erebos/hex'
import { hash } from '@erebos/keccak256'
import { createKeyPair } from '@erebos/secp256k1'

import {
  AegleSync,
  getFeedReadParams,
  getFeedWriteParams,
  getPublicAddress,
} from '../packages/sync'

describe('sync', () => {
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

  test.todo('AegleSync')
})
