import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { validateRecheckParent } from '@/lib/audit/recheck'

describe('validateRecheckParent', () => {
  it('rejects missing parent', () => {
    const result = validateRecheckParent(null, 'u1')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 404)
  })

  it('rejects wrong owner', () => {
    const result = validateRecheckParent(
      { userId: 'other', status: 'COMPLETED' },
      'u1'
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 403)
  })

  it('rejects incomplete parent', () => {
    const result = validateRecheckParent(
      { userId: 'u1', status: 'QUEUED' },
      'u1'
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 400)
  })

  it('accepts completed owned parent', () => {
    const result = validateRecheckParent(
      { userId: 'u1', status: 'COMPLETED' },
      'u1'
    )
    assert.equal(result.ok, true)
  })
})
