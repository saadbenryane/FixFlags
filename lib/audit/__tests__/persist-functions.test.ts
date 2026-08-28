import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

// Stub Prisma before importing the persist module
const mockTx = {
  flag: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  reportRubric: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  auditPage: { findMany: vi.fn() },
  audit: { update: vi.fn(), findUnique: vi.fn() },
  creditPurchase: { aggregate: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(mockTx)
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg)
      }
      return arg
    }),
  flag: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    reportRubric: { deleteMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    auditPage: { findMany: vi.fn() },
    audit: { update: vi.fn(), findUnique: vi.fn() },
    creditPurchase: { aggregate: vi.fn() },
  },
}))

import {
  persistDeterministicFlags,
  persistTriageResults,
  mergePrescriptionResults,
} from '@/lib/audit/persist'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'
import type { RubricName } from '@prisma/client'

function makeDet(overrides: Partial<DeterministicFlag> & Pick<DeterministicFlag, 'checkId'>): DeterministicFlag {
  return {
    rubric: 'REACH',
    impactTag: null,
    severity: 'IMPORTANT',
    problem: 'Test problem',
    evidence: 'Test evidence',
    fix: 'Fix it',
    confidence: 1,
    source: 'DETERMINISTIC',
    ...overrides,
  }
}

function makeRubricCreate(name: string) {
  return { id: `rubric-${name}`, name }
}

function baseRubricScores(): Partial<Record<RubricName, number | null>> {
  return { MESSAGE: 75, EXPERIENCE: 80, REACH: 70 }
}

function mockPageFindOnePage() {
  mockTx.auditPage.findMany.mockResolvedValue([
    { id: 'page-1', normalizedUrl: 'https://example.com/' },
  ])
}

function makeRubricOutput(name: string, score: number | null) {
  return {
    name: name as RubricName,
    score,
    // Triage/full rubric schemas require a non-null grade even when the score
    // is unavailable, so fall back to 'F' rather than null.
    grade: (score !== null ? (score >= 80 ? 'B' : 'C') : 'F') as 'A' | 'B' | 'C' | 'D' | 'F',
    status: 'NEEDS_WORK' as const,
    assessmentState: (score !== null ? 'ASSESSED' : 'PARTIAL') as 'ASSESSED' | 'PARTIAL',
    confidence: 0.85,
    summary: `${name} assessment`,
    rubricPrompt: `Fix ${name}`,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
  }
}

