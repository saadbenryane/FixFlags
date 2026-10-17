import { observationsForFlag } from '../flag-observations'
import { admitAiObservation } from '../ai-observation-identity'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

// Stub Prisma before importing the persist module
const mockTx = {
  $queryRaw: vi.fn(async () => [{ id: 'audit-1' }]),
  flag: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  reportRubric: { upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
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
    mockTx.flag.findMany.mockResolvedValue([])
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

  it('preserves prior evidence and stable Flag identity across replay', async () => {
    const findings = [makeDet({ checkId: 'title-missing' })]
    await persistDeterministicFlags('audit-1', findings, baseRubricScores())
    const row = mockTx.flag.createMany.mock.calls[0][0].data[0]
    mockTx.flag.findMany.mockResolvedValue([{ id: 'stable-flag', source: row.source, fingerprint: row.fingerprint, affectedPaths: [] }])
    mockTx.flag.createMany.mockClear()
    await persistDeterministicFlags('audit-1', findings, baseRubricScores())
    expect(mockTx.flag.deleteMany).not.toHaveBeenCalled()
    expect(mockTx.flag.createMany).not.toHaveBeenCalled()
    expect(mockTx.flag.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'stable-flag' } }))
  })

  it('retains all source observations on incremental replay and uses the complete authoritative set on finalization', async () => {
    const first = makeDet({ checkId: 'title-missing', pageUrl: 'https://example.com/' })
    first.supportingObservations = observationsForFlag(first, { auditId: 'audit-1', taskId: 'first', checkVersion: 1 })
    await persistDeterministicFlags('audit-1', [first], baseRubricScores())
    const row = mockTx.flag.createMany.mock.calls.at(-1)![0].data[0]
    mockTx.flag.findMany.mockResolvedValue([{ id: 'stable', ...row }])
    const peer = makeDet({ checkId: first.checkId, pageUrl: 'https://example.com/pricing', evidence: 'Pricing title absent' })
    peer.supportingObservations = observationsForFlag(peer, { auditId: 'audit-1', taskId: 'peer', checkVersion: 1 })
    await persistDeterministicFlags('audit-1', [peer], baseRubricScores())
    const incremental = mockTx.flag.update.mock.calls.at(-1)![0].data.supportingObservations
    expect(incremental.items.map((item: { provenance: { taskId: string } }) => item.provenance.taskId)).toEqual(['first', 'peer'])
    await persistDeterministicFlags('audit-1', [peer], baseRubricScores(), undefined, { authoritativeProjection: true })
    expect(mockTx.flag.update.mock.calls.at(-1)![0].data.supportingObservations.items).toHaveLength(1)
    expect(mockTx.flag.deleteMany).not.toHaveBeenCalled()
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
    mockTx.reportRubric.upsert.mockImplementation((args) => {
      const name = (args as { create: { name: string } }).create.name
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
    expect(mockTx.reportRubric.upsert).toHaveBeenCalledTimes(3)
    // Should create 1 flag (the AI flag)
    expect(mockTx.flag.createMany).toHaveBeenCalledTimes(1)
    const flagData = (mockTx.flag.createMany.mock.calls[0] as unknown[])[0] as { data: unknown[] }
    const flag = flagData.data[0] as { problem: string }
    expect(flag.problem).toBe('AI discovered issue')
  })

  it('persists independent same-title AI observations with their original task evidence', async () => {
    const original = { rubric: 'EXPERIENCE' as const, impactTag: 'ACCESSIBILITY' as const, severity: 'IMPORTANT' as const,
      problem: 'Primary action is unclear', evidence: 'A consent dialog covers the signup action.',
      whyItMatters: 'Review the observed action.', confidence: 0.8, pageUrl: 'https://example.com/' }
    const origin = { auditId: 'audit-1', taskId: 'judge-1', collectedAt: '2026-10-16T10:00:00.000Z' }
    const first = admitAiObservation(original, origin)
    const second = admitAiObservation({ ...original, evidence: 'The action promise differs from its destination.' }, origin)
    await persistTriageResults('audit-1', makeTriageOutput({ newFlags: [first, second, first] }), [], {})
    const rows = mockTx.flag.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(2)
    expect(rows.map((row: { fingerprint: string }) => row.fingerprint)).toEqual([first.fingerprint, second.fingerprint])
    expect(rows[0].supportingObservations.items).toEqual(first.supportingObservations.items)
    expect(rows[1].supportingObservations.items).toEqual(second.supportingObservations.items)
  })

  it('handles 0 new AI flags', async () => {
    await persistTriageResults('audit-1', makeTriageOutput({ newFlags: [] }), [], {})

    expect(mockTx.reportRubric.upsert).toHaveBeenCalledTimes(3)
    expect(mockTx.flag.createMany).not.toHaveBeenCalled()
    const update = (mockTx.audit.update.mock.calls[0] as unknown[])[0] as {
      data: { verdict: string }
    }
    expect(update.data.verdict).toBe(
      'No supported priority issue was found in the captured evidence.'
    )
  })

  it('keeps critical Recommendations out of persisted priority verdicts and rubric summaries', async () => {
    await persistTriageResults('audit-1', makeTriageOutput({ newFlags: [{
      rubric: 'MESSAGE', impactTag: 'CLARITY', severity: 'CRITICAL',
      problem: 'Review the headline and supporting copy together', evidence: 'Headline: Welcome',
      whyItMatters: 'Consider whether this wording explains the page purpose.',
      confidence: 1, pageUrl: 'https://example.com/',
    }] }), [], baseRubricScores())

    expect(mockTx.flag.createMany.mock.calls[0][0].data).toHaveLength(1)
    expect(mockTx.audit.update.mock.calls[0][0].data.verdict).toBe(
      'No supported priority issue was found in the captured evidence.'
    )
    const message = mockTx.reportRubric.upsert.mock.calls
      .map(call => call[0] as { create: { name: string; summary: string } })
      .find(call => call.create.name === 'MESSAGE')
    expect(message?.create.summary).toBe('No supported priority issue was found in the captured evidence.')
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
    const experience = mockTx.reportRubric.upsert.mock.calls
      .map((call) => (call as unknown[])[0] as { create: { name: string; summary: string } })
      .find((call) => call.create.name === 'EXPERIENCE')
    expect(experience?.create.summary).toContain('Signup journey cannot reach confirmation')
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

    expect(prisma.flag.deleteMany).not.toHaveBeenCalled()
    expect(mockTx.flag.deleteMany).not.toHaveBeenCalled()
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

    const experienceCreate = mockTx.reportRubric.upsert.mock.calls
      .map((c) => (c as unknown[])[0] as { create: { name: string; score: number | null } })
      .find((c) => c.create.name === 'EXPERIENCE')
    // base EXPERIENCE score 80 minus CRITICAL(8) + IMPORTANT(4) = 68
    expect(experienceCreate?.create.score).toBe(68)
  })
})

