import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { hashSharePassword, verifySharePassword } from '@/lib/security/share-password'

describe('share-password', () => {
  it('hashes and verifies a password', () => {
    const stored = hashSharePassword('client-secret')
    assert.equal(stored.startsWith('scrypt$'), true)
    assert.equal(verifySharePassword(stored, 'client-secret'), true)
    assert.equal(verifySharePassword(stored, 'wrong'), false)
  })

  it('rejects unsupported plaintext storage', () => {
    assert.equal(verifySharePassword('legacy-plain', 'legacy-plain'), false)
  })
})