describe('persistDeterministicFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPageFindOnePage()
    mockTx.reportRubric.findFirst.mockResolvedValue(null)
    mockTx.reportRubric.create.mockImplementation((args) => {
      const name = (args as { data: { name: string } }).data.name
      return Promise.resolve(makeRubricCreate(name))
    })
  })

  it('creates rubric rows and flags for deterministic results', async () => {
    const flags = [makeDet({ checkId: 'title-missing', problem: 'Title is missing' })]

    await persistDeterministicFlags('audit-1', flags, baseRubricScores())

    // Should create 3 rubric records
    expect(mockTx.reportRubric.create).toHaveBeenCalledTimes(3)
    const createdRubricNames = mockTx.reportRubric.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { name: string } }).data.name
    )
    expect(createdRubricNames.sort()).toEqual(['EXPERIENCE', 'MESSAGE', 'REACH'])

    // Should create 1 flag
    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as { data: unknown[] }
    expect(flagData.data).toHaveLength(1)
    expect((flagData.data[0] as { checkId: string }).checkId).toBe('title-missing')

    // Should update audit with score
    expect(mockTx.audit.update).toHaveBeenCalledTimes(1)
    const updateArgs = (mockTx.audit.update.mock.calls[0] as unknown[])[0] as { data: { score: number } }
    expect(typeof updateArgs.data.score).toBe('number')
  })

  it('handles 0 flags gracefully', async () => {
    await persistDeterministicFlags('audit-1', [], baseRubricScores())

    expect(mockTx.reportRubric.create).toHaveBeenCalledTimes(3)
    // Should NOT call createMany when there are no flags
    expect(mockTx.flag.createMany).not.toHaveBeenCalled()
    expect(mockTx.audit.update).toHaveBeenCalledTimes(1)
  })

  it('handles many flags without errors', async () => {
    const manyFlags: DeterministicFlag[] = []
    for (let i = 0; i < 100; i++) {
      manyFlags.push(makeDet({ checkId: `check-${i}`, problem: `Problem ${i}` }))
    }

    await persistDeterministicFlags('audit-1', manyFlags, baseRubricScores())

    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as { data: unknown[] }
    expect(flagData.data).toHaveLength(100)
  })

  it('deletes existing deterministic flags before inserting', async () => {
    await persistDeterministicFlags('audit-1', [makeDet({ checkId: 'title-missing' })], baseRubricScores())

    expect(mockTx.flag.deleteMany).toHaveBeenCalledWith({
      where: { auditId: 'audit-1', source: 'DETERMINISTIC' },
    })
  })

  it('handles partial rubric scores (some null)', async () => {
    const scores = { MESSAGE: 90, EXPERIENCE: null, REACH: null } as Partial<Record<RubricName, number | null>>

    await persistDeterministicFlags('audit-1', [], scores)

    const createCalls = mockTx.reportRubric.create.mock.calls.map(
      (c: unknown[]) => ({
        name: (c[0] as { data: { name: string } }).data.name,
        score: (c[0] as { data: { score: number | null } }).data.score,
      })
    )
    const msg = createCalls.find((c: { name: string }) => c.name === 'MESSAGE')
    expect(msg!.score).toBe(90)
    const exp = createCalls.find((c: { name: string }) => c.name === 'EXPERIENCE')
    expect(exp!.score).toBeNull()
  })

  it('collapses duplicate deterministic Flags into one row with affectedPaths', async () => {
    const dup = makeDet({
      checkId: 'title-missing',
      problem: 'Title is missing',
      pageUrl: 'https://example.com/',
    })

    await persistDeterministicFlags(
      'audit-1',
      [dup, { ...dup, pageUrl: 'https://example.com/pricing' }],
      baseRubricScores()
    )

    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as {
      data: Array<{ fingerprint: string; affectedPaths?: unknown }>
    }
    expect(flagData.data).toHaveLength(1)
    expect(flagData.data[0]?.affectedPaths).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
    ])
  })
})

// ── persistTriageResults ────────────────────────────────────────

function makeTriageOutput(overrides: Partial<TriageOutput> = {}): TriageOutput {
  return {
    pageJob: 'Sell',
    pageType: 'homepage',
    verdict: 'Needs work',
    score: 70,
    launchReadiness: 'fix_first',
    launchChecklist: [
      { id: 'https', label: 'HTTPS', passed: true },
      { id: 'social-preview', label: 'Social preview', passed: true },
      { id: 'mobile-cta', label: 'Mobile CTA', passed: false },
      { id: 'console-errors', label: 'Console errors', passed: true },
      { id: 'privacy-contact', label: 'Privacy & contact', passed: true },
    ],
    rubrics: [makeRubricOutput('MESSAGE', 75), makeRubricOutput('EXPERIENCE', 80), makeRubricOutput('REACH', 70)],
    newFlags: [],
    ...overrides,
  }
}

