import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { calculateOverallScore, gradeFromScore } from '@/lib/audit/scoring'
import { isEligibleMarketingSample } from '@/lib/marketing/curated-sample'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { resolveDisplayScores } from '@/lib/marketing/sample-report-display'

describe('isEligibleMarketingSample', () => {
  it('requires completeness, flags, rubrics, and a desktop screenshot', () => {
    assert.equal(
      isEligibleMarketingSample({
        reportCompleteness: 'FULL',
        flags: [{ id: 'f1' }],
        rubrics: [{ name: 'MESSAGE' }],
        screenshots: [{ device: 'DESKTOP', url: '/shot.webp' }],
      }),
      true
    )
  })

  it('rejects near-empty or incomplete audits regardless of score', () => {
    assert.equal(
      isEligibleMarketingSample({
        reportCompleteness: 'FULL',
        flags: [],
        rubrics: [{ name: 'MESSAGE' }],
        screenshots: [{ device: 'DESKTOP', url: '/shot.webp' }],
      }),
      false
    )
    assert.equal(
      isEligibleMarketingSample({
        reportCompleteness: 'UNKNOWN',
        flags: [{ id: 'f1' }],
        rubrics: [{ name: 'MESSAGE' }],
        screenshots: [{ device: 'DESKTOP', url: '/shot.webp' }],
      }),
      false
    )
    assert.equal(
      isEligibleMarketingSample({
        reportCompleteness: 'FULL',
        flags: [{ id: 'f1' }],
        rubrics: [{ name: 'MESSAGE' }],
        screenshots: [{ device: 'MOBILE', url: '/shot.webp' }],
      }),
      false
    )
  })
})

describe('static sample scoring consistency', () => {
  it('derives overall score and grades from production helpers', () => {
    const audit = getStaticSampleAudit()
    const expectedOverall = calculateOverallScore({
      MESSAGE: 82,
      EXPERIENCE: 62,
      REACH: 65,
    })
    assert.equal(audit.score, expectedOverall)
    for (const row of audit.rubricRows) {
      assert.ok(row.score != null)
      assert.equal(row.grade, gradeFromScore(row.score!))
    }
    const display = resolveDisplayScores(audit)
    assert.equal(display.overall, expectedOverall)
    assert.equal(display.rubrics.MESSAGE, 82)
    assert.equal(display.rubrics.EXPERIENCE, 62)
    assert.equal(display.rubrics.REACH, 65)
  })
})
