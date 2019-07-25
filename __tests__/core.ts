import {
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
} from '@aegle/core'

describe('core', () => {
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
})