describe('persistTriageResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPageFindOnePage()
    mockTx.reportRubric.create.mockImplementation((args) => {
      const name = (args as { data: { name: string } }).data.name
      return Promise.resolve(makeRubricCreate(name))
    })
    mockTx.flag.findMany.mockResolvedValue([])
  })

  it('creates rubrics and flags from triage output', async () => {
    const triageOutput = makeTriageOutput({
      newFlags: [
        {
          rubric: 'MESSAGE' as const,
          impactTag: 'CONVERSION' as const,
          severity: 'IMPORTANT' as const,
          problem: 'AI discovered issue',
          evidence: 'Hero CTA is below the fold on mobile.',
          whyItMatters: 'Mobile visitors may never start signup.',
          confidence: 0.7,
          pageUrl: null,
        },
      ],
    })

    await persistTriageResults('audit-1', triageOutput, [], {})

    // Should create 3 rubric records
    expect(mockTx.reportRubric.create).toHaveBeenCalledTimes(3)
    // Should create 1 flag (the AI flag)
    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as { data: unknown[] }
    const flag = flagData.data[0] as { problem: string }
    expect(flag.problem).toBe('AI discovered issue')
  })

  it('handles 0 new AI flags', async () => {
    await persistTriageResults('audit-1', makeTriageOutput({ newFlags: [] }), [], {})

    expect(mockTx.reportRubric.create).toHaveBeenCalledTimes(3)
    expect(mockTx.flag.createMany).not.toHaveBeenCalled()
    const update = (mockTx.audit.update.mock.calls[0] as unknown[])[0] as {
      data: { verdict: string }
    }
    expect(update.data.verdict).toBe(
      'No supported priority issue was found in the captured evidence.'
    )
  })

  it('grounds the stored verdict in a critical secondary-page Flag', async () => {
    await persistTriageResults(
      'audit-1',
      makeTriageOutput({
        verdict: 'The mobile CTA is hidden.',
        newFlags: [
          {
            rubric: 'MESSAGE',
            impactTag: 'CLARITY',
            severity: 'IMPORTANT',
            problem: 'Homepage headline is vague',
            evidence: 'The headline does not name an outcome.',
            whyItMatters: 'Visitors may not understand the offer.',
            confidence: 0.8,
            pageUrl: null,
          },
        ],
      }),
      [
        makeDet({
          checkId: 'flow-cta-unclickable::page:1',
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          problem: 'Pricing signup action cannot be clicked',
          pageUrl: 'https://example.com/pricing',
        }),
      ],
      baseRubricScores()
    )

    const update = (mockTx.audit.update.mock.calls[0] as unknown[])[0] as {
      data: { verdict: string }
    }
    expect(update.data.verdict).toContain('Pricing signup action cannot be clicked')
    expect(update.data.verdict).not.toContain('mobile CTA')
  })

  it('includes preserved JOURNEY Flags in the stored verdict and rubric summary', async () => {
    mockTx.flag.findMany.mockResolvedValue([
      {
        id: 'journey-1',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Signup journey cannot reach confirmation',
        whyItMatters: 'New customers cannot finish creating an account.',
        checkId: 'journey-signup-blocked',
        impactTag: 'CONVERSION',
        confidence: 1,
      },
    ])

    await persistTriageResults('audit-1', makeTriageOutput(), [], baseRubricScores())

    const update = (mockTx.audit.update.mock.calls[0] as unknown[])[0] as {
      data: { verdict: string }
    }
    expect(update.data.verdict).toBe(
      'Highest priority: Signup journey cannot reach confirmation. New customers cannot finish creating an account.'
    )
    const experience = mockTx.reportRubric.create.mock.calls
      .map((call) => (call as unknown[])[0] as { data: { name: string; summary: string } })
      .find((call) => call.data.name === 'EXPERIENCE')
    expect(experience?.data.summary).toContain('Signup journey cannot reach confirmation')
  })

  it('merges deterministic flags with AI flags', async () => {
    const detFlags = [makeDet({ checkId: 'title-missing', problem: 'Title is missing' })]

    await persistTriageResults('audit-1', makeTriageOutput({ newFlags: [] }), detFlags, baseRubricScores())

    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as { data: unknown[] }
    expect((flagData.data[0] as { checkId: string }).checkId).toBe('title-missing')
  })

  it('sets status to FINALIZING and updates audit', async () => {
    await persistTriageResults('audit-1', makeTriageOutput(), [], {})

    expect(mockTx.audit.update).toHaveBeenCalledTimes(1)
    const data = (mockTx.audit.update.mock.calls[0] as unknown[])[0] as {
      data: { status: string; progress: number }
    }
    expect(data.data.status).toBe('FINALIZING')
    expect(data.data.progress).toBe(95)
  })

  it('handles a large volume of deterministic + AI flags in one insert', async () => {
    const manyDet: DeterministicFlag[] = []
    for (let i = 0; i < 100; i++) {
      manyDet.push(makeDet({ checkId: `check-${i}`, problem: `Problem ${i}` }))
    }
    const triageOutput = makeTriageOutput({
      newFlags: [
        { rubric: 'MESSAGE' as const, impactTag: 'CONVERSION' as const, severity: 'IMPORTANT' as const, problem: 'AI flag A', evidence: 'Evidence A', whyItMatters: 'Impact A', confidence: 0.7, pageUrl: null },
        { rubric: 'EXPERIENCE' as const, impactTag: 'FRICTION' as const, severity: 'POLISH' as const, problem: 'AI flag B', evidence: 'Evidence B', whyItMatters: 'Impact B', confidence: 0.6, pageUrl: null },
        { rubric: 'REACH' as const, impactTag: 'SEO' as const, severity: 'IMPORTANT' as const, problem: 'AI flag C', evidence: 'Evidence C', whyItMatters: 'Impact C', confidence: 0.8, pageUrl: null },
      ],
    })

    await persistTriageResults('audit-1', triageOutput, manyDet, baseRubricScores())

    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as { data: unknown[] }
    expect(flagData.data).toHaveLength(103)
  })

  it('preserves JOURNEY flags when clearing triage results', async () => {
    const { prisma } = await import('@/lib/db')
    await persistTriageResults('audit-1', makeTriageOutput(), [], baseRubricScores())

    expect(prisma.flag.deleteMany).toHaveBeenCalledWith({
      where: { auditId: 'audit-1', source: { in: ['DETERMINISTIC', 'AI'] } },
    })
  })

  it('applies journey severity penalties to rubric scores', async () => {
    mockTx.flag.findMany.mockResolvedValue([
      {
        id: 'journey-critical',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Checkout journey is blocked',
        whyItMatters: 'Customers cannot complete payment.',
        checkId: 'journey-checkout-blocked',
        impactTag: 'REVENUE',
        confidence: 1,
      },
      {
        id: 'journey-important',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: 'Checkout feedback is unclear',
        whyItMatters: 'Customers may retry payment unnecessarily.',
        checkId: 'journey-checkout-feedback',
        impactTag: 'FRICTION',
        confidence: 1,
      },
    ])

    await persistTriageResults('audit-1', makeTriageOutput(), [], baseRubricScores())

    const experienceCreate = mockTx.reportRubric.create.mock.calls
      .map((c) => (c as unknown[])[0] as { data: { name: string; score: number | null } })
      .find((c) => c.data.name === 'EXPERIENCE')
    // base EXPERIENCE score 80 minus CRITICAL(8) + IMPORTANT(4) = 68
    expect(experienceCreate?.data.score).toBe(68)
  })
})

