import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AI_SUMMARY_UNAVAILABLE_VERDICT,
  DETERMINISTIC_SCAN_VERDICT,
  displayVerdict,
  isSystemVerdict,
} from '@/lib/audit/verdict'

describe('verdict helpers', () => {
  it('detects deterministic scan stub', () => {
    assert.equal(isSystemVerdict(DETERMINISTIC_SCAN_VERDICT), true)
    assert.equal(displayVerdict(DETERMINISTIC_SCAN_VERDICT), null)
  })

  it('detects AI summary unavailable stub', () => {
    assert.equal(isSystemVerdict(AI_SUMMARY_UNAVAILABLE_VERDICT), true)
    assert.equal(displayVerdict(AI_SUMMARY_UNAVAILABLE_VERDICT), null)
  })

  it('passes through real AI verdicts', () => {
    const verdict = 'Solid foundation with gaps in mobile hero layout.'
    assert.equal(isSystemVerdict(verdict), false)
    assert.equal(displayVerdict(verdict), verdict)
  })

  it('returns null for empty verdict', () => {
    assert.equal(isSystemVerdict(null), false)
    assert.equal(displayVerdict(null), null)
  })
})
