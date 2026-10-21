import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ plan: vi.fn(), evaluate: vi.fn(), walk: vi.fn(), record: vi.fn(),
  update: vi.fn(), find: vi.fn(), log: vi.fn(), scope: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { update: fixture.update, findUnique: fixture.find }, journeyReview: { updateMany: fixture.update } } }))
vi.mock('@/lib/audit/execution-ownership', async () => {
  const { prisma } = await import('@/lib/db')
  return { executionWrite: (write: (tx: typeof prisma) => unknown) => write(prisma) }
})
vi.mock('@/lib/audit/provider-usage', () => ({ beginProviderUsage: async () => async () => undefined }))
vi.mock('@/lib/audit/screenshot', () => ({ getAuditBrowser: async () => ({}) }))
vi.mock('@/lib/audit/pipeline-log', () => ({ logPipelineEvent: fixture.log }))
vi.mock('../planner', () => ({ isPlannerProviderConfigured: () => true }))
vi.mock('../plan-observation', () => ({ observeJourneyPlan: fixture.plan }))
vi.mock('../evaluator', () => ({ evaluateJourney: fixture.evaluate }))
vi.mock('../run-template', () => ({ runJourneyTemplate: fixture.walk }))
vi.mock('../review-persistence', () => ({ recordJourneyResult: fixture.record }))
vi.mock('../review-scope', () => ({ selectJourneyRuns: (...args: unknown[]) => { fixture.scope(...args); return [{ journeyType: 'multi-step-funnel' }] } }))
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runJourneyReviewsForAudit } from '../run-journey-reviews'

beforeEach(() => {
  vi.resetAllMocks()
  fixture.find.mockResolvedValue({ productContract: null, htmlMetadata: null })
  fixture.plan.mockResolvedValue({ plan: { goal: 'Inspect public navigation', steps: [{ stepNumber: 1, action: 'navigate', target: '/pricing', expectedResult: 'Inspect the recorded destination', evidence: [] }, { stepNumber: 2, action: 'evaluate', target: 'Recorded destination', expectedResult: 'Capture actual page facts', evidence: [] }], confidence: 1, estimatedDurationMs: 5000 }, usage: { inputTokens: 10, outputTokens: 2 } })
  fixture.walk.mockResolvedValue({ journeyType: 'multi-step-funnel', startUrl: 'https://example.test/', status: 'COMPLETED',
    goalAchieved: false, steps: [1, 2, 3].map(stepNumber => ({ stepNumber, actionType: 'evaluate', actionDetail: {}, url: 'https://example.test/', accessibilityTree: 'Recorded page' })), findings: [], durationMs: 10 })
  fixture.record.mockResolvedValue([])
  fixture.evaluate.mockResolvedValue({ evaluation: { frictionPoints: [], brokenPromises: [], accessibilityBarriers: [] }, usage: { inputTokens: 10, outputTokens: 2, model: 'recorded-model' } })
})
const run = (onAssessment: NonNullable<Parameters<typeof runJourneyReviewsForAudit>[2]['onAssessment']>, deadline = Date.now() + 60_000) => runJourneyReviewsForAudit('audit-custody', 'https://example.test/', { included: true, deadline, metadata: null, onAssessment })
describe('journey assessment completeness', () => {
  it('retains native observations after planning failure without claiming a completed planned assessment', async () => {
    fixture.plan.mockRejectedValue(Error('Planning response rejected'))
    const assessed = vi.fn()
    await run(assessed)
    expect(fixture.record).toHaveBeenCalledOnce()
    expect(fixture.evaluate).not.toHaveBeenCalled()
    expect(assessed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ state: 'INCOMPLETE', reason: 'provider_failed' }))
  })
  it('selects journeys from the current entry metadata and scopes provider accounting to that entry', async () => {
    const startUrl = 'https://example.test/pricing'
    const copy = '<p>Compare the plans for your team and choose the service that helps you manage your projects. Invite colleagues, collaborate on shared work, and review progress together. Every plan includes the tools your team needs to organize its daily work and deliver useful results. Start a free trial to explore all features before choosing a paid plan. Your team can find a suitable subscription, view prices, and make an informed decision.</p>'
    const root = parseMetadataFromHtml('<title>API reference</title><h1>Documentation</h1>' + copy, 'https://example.test/')
    const metadata = parseMetadataFromHtml('<title>Plans for your team</title><h1>Grow your business with our service</h1>' + copy, startUrl)
    fixture.find.mockResolvedValue({ productContract: null, htmlMetadata: root })
    await runJourneyReviewsForAudit('audit-custody', startUrl, { included: true, deadline: Date.now() + 60_000, metadata })
    expect(fixture.scope).toHaveBeenCalledWith(null, 'marketing', expect.any(Object))
    expect(fixture.find).toHaveBeenCalledWith({ where: { id: 'audit-custody' }, select: { productContract: true } })
    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({ where: { auditId: 'audit-custody', journeyType: 'multi-step-funnel', startUrl } }))
  })
  it('evaluates a completed observation walk without requiring a customer-success claim', async () => {
    const assessed = vi.fn()
    await run(assessed)
    expect(fixture.evaluate).toHaveBeenCalledWith(expect.objectContaining({ goalAchieved: false }), expect.any(Number), expect.any(Function))
    expect(assessed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ state: 'COMPLETE', reason: 'assessed' }))
  })
  it.each(['blocked', 'short'])('leaves a %s walk incomplete without asking an evaluator to fill the gaps', async mode => {
    const result = await fixture.walk()
    fixture.walk.mockResolvedValueOnce(mode === 'blocked' ? { ...result, status: 'ABANDONED', blockedReason: 'planned_target_not_observed' } : { ...result, steps: result.steps.slice(0, 1) })
    const assessed = vi.fn()
    await run(assessed)
    expect(fixture.evaluate).not.toHaveBeenCalled()
    expect(assessed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ state: 'INCOMPLETE', reason: 'walk_incomplete' }))
  })
  it('records unavailable coverage when the observation budget ends before admission', async () => {
    const assessed = vi.fn()
    await run(assessed, Date.now())
    expect(fixture.walk).not.toHaveBeenCalled()
    expect(fixture.evaluate).not.toHaveBeenCalled()
    expect(assessed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ state: 'INCOMPLETE', reason: 'budget_unavailable' }))
  })
})
