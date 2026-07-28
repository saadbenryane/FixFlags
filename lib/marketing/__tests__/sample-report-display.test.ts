import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  AI_SUMMARY_UNAVAILABLE_VERDICT,
  DETERMINISTIC_SCAN_VERDICT,
} from '@/lib/audit/verdict'
import { DEFAULT_SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { DEMO_BRAND } from '@/lib/demo/brand'
import {
  buildAllEvidenceHighlights,
  buildSampleReportDisplay,
  resolveDisplayScores,
} from '@/lib/marketing/sample-report-display'
import type { CuratedSampleAudit } from '@/lib/marketing/curated-sample'

function baseAudit(overrides: Partial<CuratedSampleAudit> = {}): CuratedSampleAudit {
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

describe('buildSampleReportDisplay', () => {
  it('sets displayHost for demo fixture URL', () => {
    const report = buildSampleReportDisplay(
      baseAudit({
        url: DEFAULT_SAMPLE_AUDIT_URL,
        pageType: 'Landing page',
      })
    )
    assert.equal(report.displayHost, DEMO_BRAND.displayLabel)
    assert.equal(report.isDemoFixture, true)
    assert.equal(report.host, 'fixflags.com')
  })

  it('uses page type on Scan pipeline step', () => {
    const report = buildSampleReportDisplay(baseAudit({ pageType: 'Landing page' }))
    const scanStep = report.pipelineSteps.find((s) => s.id === 'scan')
    assert.equal(scanStep?.detail, 'Landing page')
    assert.equal(scanStep?.label, 'Scan')
  })

  it('filters system stub verdicts', () => {
    const report = buildSampleReportDisplay(
      baseAudit({ verdict: DETERMINISTIC_SCAN_VERDICT })
    )
    assert.equal(report.verdict, null)

    const userReport = buildSampleReportDisplay(
      baseAudit({ verdict: 'Fix messaging before sharing.' })
    )
    assert.equal(userReport.verdict, 'Fix messaging before sharing.')

    const unavailable = buildSampleReportDisplay(
      baseAudit({ verdict: AI_SUMMARY_UNAVAILABLE_VERDICT })
    )
    assert.equal(unavailable.verdict, null)
  })

  it('emits per-device evidence highlights when anchors exist for both', () => {
    const report = buildSampleReportDisplay(
      baseAudit({
        flags: [
          {
            id: 'flag-message-1',
            checkId: 'h1-generic',
            rubric: 'MESSAGE',
            severity: 'IMPORTANT',
            impactTag: 'CONVERSION',
            problem: 'Hero headline is generic',
            evidence: 'Headline reads a category label, not an outcome.',
            whyItMatters: 'Outcome-driven headlines convert better.',
            fix: 'Lead with the outcome.',
            agentPrompt: 'Update the H1.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: null,
            pageUrl: null,
          },
        ],
      })
    )

    const flag = report.flags[0]
    assert.equal(flag.evidenceHighlights.length, 2)
    assert.ok(flag.evidenceHighlights.some((h) => h.device === 'desktop'))
    assert.ok(flag.evidenceHighlights.some((h) => h.device === 'mobile'))
    assert.equal(flag.evidenceHighlights[0].id, 'flag-message-1-desktop')
    assert.equal(flag.evidenceHighlights[0].flagId, 'flag-message-1')
    assert.equal(flag.evidenceHighlights[0].flagIndex, 0)
    assert.equal(flag.evidenceHighlights[0].severity, 'IMPORTANT')
    assert.equal(flag.evidenceHighlights[0].scope, 'element')
    assert.ok(flag.evidenceHighlights[0].width > 0)
    assert.ok(flag.evidenceHighlights[0].visualTarget.length > 0)
    assert.match(flag.evidence, /Headline reads|H1|category/i)
    assert.deepEqual(flag.affectedDevices, ['desktop', 'mobile'])
    assert.equal(flag.evidenceHighlights[1].id, 'flag-message-1-mobile')
  })

  it('buildAllEvidenceHighlights merges flags', () => {
    const report = buildSampleReportDisplay(
      baseAudit({
        flags: [
          {
            id: 'flag-message-1',
            checkId: 'h1-generic',
            rubric: 'MESSAGE',
            severity: 'IMPORTANT',
            impactTag: null,
            problem: 'Generic headline',
            evidence: 'evidence',
            whyItMatters: 'matters',
            fix: 'fix',
            agentPrompt: 'prompt',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: null,
            pageUrl: null,
          },
          {
            id: 'flag-experience-1',
            checkId: 'tap-targets-small',
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: null,
            problem: 'Small tap targets',
            evidence: 'mobile evidence',
            whyItMatters: 'matters',
            fix: 'fix',
            agentPrompt: 'prompt',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: null,
            pageUrl: null,
          },
        ],
      })
    )

    const merged = buildAllEvidenceHighlights(report.flags)
    assert.ok(merged.length >= 3)
    assert.ok(merged.some((h) => h.flagId === 'flag-message-1'))
    assert.ok(merged.some((h) => h.flagId === 'flag-experience-1'))
    assert.ok(report.flags[1].affectedDevices.includes('mobile'))
    assert.equal(report.flags[1].affectedDevices.includes('desktop'), false)
  })
})
