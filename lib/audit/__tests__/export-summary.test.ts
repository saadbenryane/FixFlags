import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { buildAuditExportSummary } from '@/lib/audit/export-summary'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { DETERMINISTIC_SCAN_VERDICT } from '@/lib/audit/verdict'

describe('buildAuditExportSummary', () => {
  it('marks rubric BLOCKED when CRITICAL flag exists despite B grade', () => {
    const rubrics = [
      { name: 'MESSAGE', grade: 'B', score: 80 },
      { name: 'EXPERIENCE', grade: 'B', score: 82 },
      { name: 'REACH', grade: 'C', score: 65 },
    ]
    const flags = [
      {
        severity: 'CRITICAL',
        problem: 'Site not served over HTTPS',
        rubric: 'REACH',
      },
    ]

    const summary = buildAuditExportSummary({
      auditId: 'test-audit',
      url: 'https://example.com',
      score: 78,
      verdict: 'Fix reach blockers before sharing.',
      rubrics,
      flags,
    })

    const computed = computeRubricsFromRows(rubrics, flags)
    const reachRubric = computed.find((r) => r.name === 'REACH')
    assert.equal(reachRubric?.status, 'BLOCKED')
    assert.match(summary, /Reach: BLOCKED/)
    assert.match(summary, /Fix before sharing/i)
  })

  it('omits system stub verdicts from exported summary', () => {
    const summary = buildAuditExportSummary({
      auditId: 'test-audit',
      url: 'https://example.com',
      score: 72,
      verdict: DETERMINISTIC_SCAN_VERDICT,
      rubrics: [{ name: 'MESSAGE', grade: 'C', score: 70 }],
      flags: [],
    })

    assert.doesNotMatch(summary, /\*\*Summary:\*\*/)
    assert.doesNotMatch(summary, /Deterministic scan complete/)
  })
})
