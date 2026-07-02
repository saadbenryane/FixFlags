import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { getScanningLabel } from '@/lib/audit/progress-ui'

describe('getScanningLabel', () => {
  it('rotates through stage-specific subcategory labels', () => {
    const a = getScanningLabel('CHECKING', 0)
    const b = getScanningLabel('CHECKING', 1)
    assert.notEqual(a, b)
    // Wraps around deterministically.
    assert.equal(getScanningLabel('CHECKING', 0), getScanningLabel('CHECKING', 6))
  })

  it('never reveals a check count or the recipe', () => {
    for (const status of ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING']) {
      for (let tick = 0; tick < 8; tick++) {
        const label = getScanningLabel(status, tick)
        assert.doesNotMatch(label, /\d/, `"${label}" should contain no digits`)
        assert.doesNotMatch(label, /checks?\b/i, `"${label}" should not mention checks`)
      }
    }
  })

  it('falls back to CHECKING labels for an unknown status', () => {
    assert.equal(getScanningLabel('SOMETHING_ELSE', 0), getScanningLabel('CHECKING', 0))
  })
})
