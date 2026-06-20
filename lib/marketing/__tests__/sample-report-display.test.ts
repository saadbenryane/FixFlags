import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveDisplayScores } from '@/lib/marketing/sample-report-display'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'

function baseAudit(overrides: Partial<LiveSampleAudit> = {}): LiveSampleAudit {
  return {
    id: 'audit-1',
    url: 'https://example.com',
    pageJob: null,
    pageType: null,
    score: null,
    verdict: null,
    completedAt: null,
    createdAt: new Date(),
    pipelineVersion: 'test',
    rubricRows: [
      { id: 'r1', name: 'MESSAGE', grade: 'A', score: 95, status: 'EXCELLENT', summary: '', flags: [] },
      { id: 'r2', name: 'EXPERIENCE', grade: null, score: null, status: null, summary: '', flags: [] },
      { id: 'r3', name: 'REACH', grade: 'B', score: 80, status: 'GOOD', summary: '', flags: [] },
    ],
    flags: [],
    screenshots: [],
    launchReadiness: { readiness: 'unknown', checklist: [] },
    rubrics: [],
    shareStatus: 'fix_before_sharing',
    evidenceCoverage: { desktopPageSpeed: false, mobilePageSpeed: false },
    ...overrides,
  }
}

describe('resolveDisplayScores', () => {
  it('fills null rubric scores from computeRubricScores and yields overall', () => {
    const { overall, rubrics } = resolveDisplayScores(baseAudit())
    assert.equal(rubrics.MESSAGE, 95)
    assert.equal(rubrics.EXPERIENCE, 75)
    assert.equal(rubrics.REACH, 80)
    assert.equal(overall, 83)
  })

  it('uses stored audit score when present', () => {
    const { overall } = resolveDisplayScores(baseAudit({ score: 72 }))
    assert.equal(overall, 72)
  })
})
