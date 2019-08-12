import { Readable } from 'stream'

import {
  Core,
  // constants
  AEGLE_BYTE,
  CRYPTO_ALGORITHM,
  CRYPTO_KEY_LENGTH,
  HEADER_MAX_SIZE,
  HEADER_SIZE_BYTES,
  // crypto
  createCipher,
  createDecipher,
  createKey,
  createRandomBytes,
  decrypt,
  decryptJSON,
  encrypt,
  encryptJSON,
  // encoding
  encodeHeaderSize,
  decodeHeaderSize,
  decodeStream,
  encodePayload,
  // namespace
  ACTOR_NAME,
  // utils
  fromBuffer,
  toBuffer,
} from '@aegle/core'

describe('core', () => {
  function toReadable(chunk: string | Buffer): Readable {
    return new Readable({
      read() {
        this.push(chunk)
        this.push(null)
      },
    })
  }

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

    test('createCipher() and createDecipher() throw an error if the algorithm is not supported', async () => {
      const key = await createKey()
      await expect(createCipher('aes-128-gcm', key)).rejects.toThrow(
        'Unsupported algorithm',
      )
      expect(() => {
        createDecipher(key, { algorithm: 'aes-128-gcm' })
      }).toThrow('Unsupported algorithm')
    })

    test('encrypts and decrypts a buffer', async () => {
      const key = await createKey()
      const data = Buffer.from('hello')
      const payload = await encrypt(CRYPTO_ALGORITHM, key, data)
      const decrypted = await decrypt(key, payload)
      expect(data.equals(decrypted)).toBe(true)

      const otherKey = await createKey()
      await expect(decrypt(otherKey, payload)).rejects.toThrow(
        'Unsupported state or unable to authenticate data',
      )
    })

    test('encrypts and decrypts JSON', async () => {
      const key = await createKey()
      const data = { hello: 'test' }
      const payload = await encryptJSON(CRYPTO_ALGORITHM, key, data)
      const decrypted = await decryptJSON(key, payload)
      expect(decrypted).toEqual(data)

      const otherKey = await createKey()
      await expect(decryptJSON(otherKey, payload)).rejects.toThrow(
        'Unsupported state or unable to authenticate data',
      )
    })
  })

  describe('encoding', () => {
    async function read(payload: Buffer, params?: any) {
      return await decodeStream(toReadable(payload), params)
    }

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
        decodeHeaderSize()
      }).toThrow('Invalid input')
      expect(() => {
        decodeHeaderSize(Buffer.alloc(HEADER_SIZE_BYTES + 1))
      }).toThrow('Invalid input')
    })

    describe('decodeStream()', () => {
      test('checks control byte and header size', async () => {
        // Wrong control byte
        await expect(read(Buffer.from('00', 'hex'))).rejects.toThrow(
          'Invalid stream',
        )
        // Correct control byte but not header size
        await expect(read(AEGLE_BYTE)).rejects.toThrow('Invalid input')
        // Correct control byte and header size
        await expect(
          read(Buffer.concat([AEGLE_BYTE, encodeHeaderSize(0)])),
        ).resolves.toBeInstanceOf(Buffer)
      })

      test('checks if body size set in headers exceeds max allowed size', async () => {
        const headers = toBuffer({ size: 10 })
        const payload = Buffer.concat([
          AEGLE_BYTE,
          encodeHeaderSize(headers.length),
          headers,
        ])
        // No maxSize provided
        await expect(read(payload)).resolves.toBeInstanceOf(Buffer)
        // allowed maxSize
        await expect(read(payload, { maxSize: 10 })).resolves.toBeInstanceOf(
          Buffer,
        )
        // exceeds allowed maxSize
        await expect(read(payload, { maxSize: 5 })).rejects.toThrow(
          'Body exceeds maximum allowed size',
        )
      })

      test('checks actual body size', async () => {
        const data = Buffer.alloc(20)

        const badHeaders = toBuffer({ size: 10 })
        const badPayload = Buffer.concat([
          AEGLE_BYTE,
          encodeHeaderSize(badHeaders.length),
          badHeaders,
          data,
        ])

        const goodHeaders = toBuffer({ size: 20 })
        const goodPayload = Buffer.concat([
          AEGLE_BYTE,
          encodeHeaderSize(goodHeaders.length),
          goodHeaders,
          data,
        ])

        const noHeaderPayload = Buffer.concat([
          AEGLE_BYTE,
          encodeHeaderSize(0),
          data,
        ])

        // No maxSize param provided
        await expect(read(badPayload)).rejects.toThrow('maxBuffer exceeded')
        await expect(read(goodPayload)).resolves.toBeInstanceOf(Buffer)
        await expect(read(noHeaderPayload)).resolves.toBeInstanceOf(Buffer)

        // // maxSize < data size
        const lowerParams = { maxSize: 15 }
        await expect(read(badPayload, lowerParams)).rejects.toThrow(
          'maxBuffer exceeded',
        )
        await expect(read(goodPayload, lowerParams)).rejects.toThrow(
          'Body exceeds maximum allowed size',
        )
        await expect(read(noHeaderPayload, lowerParams)).rejects.toThrow(
          'maxBuffer exceeded',
        )

        // maxSize >- data size
        const higherParams = { maxSize: 20 }
        await expect(read(badPayload, higherParams)).rejects.toThrow(
          'maxBuffer exceeded',
        )
        await expect(read(goodPayload, higherParams)).resolves.toBeInstanceOf(
          Buffer,
        )
        await expect(
          read(noHeaderPayload, higherParams),
        ).resolves.toBeInstanceOf(Buffer)
      })

      test('throws an error if payload is encrypted and key is not provided', async () => {
        const data = { hello: 'world' }
        const key = await createKey()
        const payload = await encodePayload(data, { key })
        await expect(read(payload)).rejects.toThrow(
          'Missing key to attempt decryption',
        )
        await expect(read(payload, { key })).resolves.toBeInstanceOf(Buffer)
      })
    })

    describe('encodePayload()', () => {
      test('without encryption', async () => {
        const data = { hello: 'world' }
        const encoded = await encodePayload(data)
        const body = await read(encoded)
        expect(fromBuffer(body)).toEqual(data)
      })

      test('with encryption', async () => {
        const data = { hello: 'world' }
        const key = await createKey()
        const encoded = await encodePayload(data, { key })
        const body = await read(encoded, { key })
        expect(fromBuffer(body)).toEqual(data)

        const otherKey = await createKey()
        await expect(read(encoded, { key: otherKey })).rejects.toThrow(
          'Unsupported state or unable to authenticate data',
        )
      })
    })
  })

  describe('utils', () => {
    test('toBuffer() and fromBuffer()', () => {
      const data = { hello: 'world' }
      const buffer = toBuffer(data)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      const parsed = fromBuffer(buffer)
      expect(parsed).toEqual(data)
    })
  })

  describe('Core class', () => {
    const core = new Core()
    const validEntity = {
      type: ACTOR_NAME,
      data: {
        publicKey:
          '04754036d637dcdc2c02a6466a38a7b37ae4bae4c207a9a6b5ceb76aa9d7c1a41c6d50c00d21c2943362c8463a6a736c8b37e1ca421cbb7f45428a77fd59b0f44e',
      },
    }

    test('validateEntity()', async () => {
      await expect(core.validateEntity(validEntity)).resolves.toEqual(
        validEntity,
      )
      await expect(
        core.validateEntity({ type: 'invalid', data: {} }),
      ).rejects.toThrow('no schema with key or ref "aegle://invalid"')
      await expect(
        core.validateEntity({
          type: ACTOR_NAME,
          data: { publicKey: 'invalid' },
        }),
      ).rejects.toThrow('validation failed')
    })

    test('validateBuffer()', async () => {
      await expect(core.validateBuffer(toBuffer(validEntity))).resolves.toEqual(
        validEntity,
      )
    })

    test('encodeEntity() and decodeEntityStream()', async () => {
      const payload = await core.encodeEntity(
        validEntity.type,
        validEntity.data,
      )
      await expect(
        core.decodeEntityStream(toReadable(payload)),
      ).resolves.toEqual(validEntity)
    })
  })
})
