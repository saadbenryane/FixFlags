import { describe, it, expect } from 'vitest'
import { buildCombinedJudgeOutput } from '../pipeline/combine-pages'
import type { PageRun } from '../pipeline/types'
import type { JudgeOutput } from '../judge-schema'
import type { JudgeResult } from '../judge'

const RUBRIC_NAMES = ['MESSAGE', 'EXPERIENCE', 'REACH'] as const

function rubric(name: (typeof RUBRIC_NAMES)[number], score: number | null) {
  return {
    name,
    score,
    grade: 'B' as const,
    status: 'GOOD' as const,
    assessmentState: score === null ? ('PARTIAL' as const) : ('ASSESSED' as const),
    confidence: 0.8,
    summary: `${name} summary`,
    rubricPrompt: `${name} prompt`,
  }
}

function judgeOutput(overrides: {
  rubricScores: Record<(typeof RUBRIC_NAMES)[number], number | null>
  enrichmentIds?: string[]
  newFlagProblems?: string[]
}): JudgeOutput {
  return {
    pageJob: 'job',
    pageType: 'homepage',
    verdict: 'verdict here',
    score: 80,
    launchReadiness: 'safe',
    launchChecklist: [],
    rubrics: RUBRIC_NAMES.map((name) => rubric(name, overrides.rubricScores[name])),
    newFlags: (overrides.newFlagProblems ?? []).map((problem) => ({
      rubric: 'MESSAGE' as const,
      impactTag: 'CONVERSION' as const,
      severity: 'IMPORTANT' as const,
      problem,
      evidence: 'evidence',
      whyItMatters: 'matters',
      fix: 'fix',
      confidence: 0.7,
    })),
    enrichments: (overrides.enrichmentIds ?? []).map((checkId) => ({
      checkId,
      whyItMatters: 'matters',
    })),
  }
}

function pageRun(output: JudgeOutput): PageRun {
  const judge: JudgeResult = {
    output,
    usage: { inputTokens: 0, outputTokens: 0, model: 'test' },
  }
  return {
    pageId: 'p',
    url: 'https://example.com',
    metadata: {} as never,
    desktop: null,
    mobile: null,
    desktopScreenshot: true,
    mobileScreenshot: true,
    flowScan: false,
    desktopBase64: 'x',
    mobileBase64: null,
    flags: [],
    judge,
  }
}

describe('buildCombinedJudgeOutput', () => {
  it('averages rubric scores when every page reports one', () => {
    const pages = [
      pageRun(judgeOutput({ rubricScores: { MESSAGE: 80, EXPERIENCE: 60, REACH: 90 } })),
      pageRun(judgeOutput({ rubricScores: { MESSAGE: 90, EXPERIENCE: 70, REACH: 100 } })),
    ]
    const combined = buildCombinedJudgeOutput(pages)
    const byName = Object.fromEntries(combined.rubrics.map((r) => [r.name, r]))
    expect(byName.MESSAGE.score).toBe(85)
    expect(byName.EXPERIENCE.score).toBe(65)
    expect(byName.REACH.score).toBe(95)
    expect(byName.MESSAGE.assessmentState).toBe('ASSESSED')
  })

  it('marks a rubric PARTIAL when any page is missing its score', () => {
    const pages = [
      pageRun(judgeOutput({ rubricScores: { MESSAGE: 80, EXPERIENCE: 60, REACH: 90 } })),
      pageRun(judgeOutput({ rubricScores: { MESSAGE: null, EXPERIENCE: 70, REACH: 100 } })),
    ]
    const combined = buildCombinedJudgeOutput(pages)
    const message = combined.rubrics.find((r) => r.name === 'MESSAGE')!
    expect(message.score).toBeNull()
    expect(message.assessmentState).toBe('PARTIAL')
  })

  it('concatenates new flags and enrichments across pages', () => {
    const pages = [
      pageRun(
        judgeOutput({
          rubricScores: { MESSAGE: 80, EXPERIENCE: 60, REACH: 90 },
          enrichmentIds: ['a'],
          newFlagProblems: ['flag-1'],
        })
      ),
      pageRun(
        judgeOutput({
          rubricScores: { MESSAGE: 90, EXPERIENCE: 70, REACH: 100 },
          enrichmentIds: ['b'],
          newFlagProblems: ['flag-2'],
        })
      ),
    ]
    const combined = buildCombinedJudgeOutput(pages)
    expect(combined.enrichments.map((e) => e.checkId)).toEqual(['a', 'b'])
    expect(combined.newFlags.map((f) => f.problem)).toEqual(['flag-1', 'flag-2'])
  })

  it('throws when the primary page has no judge result', () => {
    const page = pageRun(judgeOutput({ rubricScores: { MESSAGE: 80, EXPERIENCE: 60, REACH: 90 } }))
    page.judge = undefined
    expect(() => buildCombinedJudgeOutput([page])).toThrow(/primary judge/)
  })
})
