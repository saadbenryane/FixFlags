import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  flagFindMany: vi.fn(),
  flagCreate: vi.fn(),
  reviewCreate: vi.fn(),
  findingUpdate: vi.fn(),
  flagUpdate: vi.fn(),
  auditFindUnique: vi.fn(),
  flagFindUnique: vi.fn(),
  writeTail: Promise.resolve() as Promise<unknown>,
  owner: undefined as { taskId: string } | undefined,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    flag: { findMany: mocks.flagFindMany, create: mocks.flagCreate, update: mocks.flagUpdate },
    audit: { findUnique: mocks.auditFindUnique },
    journeyReview: { create: mocks.reviewCreate },
    journeyFinding: { updateMany: mocks.findingUpdate },
  },
}))
vi.mock('@/lib/audit/execution-ownership', () => ({
  currentExecutionOwnership: () => mocks.owner,
  executionWrite: (work: (tx: unknown) => unknown) => {
    const result = mocks.writeTail.then(() => work({
    flag: { findMany: mocks.flagFindMany, findUniqueOrThrow: mocks.flagFindUnique, create: mocks.flagCreate, update: mocks.flagUpdate },
    journeyReview: { create: mocks.reviewCreate }, journeyFinding: { updateMany: mocks.findingUpdate },
    }))
    mocks.writeTail = result.then(() => undefined, () => undefined)
    return result
  },
}))

import {
  omitRepeatedCustomerFindings,
  persistJourneyResult,
} from '@/lib/audit/journey/run-journey-reviews'
import { consolidateFlagsByCheck } from '@/lib/audit/consolidate-flags'
import { collapseFlagsWithAffectedPaths, observationIdentity } from '@/lib/audit/flag-identity'
import { projectedJourneyFinding } from '@/lib/audit/checks/journey-evidence'
import { observationsForFlag } from '@/lib/audit/flag-observations'
import { deriveTruthLabel } from '@/lib/report/explorer-model'

const page = 'https://example.net/'
const missingStep = {
  checkId: 'journey-pricing-evaluation-hidden-cta',
  stepNumber: 1,
  url: page,
  rubric: 'EXPERIENCE' as const,
  severity: 'CRITICAL' as const,
  impactTag: 'CONVERSION' as const,
  problem: 'No obvious primary CTA on first visit',
  evidence: 'No primary action stands out on the first screen.',
  whyItMatters: 'People who arrive here have nothing clear to do next.',
  fix: 'Add one primary action above the fold.',
  confidence: 0.85,
}

