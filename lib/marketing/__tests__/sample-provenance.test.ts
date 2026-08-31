import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { calculateOverallScore, gradeFromScore } from '@/lib/audit/scoring'
import {
  getCuratedSampleAudit,
  isEligibleMarketingSample,
  UnknownCuratedObservationError,
} from '@/lib/marketing/curated-sample'
import {
  getStaticSampleAudit,
  LATEST_STATIC_SAMPLE_OBSERVATION_ID,
} from '@/lib/marketing/static-sample'
import { resolveDisplayScores } from '@/lib/marketing/sample-report-display'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'

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
    const scores = Object.fromEntries(
      audit.rubricRows.map((row) => [row.name, row.score])
    ) as Record<'MESSAGE' | 'EXPERIENCE' | 'REACH', number>
    const expectedOverall = calculateOverallScore(scores)
    assert.equal(audit.score, expectedOverall)
    for (const row of audit.rubricRows) {
      assert.ok(row.score != null)
      assert.equal(row.grade, gradeFromScore(row.score!))
    }
    const display = resolveDisplayScores(audit)
    assert.equal(display.overall, expectedOverall)
    assert.deepEqual(display.rubrics, scores)
  })
})

describe('curated sample provenance', () => {
  it('selects a requested curated observation without authentication', async () => {
    const selected = await getCuratedSampleAudit('curated-sample-v0')

    assert.equal(selected.source, 'curated')
    assert.equal(selected.audit.accessContext, 'repository_sample')
    assert.equal(selected.audit.id, 'curated-sample-v0')
    assert.equal(selected.completedAt?.toISOString(), '2026-06-09T14:30:00.000Z')
    assert.ok((selected.audit.actionTimeline?.length ?? 0) > 0)
    assert.ok(selected.audit.flags.length >= 7)
    const current = await getCuratedSampleAudit()
    assert.ok((selected.audit.score ?? 100) < (current.audit.score ?? 0))
  })

  it('defaults only an absent ID and rejects an explicit unknown ID', async () => {
    const absent = await getCuratedSampleAudit()

    assert.equal(absent.audit.id, LATEST_STATIC_SAMPLE_OBSERVATION_ID)
    await assert.rejects(
      getCuratedSampleAudit('not-a-curated-observation'),
      UnknownCuratedObservationError
    )
    await assert.rejects(getCuratedSampleAudit(''), UnknownCuratedObservationError)
  })

  it('names worthwhile Flags and leaves the Polish canonical observation in the Report', async () => {
    const { audit } = await getCuratedSampleAudit()
    const messages = buildFixFlagsScanMessages({
      id: audit.id,
      url: audit.url,
      status: 'COMPLETED',
      progress: 100,
      flags: audit.flags.map((flag) => ({
        id: flag.id,
        problem: flag.problem,
        rubric: flag.rubric,
        severity: flag.severity,
        checkId: flag.checkId,
        impactTag: flag.impactTag,
        confidence: flag.confidence,
        status: flag.status,
        fix: flag.fix,
      })),
    })
    const announced = messages.filter((item) => item.kind === 'flag').map((item) => item.flagId)

    assert.ok(announced.includes('flag-experience-mobile-cta'))
    assert.equal(announced.includes('flag-reach-canonical'), false)
    assert.equal(
      messages.some((item) => item.id.endsWith(':no-attention')),
      false
    )
  })

})
