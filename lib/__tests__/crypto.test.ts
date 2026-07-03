import { describe, it, beforeAll } from 'vitest'
import assert from 'node:assert/strict'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'

describe('lib/security/crypto', () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64)
  })

  it('round-trips a secret through encrypt/decrypt', () => {
    const plaintext = 'gho_super_secret_token_value'
    const encrypted = encryptSecret(plaintext)
    assert.notEqual(encrypted, plaintext)
    assert.equal(decryptSecret(encrypted), plaintext)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    assert.notEqual(a, b)
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptSecret('another-secret')
    const parts = encrypted.split('.')
    const ciphertext = Buffer.from(parts[2], 'base64')
    ciphertext[0] ^= 1
    const tampered = [parts[0], parts[1], ciphertext.toString('base64')].join('.')
    assert.throws(() => decryptSecret(tampered))
  })
})
