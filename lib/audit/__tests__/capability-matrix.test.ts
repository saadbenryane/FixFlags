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

  it('lists at least one implemented capability per rubric dimension', () => {
    for (const dimension of ['MESSAGE', 'EXPERIENCE', 'REACH'] as const) {
      const implemented = AUDIT_CAPABILITIES.filter(
        (c) => c.dimension === dimension && c.implementation === 'implemented'
      )
      assert.ok(implemented.length >= 3, `${dimension} should have multiple implemented capabilities`)
    }
  })

  it('is a superset of ALL_CHECK_IDS with no duplicates', () => {
    const mapped = AUDIT_CAPABILITIES.flatMap((c) => c.checkIds)
    assert.equal(mapped.length, new Set(mapped).size, 'duplicate checkIds in matrix')
    assert.ok(
      ALL_CHECK_IDS.every((id) => mapped.includes(id)),
      'every ALL_CHECK_IDS entry has a capability mapping'
    )
  })
})
