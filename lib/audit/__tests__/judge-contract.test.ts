import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  validateJudgeOutput,
  normalizeJudgeRawOutput,
  JudgeContractError,
} from '@/lib/audit/validate-judge-output'
import { deduplicateFlags } from '@/lib/audit/deduplicate'
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge-schema'

function makeDet(partial: Partial<DeterministicFlag> & Pick<DeterministicFlag, 'checkId' | 'problem'>): DeterministicFlag {
  return {
    rubric: 'REACH',
    impactTag: null,
    severity: 'IMPORTANT',
    evidence: partial.evidence ?? partial.problem,
    fix: 'Fix it',
    confidence: 1,
    source: 'DETERMINISTIC',
    ...partial,
  }
}

function makeAiFlag(partial: Partial<JudgeOutput['newFlags'][number]>): JudgeOutput['newFlags'][number] {
  return {
    rubric: 'MESSAGE',
    impactTag: 'CONVERSION',
    severity: 'IMPORTANT',
    problem: 'AI detected issue',
    evidence: 'AI evidence',
    whyItMatters: 'This matters because',
    fix: 'Fix it with AI',
    confidence: 0.8,
    ...partial,
  }
}

function makeRubric(name: 'MESSAGE' | 'EXPERIENCE' | 'REACH', overrides: Record<string, unknown> = {}) {
  return {
    name,
    score: 75,
    grade: 'C' as const,
    status: 'NEEDS_WORK' as const,
    assessmentState: 'ASSESSED' as const,
    confidence: 0.8,
    summary: 'Some issues found',
    rubricPrompt: 'Fix all issues in this rubric',
    ...overrides,
  }
}

function makeEnrichment(checkId: string, overrides: Record<string, unknown> = {}) {
  return {
    checkId,
    whyItMatters: 'Fixing this matters',
    agentPrompt: 'Fix it',
    verificationRule: 'Re-run and confirm',
    ...overrides,
  }
}

// Shared valid baseline outputs

const validRubrics = [makeRubric('MESSAGE'), makeRubric('EXPERIENCE'), makeRubric('REACH')]

const baseJudgeOutput: Record<string, unknown> = {
  pageJob: 'Convert visitors into signups',
  pageType: 'homepage',
  verdict: 'This page needs work. Fix the headline first.',
  score: 65,
  launchReadiness: 'fix_first',
  launchChecklist: [
    { id: 'https', label: 'HTTPS enabled', passed: true },
    { id: 'social-preview', label: 'Social preview looks good', passed: true },
    { id: 'mobile-cta', label: 'Mobile CTA visible', passed: false },
    { id: 'console-errors', label: 'No console errors', passed: true },
    { id: 'privacy-contact', label: 'Privacy policy and contact present', passed: true },
  ],
  rubrics: validRubrics,
  newFlags: [],
  enrichments: [],
}

// ── normalizeJudgeRawOutput ──────────────────────────────────────

describe('normalizeJudgeRawOutput', () => {
  it('fills missing newFlags with empty array', () => {
    const raw = { ...baseJudgeOutput, newFlags: undefined }
    const result = normalizeJudgeRawOutput(raw, [])
    assert.ok(Array.isArray(result.newFlags))
    assert.equal(result.newFlags.length, 0)
  })

  it('fills missing enrichments with defaults for every deterministic flag', () => {
    const flags = [makeDet({ checkId: 'title-missing', problem: 'Title is missing' })]
    const raw = { ...baseJudgeOutput, newFlags: [], enrichments: undefined }
    const result = normalizeJudgeRawOutput(raw, flags) as unknown as JudgeOutput
    assert.equal(result.enrichments.length, 1)
    assert.equal(result.enrichments[0]?.checkId, 'title-missing')
    assert.ok(result.enrichments[0]?.whyItMatters)
    assert.ok(result.enrichments[0]?.agentPrompt)
    assert.ok(result.enrichments[0]?.verificationRule)
  })

  it('fills only missing enrichments when partial list exists', () => {
    const flags = [
      makeDet({ checkId: 'title-missing', problem: 'Title is missing' }),
      makeDet({ checkId: 'description-missing', problem: 'Description is missing' }),
    ]
    const raw = {
      ...baseJudgeOutput,
      newFlags: [],
      enrichments: [makeEnrichment('title-missing')],
    }
    const result = normalizeJudgeRawOutput(raw, flags) as unknown as JudgeOutput
    assert.equal(result.enrichments.length, 2)
    assert.ok(result.enrichments.some((e: { checkId: string }) => e.checkId === 'description-missing'))
  })

  it('leaves enrichments unchanged when all are present', () => {
    const flags = [makeDet({ checkId: 'title-missing', problem: 'Title is missing' })]
    const raw = {
      ...baseJudgeOutput,
      newFlags: [],
      enrichments: [makeEnrichment('title-missing')],
    }
    const result = normalizeJudgeRawOutput(raw, flags) as unknown as JudgeOutput
    assert.equal(result.enrichments.length, 1)
    assert.equal(result.enrichments[0]?.checkId, 'title-missing')
    assert.equal(result.enrichments[0]?.whyItMatters, 'Fixing this matters')
  })
})

// ── validateJudgeOutput ──────────────────────────────────────────

