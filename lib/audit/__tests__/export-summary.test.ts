import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildAuditExportSummary } from '@/lib/audit/export-summary'
import { computeRubricsFromRows } from '@/lib/audit/rubric'

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
})
