import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { validateMonitoringParent } from '@/lib/audit/monitoring'

describe('validateMonitoringParent', () => {
  it('rejects missing parent', () => {
    const result = validateMonitoringParent(null, 'u1')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 404)
  })

  it('rejects wrong owner', () => {
    const result = validateMonitoringParent(
      { userId: 'other', status: 'COMPLETED' },
      'u1'
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 403)
  })

  it('rejects incomplete parent', () => {
    const result = validateMonitoringParent(
      { userId: 'u1', status: 'QUEUED' },
      'u1'
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.status, 400)
  })

  it('accepts completed owned parent', () => {
    const result = validateMonitoringParent(
      { userId: 'u1', status: 'COMPLETED' },
      'u1'
    )
    assert.equal(result.ok, true)
  })
})