describe('validateJudgeOutput', () => {
  it('accepts a complete three-rubric contract', () => {
    const output = validateJudgeOutput(
      { ...baseJudgeOutput, rubrics: validRubrics, newFlags: [], enrichments: [] } as never,
      []
    )
    assert.equal(output.rubrics.length, 3)
  })

  it('rejects fewer than 3 rubrics', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            rubrics: [makeRubric('MESSAGE'), makeRubric('EXPERIENCE')],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects duplicate rubric names', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            rubrics: [makeRubric('MESSAGE'), makeRubric('MESSAGE'), makeRubric('REACH')],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects unsupported rubric name', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            rubrics: [makeRubric('MESSAGE'), { ...makeRubric('EXPERIENCE'), name: 'PERFORMANCE' }, makeRubric('REACH')],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects ASSESSED rubric with null score', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            rubrics: [makeRubric('MESSAGE', { score: null }), makeRubric('EXPERIENCE'), makeRubric('REACH')],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects non-ASSESSED rubric with non-null score', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            rubrics: [
              makeRubric('MESSAGE'),
              makeRubric('EXPERIENCE', { assessmentState: 'UNKNOWN', score: 50 }),
              makeRubric('REACH'),
            ],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects launch checklist with wrong count', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            launchChecklist: (baseJudgeOutput.launchChecklist as unknown[]).slice(0, 3),
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects duplicate launch checklist IDs', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            launchChecklist: [
              { id: 'https', label: 'HTTPS', passed: true },
              { id: 'https', label: 'HTTPS again', passed: true },
              { id: 'social-preview', label: 'Preview', passed: true },
              { id: 'mobile-cta', label: 'Mobile', passed: false },
              { id: 'privacy-contact', label: 'Privacy', passed: true },
            ],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects unsupported launch check ID', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            launchChecklist: [
              { id: 'https', label: 'HTTPS', passed: true },
              { id: 'social-preview', label: 'Preview', passed: true },
              { id: 'mobile-cta', label: 'Mobile', passed: false },
              { id: 'console-errors', label: 'Console', passed: true },
              { id: 'fake-check', label: 'Fake', passed: true },
            ],
            newFlags: [],
            enrichments: [],
          } as never,
          []
        ),
      JudgeContractError
    )
  })

  it('rejects missing enrichments for deterministic flags', () => {
    const flags = [makeDet({ checkId: 'title-missing', problem: 'Title missing' })]
    assert.throws(
      () =>
        validateJudgeOutput(
          { ...baseJudgeOutput, rubrics: validRubrics, newFlags: [], enrichments: [] } as never,
          flags
        ),
      JudgeContractError
    )
  })

  it('passes through valid output unchanged', () => {
    const flags = [makeDet({ checkId: 'title-missing', problem: 'Title missing' })]
    const output = validateJudgeOutput(
      {
        ...baseJudgeOutput,
        rubrics: validRubrics,
        newFlags: [],
        enrichments: [makeEnrichment('title-missing')],
      } as never,
      flags
    )
    assert.equal(output.rubrics.length, 3)
    assert.equal(output.enrichments.length, 1)
  })
})

// ── deduplicateFlags edge cases ──────────────────────────────────

describe('deduplicateFlags', () => {
  it('removes AI flag with exact problem match to deterministic', () => {
    const det = [makeDet({ checkId: 'title-missing', rubric: 'REACH', problem: 'Page title is missing' })]
    const ai = [makeAiFlag({ rubric: 'REACH', problem: 'Page title is missing' })]
    assert.equal(deduplicateFlags(det, ai).length, 0)
  })

  it('removes AI flag with high-evidence overlap to deterministic', () => {
    const det = [makeDet({ checkId: 'title-missing', problem: 'Page title is missing', evidence: 'No <title> tag found' })]
    const ai = [makeAiFlag({ problem: 'Missing page title tag', evidence: 'Page head lacks a title element' })]
    assert.equal(deduplicateFlags(det, ai).length, 0)
  })

  it('removes cross-rubric AI flag matching deterministic theme', () => {
    const det = [makeDet({ checkId: 'no-cta-detected', rubric: 'MESSAGE', problem: 'No call-to-action buttons found' })]
    const ai = [makeAiFlag({ rubric: 'REACH', problem: 'Primary CTA is hidden below the fold on mobile' })]
    assert.equal(deduplicateFlags(det, ai).length, 0)
  })

  it('keeps genuinely new AI flag with no overlap', () => {
    const det = [makeDet({ checkId: 'title-missing', problem: 'Title is missing' })]
    const ai = [makeAiFlag({ problem: 'Testimonials use placeholder names', evidence: 'Screenshot shows Acme Corp' })]
    assert.equal(deduplicateFlags(det, ai).length, 1)
  })

  it('deduplicates AI flags against each other', () => {
    const det: DeterministicFlag[] = []
    const ai = [
      makeAiFlag({ problem: 'Page load time too slow exceeds threshold', evidence: 'LCP very slow four point five seconds' }),
      makeAiFlag({ problem: 'Page load time exceeds threshold LCP is very slow', evidence: 'Slow load time over four point five seconds' }),
    ]
    const result = deduplicateFlags(det, ai)
    assert.ok(result.length < ai.length, `Expected deduplication: ${ai.length} → ${result.length}`)
  })

  it('returns empty array when no AI flags provided', () => {
    assert.equal(deduplicateFlags([], []).length, 0)
  })

  it('returns empty array when all AI flags are duplicates of deterministic', () => {
    const det = [makeDet({ checkId: 'og-image-missing', rubric: 'REACH', problem: 'og:image is missing' })]
    const ai = [makeAiFlag({ problem: 'No og:image meta tag detected' })]
    assert.equal(deduplicateFlags(det, ai).length, 0)
  })

  it('keeps multiple unique AI flags', () => {
    const det: DeterministicFlag[] = []
    const ai = [
      makeAiFlag({ problem: 'No testimonials section', evidence: 'Page lacks social proof' }),
      makeAiFlag({ problem: 'Contact form has no CSRF protection', evidence: 'Form submits without token' }),
    ]
    assert.equal(deduplicateFlags(det, ai).length, 2)
  })
})