// ── mergePrescriptionResults ────────────────────────────────────

describe('mergePrescriptionResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTx.flag.findMany.mockResolvedValue([
      { id: 'flag-1', checkId: 'title-missing', fingerprint: 'fp-1' },
      { id: 'flag-2', checkId: null, fingerprint: 'fp-2' },
    ])
    mockTx.flag.update.mockResolvedValue({} as never)
    mockTx.reportRubric.updateMany.mockResolvedValue({ count: 1 })
    mockTx.audit.update.mockResolvedValue({} as never)
  })

  it('applies prescriptions to matching flags by flagKey', async () => {
    await mergePrescriptionResults('audit-1', {
      flagPrescriptions: [
        {
          flagKey: 'title-missing',
          evidence: 'Updated evidence',
          whyItMatters: 'Updated impact',
          fix: 'Updated fix',
          agentPrompt: null,
          cursorPrompt: null,
          claudePrompt: null,
          windsurfPrompt: null,
          lovablePrompt: null,
          boltPrompt: null,
          verificationRule: 'Verify in browser',
        },
      ],
      rubricPrescriptions: [],
    })

    expect(mockTx.flag.update).toHaveBeenCalledTimes(1)
    expect(mockTx.flag.update).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
      data: expect.objectContaining({
        evidence: 'Updated evidence',
        whyItMatters: 'Updated impact',
      }),
    })
  })

  it('applies rubric prescriptions to matching rubrics', async () => {
    await mergePrescriptionResults('audit-1', {
      flagPrescriptions: [],
      rubricPrescriptions: [
        {
          name: 'MESSAGE',
          rubricPrompt: 'Fix the message clarity',
          cursorPrompt: 'Improve headline',
          claudePrompt: null,
          windsurfPrompt: null,
          lovablePrompt: null,
          boltPrompt: null,
        },
      ],
    })

    expect(mockTx.reportRubric.updateMany).toHaveBeenCalledWith({
      where: { auditId: 'audit-1', name: 'MESSAGE' },
      data: expect.objectContaining({
        rubricPrompt: 'Fix the message clarity',
        cursorPrompt: 'Improve headline',
      }),
    })
  })

  it('skips flags with no matching prescription', async () => {
    await mergePrescriptionResults('audit-1', {
      flagPrescriptions: [],
      rubricPrescriptions: [],
    })

    expect(mockTx.flag.update).not.toHaveBeenCalled()
    expect(mockTx.audit.update).toHaveBeenCalledTimes(1)
  })

  it('updates audit status to FINALIZING', async () => {
    await mergePrescriptionResults('audit-1', {
      flagPrescriptions: [],
      rubricPrescriptions: [],
    })

    expect(mockTx.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { status: 'FINALIZING', progress: PIPELINE_PROGRESS.FINALIZING_PERSIST },
    })
  })

  it('discards a prescription with blank evidence instead of overwriting the flag', async () => {
    // Whitespace-only evidence passes the schema's `.min(1)` but must not blank
    // out a flag: the item is discarded, and the valid one still applies.
    await mergePrescriptionResults('audit-1', {
      flagPrescriptions: [
        {
          flagKey: 'title-missing',
          evidence: '   ',
          whyItMatters: 'x',
          fix: 'y',
          agentPrompt: null,
          cursorPrompt: null,
          claudePrompt: null,
          windsurfPrompt: null,
          lovablePrompt: null,
          boltPrompt: null,
          verificationRule: 'z',
        },
        {
          flagKey: 'fp-2',
          evidence: 'Real evidence',
          whyItMatters: 'Real impact',
          fix: 'Real fix',
          agentPrompt: null,
          cursorPrompt: null,
          claudePrompt: null,
          windsurfPrompt: null,
          lovablePrompt: null,
          boltPrompt: null,
          verificationRule: 'Verify it',
        },
      ],
      rubricPrescriptions: [],
    })

    expect(mockTx.flag.update).toHaveBeenCalledTimes(1)
    expect(mockTx.flag.update).toHaveBeenCalledWith({
      where: { id: 'flag-2' },
      data: expect.objectContaining({ evidence: 'Real evidence' }),
    })
  })

  it('flows tool-specific fix prompts and verification rule through to the flag row', async () => {
    await mergePrescriptionResults('audit-1', {
      flagPrescriptions: [
        {
          flagKey: 'title-missing',
          evidence: 'The <title> tag is empty',
          whyItMatters: 'Search snippets show the URL instead',
          fix: 'Add a descriptive <title>',
          agentPrompt: 'agent: set the title',
          cursorPrompt: 'cursor: set the title',
          claudePrompt: 'claude: set the title',
          windsurfPrompt: null,
          lovablePrompt: 'lovable: set the title',
          boltPrompt: 'bolt: set the title',
          verificationRule: 'Confirm the tab shows a real title',
        },
      ],
      rubricPrescriptions: [],
    })

    expect(mockTx.flag.update).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
      data: expect.objectContaining({
        agentPrompt: 'agent: set the title',
        cursorPrompt: 'cursor: set the title',
        claudePrompt: 'claude: set the title',
        lovablePrompt: 'lovable: set the title',
        boltPrompt: 'bolt: set the title',
        verificationRule: 'Confirm the tab shows a real title',
      }),
    })
  })
})
