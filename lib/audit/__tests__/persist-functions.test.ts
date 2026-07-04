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
      data: { status: 'FINALIZING', progress: 95 },
    })
  })
})