// ── mergePrescriptionResults ────────────────────────────────────

describe('mergePrescriptionResults', () => {
  it('keeps measured source evidence and its verification protocol while adding repair guidance', async () => {
    mockTx.flag.findMany.mockResolvedValue([{ id: 'native-flag', checkId: 'overlay-blocks-cta', source: 'DETERMINISTIC',
      evidence: 'The original measured control remains covered after hover.', verificationRule: 'Control overlay observation v2',
      evidenceTargets: [{ kind: 'element', source: 'measured', device: 'desktop', label: 'Get started', selector: '#original', context: 'recorded-native-context' }] }])
    await mergePrescriptionResults('audit-1', { flagPrescriptions: [{ flagKey: 'overlay-blocks-cta', evidence: 'A broader interpretation of the page',
      whyItMatters: 'Visitors need the original action.', fix: 'Remove the covering advertisement.', agentPrompt: null,
      cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null,
      verificationRule: 'Look at a fresh screenshot.' }], rubricPrescriptions: [] })
    expect(mockTx.flag.update).toHaveBeenCalledWith({ where: { id: 'native-flag' }, data: expect.objectContaining({
      fix: 'Remove the covering advertisement.',
    }) })
  })
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
        fix: 'Updated fix',
      }),
    })
  })

  it('enriches same-title observations only through their exact admitted identities', async () => {
    const base = { rubric: 'EXPERIENCE', problem: 'Primary action is unclear', pageUrl: 'https://example.com/' }
    const first = admitAiObservation({ ...base, evidence: 'Covered action' })
    const second = admitAiObservation({ ...base, evidence: 'Mismatched destination' })
    mockTx.flag.findMany.mockResolvedValue([{ ...first, id: 'first', checkId: null }, { ...second, id: 'second', checkId: null }])
    const prescription = { flagKey: second.fingerprint, evidence: 'Mismatched destination', whyItMatters: 'The destination should match the promise.',
      fix: 'Correct this destination.', agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null,
      lovablePrompt: null, boltPrompt: null, verificationRule: 'Inspect the destination.' }
    await mergePrescriptionResults('audit-1', { flagPrescriptions: [prescription], rubricPrescriptions: [] })
    expect(mockTx.flag.update).toHaveBeenCalledTimes(1)
    expect(mockTx.flag.update).toHaveBeenCalledWith({ where: { id: 'second' }, data: expect.objectContaining({ fix: prescription.fix }) })
    expect(mockTx.flag.update.mock.calls[0][0].data).not.toHaveProperty('fingerprint')
  })

  it.each(['AI', 'JOURNEY', 'DETERMINISTIC'])('preserves the complete recorded assessment for %s findings', async source => {
    const original = { id: 'original', source, checkId: 'recorded', evidence: 'The original control has no accessible name.',
      whyItMatters: 'The name is unavailable to assistive technology.', verificationRule: 'Inspect the original desktop and mobile controls.',
      supportingObservations: { version: 1, observations: [{ pageUrl: 'https://example.com/original' }] } }
    mockTx.flag.findMany.mockResolvedValue([original])
    const snapshot = structuredClone(original)
    await mergePrescriptionResults('audit-1', { flagPrescriptions: [{ flagKey: 'recorded', evidence: 'A different screenshot proves a different issue.',
      whyItMatters: 'This loses thousands of customers and reduces conversion.', verificationRule: 'Any page passes an unrelated score.',
      fix: 'Add the original control name.', agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null,
      lovablePrompt: null, boltPrompt: null }], rubricPrescriptions: [] })
    const update = mockTx.flag.update.mock.calls[0][0].data
    for (const key of ['evidence', 'whyItMatters', 'verificationRule', 'supportingObservations', 'severity', 'problem'])
      expect(update).not.toHaveProperty(key)
    expect(update.fix).toBe('Add the original control name.')
    expect(original).toEqual(snapshot)
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
      data: expect.objectContaining({ fix: 'Real fix' }),
    })
  })

  it('flows tool-specific repair prompts without changing verification obligations', async () => {
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
      }),
    })
  })
})
