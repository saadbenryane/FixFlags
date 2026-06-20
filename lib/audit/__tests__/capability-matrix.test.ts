import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'
import { AUDIT_CAPABILITIES, capabilitySummary } from '@/lib/audit/capability-matrix'

describe('audit capability matrix', () => {
  it('maps every deterministic check to a capability', () => {
    const summary = capabilitySummary()
    assert.equal(
      summary.unmapped.length,
      0,
      `unmapped checkIds: ${summary.unmapped.join(', ')}`
    )
  })

  it('lists at least one live capability per rubric dimension', () => {
    for (const dimension of ['MESSAGE', 'EXPERIENCE', 'REACH'] as const) {
      const live = AUDIT_CAPABILITIES.filter(
        (c) => c.dimension === dimension && c.status === 'live'
      )
      assert.ok(live.length >= 3, `${dimension} should have multiple live capabilities`)
    }
  })

  it('includes all registered check IDs in the matrix exactly once', () => {
    const mapped = AUDIT_CAPABILITIES.flatMap((c) => c.checkIds)
    assert.equal(mapped.length, new Set(mapped).size, 'duplicate checkIds in matrix')
    assert.equal(mapped.length, ALL_CHECK_IDS.length)
  })
})
