import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { hashSharePassword, verifySharePassword } from '@/lib/security/share-password'

describe('share-password', () => {
  it('hashes and verifies a password', async () => {
    const stored = await hashSharePassword('client-secret')
    assert.equal(stored.startsWith('scrypt$'), true)
    assert.equal(await verifySharePassword(stored, 'client-secret'), true)
    assert.equal(await verifySharePassword(stored, 'wrong'), false)
  })

  it('rejects unsupported plaintext storage', async () => {
    assert.equal(await verifySharePassword('legacy-plain', 'legacy-plain'), false)
  })
})