describe('customer Flags from a page walk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.owner = undefined
    mocks.writeTail = Promise.resolve()
    mocks.flagUpdate.mockReset()
    mocks.flagFindUnique.mockReset()
    mocks.flagFindMany.mockResolvedValue([])
    mocks.auditFindUnique.mockResolvedValue({ executionSpec: { version: 1, scope: 'SITE', targetUrl: page,
      environment: 'production', checks: { 'journey-hidden-cta': 1 }, outcomes: [], verificationTarget: null } })
    mocks.reviewCreate.mockResolvedValue({ id: 'review-1' })
    mocks.flagCreate.mockResolvedValue({ id: 'flag-1' })
    mocks.findingUpdate.mockResolvedValue({ count: 1 })
  })

  it('retains deferred native overlay evidence when another probe already created the customer Flag', async () => {
    const overlay = { ...missingStep, checkId: 'overlay-blocks-nav',
      verificationRule: 'Control overlay observation v2',
      evidenceTargets: [{ kind: 'element' as const, source: 'measured' as const, device: 'desktop' as const,
        selector: '#original', label: 'Original navigation', context: 'overlay:recorded:journey_signup_nav' }] }
    mocks.flagFindMany.mockResolvedValue([{ problem: overlay.problem, pageUrl: page }])
    await persistJourneyResult('audit-1', { findings: [overlay], steps: [], journeyType: 'signup', startUrl: page,
      status: 'FAILED', goalAchieved: false, blockedReason: null, abandonedReason: null, durationMs: 10,
      formProbe: null, actionTimeline: [] }, undefined, undefined, true)
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.reviewCreate.mock.calls[0][0].data.findings.create).toEqual([
      expect.objectContaining({ checkId: 'overlay-blocks-nav', evidence: expect.stringContaining(overlay.evidence) }),
    ])
  })

  it('keeps one Flag when a later walk repeats the same missing action', async () => {
    expect(omitRepeatedCustomerFindings(
      [{ checkId: missingStep.checkId, problem: missingStep.problem, pageUrl: page }],
      [missingStep],
    )).toEqual([])

    mocks.flagFindMany.mockResolvedValue([
      { id: 'original', checkId: missingStep.checkId, problem: missingStep.problem, pageUrl: page },
    ])

    await persistJourneyResult('audit-1', {
      findings: [missingStep],
      steps: [],
      journeyType: 'pricing-evaluation',
      startUrl: page,
      status: 'ABANDONED',
      goalAchieved: false,
      blockedReason: null,
      abandonedReason: 'No suitable same-origin navigation target',
      durationMs: 10,
      formProbe: null,
      actionTimeline: [],
    })

    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.reviewCreate.mock.calls[0][0].data.findings.create).toHaveLength(1)
    expect(mocks.findingUpdate.mock.calls[0][0].data.flagId).toBe('original')
  })

  it('never establishes equivalence from a matching title alone', () => {
    expect(omitRepeatedCustomerFindings([{ problem: missingStep.problem, pageUrl: page }], [missingStep])).toEqual([missingStep])
    expect(omitRepeatedCustomerFindings([{ checkId: 'journey-signup-no-form', problem: missingStep.problem, pageUrl: page }], [missingStep])).toEqual([missingStep])
  })

  it('keeps every repeat walk observation behind the single check action with actual task provenance', async () => {
    mocks.owner = { taskId: 'journey-task' }
    await persistJourneyResult('audit-1', { findings: [missingStep, { ...missingStep, stepNumber: 2, evidence: 'The action is also absent after opening navigation.' }],
      steps: [], journeyType: 'first-visit', startUrl: page, status: 'ABANDONED', goalAchieved: false,
      blockedReason: null, abandonedReason: null, durationMs: 10, formProbe: null, actionTimeline: [] })
    expect(mocks.flagCreate).toHaveBeenCalledTimes(1)
    const saved = mocks.flagCreate.mock.calls[0][0].data
    expect(saved.supportingObservations.items).toHaveLength(2)
    expect(saved.supportingObservations.items[1]).toMatchObject({ checkVersion: 1, evidence: expect.stringContaining('after opening navigation'),
      provenance: { auditId: 'audit-1', taskId: 'journey-task' } })
    expect(mocks.reviewCreate.mock.calls[0][0].data.findings.create).toHaveLength(2)
    expect(mocks.findingUpdate.mock.calls[0][0].where.OR).toHaveLength(2)
  })

  it('keeps different evaluator diagnoses distinct even when their title and class match', async () => {
    const ai = { ...missingStep, checkId: 'journey-funnel-broken-promise', source: 'AI' as const, findingType: 'broken-promise' as const }
    await persistJourneyResult('audit-1', { findings: [ai, { ...ai, evidence: 'The trial destination is a contact form.' }],
      steps: [], journeyType: 'first-visit', startUrl: page, status: 'COMPLETED', goalAchieved: true,
      blockedReason: null, abandonedReason: null, durationMs: 10, formProbe: null, actionTimeline: [] })
    expect(mocks.flagCreate).toHaveBeenCalledTimes(2)
    const saved = mocks.flagCreate.mock.calls.map(call => call[0].data)
    expect(saved[0].fingerprint).not.toBe(saved[1].fingerprint)
    expect(saved[0].evidence).toMatch(/^Reviewed at step/)
    expect(saved[0].source).toBe('AI')
    expect(deriveTruthLabel(saved[0].source, saved[0].checkId)).toBe('Observed')
  })

  it('keeps native diagnosis classification independent of AI origin and admitted check version', async () => {
    mocks.owner = { taskId: 'native-walk' }
    mocks.auditFindUnique.mockResolvedValue({ executionSpec: { version: 1, scope: 'SITE', targetUrl: page,
      environment: 'production', checks: { 'journey-funnel-timeout': 1 }, outcomes: [], verificationTarget: null } })
    const native = { ...missingStep, checkId: 'journey-funnel-timeout', source: 'JOURNEY' as const, findingType: 'friction' as const,
      problem: 'Loading UI observed', evidence: 'A loading indicator was present at the checked destination.' }
    await persistJourneyResult('audit-1', { findings: [native], steps: [], journeyType: 'first-visit', startUrl: page,
      status: 'COMPLETED', goalAchieved: false, blockedReason: null, abandonedReason: null,
      durationMs: 10, formProbe: null, actionTimeline: [] })
    const saved = mocks.flagCreate.mock.calls[0][0].data
    expect(saved.source).toBe('JOURNEY')
    expect(saved.evidence).toMatch(/^Reproduced at step/)
    expect(saved.whyItMatters).toContain('Loading UI was recorded')
    expect(saved.supportingObservations.items[0]).toMatchObject({ source: 'JOURNEY', checkVersion: 1 })
  })

  it('does not group an AI interpretation with the same native recorded narrative', () => {
    const native = { ...missingStep, checkId: 'journey-funnel-dead-end', source: 'JOURNEY' as const }
    expect(omitRepeatedCustomerFindings([{ ...native, pageUrl: page }], [{ ...native, source: 'AI' as const }])).toHaveLength(1)
  })

  it('preserves declared funnel mechanisms and every observation through persistence, Improvement identity, and display', async () => {
    mocks.owner = { taskId: 'native-walk' }
    mocks.auditFindUnique.mockResolvedValue({ executionSpec: { version: 1, scope: 'SITE', targetUrl: page,
      environment: 'production', checks: { 'journey-funnel-dead-end': 1 }, outcomes: [], verificationTarget: null } })
    const base = { ...missingStep, checkId: 'journey-funnel-dead-end', source: 'JOURNEY' as const }
    const empty = { ...base, conditionId: 'missing-content', problem: 'No recognized substantive content', evidence: 'No substantive content was recorded.' }
    const noPath = { ...base, conditionId: 'missing-continuation', problem: 'No eligible continuation', evidence: 'No eligible same-origin link was recorded.' }
    expect(projectedJourneyFinding(empty)).toBe(false)
    expect(omitRepeatedCustomerFindings([], [empty, { ...empty, stepNumber: 2 }, noPath])).toHaveLength(2)
    await persistJourneyResult('audit-1', { findings: [empty, { ...empty, stepNumber: 2 }, noPath], steps: [], journeyType: 'first-visit',
      startUrl: page, status: 'COMPLETED', goalAchieved: false, blockedReason: null, abandonedReason: null,
      durationMs: 10, formProbe: null, actionTimeline: [] }, undefined, undefined, true)
    const rows = mocks.flagCreate.mock.calls.map((call, index) => ({ ...call[0].data, id: `saved-${index}` }))
    expect(rows).toHaveLength(2)
    expect(rows[0].fingerprint).not.toBe(rows[1].fingerprint)
    expect(rows[0].supportingObservations.items).toHaveLength(2)
    expect(rows[0].supportingObservations.items[0]).toMatchObject({ source: 'JOURNEY', checkId: 'journey-funnel-dead-end', checkVersion: 1 })
    expect(new Set(rows.map(observationIdentity)).size).toBe(2)
    expect(collapseFlagsWithAffectedPaths(rows)).toHaveLength(2)
    const displayed = consolidateFlagsByCheck(rows)
    expect(displayed).toHaveLength(2)
    expect(displayed[0].supportingObservations).toEqual(rows[0].supportingObservations)
    expect(displayed.map(row => row.fix)).toEqual(rows.map(row => row.fix))
  })

  it('appends a later equivalent observation without replacing the first task evidence', async () => {
    mocks.owner = { taskId: 'later-task' }
    const original = observationsForFlag({ ...missingStep, checkId: 'journey-hidden-cta', source: 'JOURNEY', pageUrl: page },
      { auditId: 'audit-1', taskId: 'original-task', checkVersion: 1, collectedAt: '2026-10-16T10:00:00.000Z' })
    const row = { ...missingStep, id: 'original-flag', source: 'JOURNEY', pageUrl: page, supportingObservations: original }
    mocks.flagFindMany.mockResolvedValue([row])
    mocks.flagFindUnique.mockResolvedValue(row)
    await persistJourneyResult('audit-1', { findings: [{ ...missingStep, evidence: 'The same action remains absent on a later walk.' }],
      steps: [], journeyType: 'first-visit', startUrl: page, status: 'ABANDONED', goalAchieved: false,
      blockedReason: null, abandonedReason: null, durationMs: 10, formProbe: null, actionTimeline: [] })
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    const saved = mocks.flagUpdate.mock.calls[0][0]
    expect(saved.where).toEqual({ id: 'original-flag' })
    expect(saved.data.supportingObservations.items).toEqual([original.items[0], expect.objectContaining({
      evidence: expect.stringContaining('later walk'), provenance: expect.objectContaining({ taskId: 'later-task' }),
    })])
  })

  it('serializes concurrent appends against the current stored observations', async () => {
    mocks.owner = { taskId: 'concurrent-task' }
    const original = observationsForFlag({ ...missingStep, source: 'JOURNEY', pageUrl: page },
      { auditId: 'audit-1', taskId: 'first-task', checkVersion: 1, collectedAt: '2026-10-16T10:00:00.000Z' })
    let stored = { ...missingStep, id: 'original-flag', source: 'JOURNEY', pageUrl: page, supportingObservations: original }
    mocks.flagFindMany.mockImplementation(async () => [{ ...stored }])
    mocks.flagFindUnique.mockImplementation(async () => ({ ...stored }))
    mocks.flagUpdate.mockImplementation(async ({ data }) => { stored = { ...stored, ...data }; return stored })
    const result = (evidence: string) => ({ findings: [{ ...missingStep, evidence }], steps: [], journeyType: 'first-visit' as const,
      startUrl: page, status: 'ABANDONED' as const, goalAchieved: false, blockedReason: null, abandonedReason: null,
      durationMs: 10, formProbe: null, actionTimeline: [] })
    await Promise.all([persistJourneyResult('audit-1', result('First independent walk.')), persistJourneyResult('audit-1', result('Second independent walk.'))])
    expect(stored.supportingObservations.items).toHaveLength(3)
    expect(stored.supportingObservations.items.map(item => item.evidence)).toEqual([
      original.items[0].evidence, expect.stringContaining('First independent walk'), expect.stringContaining('Second independent walk'),
    ])
    expect(mocks.flagCreate).not.toHaveBeenCalled()
  })

  it('records the first missing action and does not use the word journey', async () => {
    mocks.flagFindMany.mockResolvedValue([])
    await persistJourneyResult('audit-1', {
      findings: [missingStep],
      steps: [],
      journeyType: 'first-visit',
      startUrl: page,
      status: 'ABANDONED',
      goalAchieved: false,
      blockedReason: null,
      abandonedReason: null,
      durationMs: 10,
      formProbe: null,
      actionTimeline: [],
    })

    expect(mocks.flagCreate).toHaveBeenCalledTimes(1)
    const saved = mocks.flagCreate.mock.calls[0][0].data as { problem: string; whyItMatters: string; source: string; checkId: string }
    expect(saved.problem).toBe('No obvious primary CTA on first visit')
    expect(`${saved.problem} ${saved.whyItMatters}`.toLowerCase()).not.toContain('journey')
    expect(deriveTruthLabel(saved.source, saved.checkId)).toBe('Reproduced')
  })
})
