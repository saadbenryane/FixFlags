import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskContext } from '../registry'
import { parseMetadataFromHtml } from '../../metadata'
import { capturePageKey } from '../../browser/observation-scope'

const mocks = vi.hoisted(() => ({ run: vi.fn(), history: vi.fn(), metadata: null as unknown }))
vi.mock('../../journey/run-journey-reviews', () => ({ runJourneyReviewsForAudit: mocks.run }))
vi.mock('../../journey/recorded-conditions', async importOriginal => ({
  ...await importOriginal<typeof import('../../journey/recorded-conditions')>(), loadRecordedJourneyConditions: mocks.history,
}))
vi.mock('../evaluators', async importOriginal => ({
  ...await importOriginal<typeof import('../evaluators')>(), browserEvidence: () => ({ metadata: mocks.metadata }),
}))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: async () => null }))
import { lifecycleHandlers } from '../lifecycle'
import { OBSERVATION_COHORT_TARGET, OBSERVATION_TARGET, observationBatchStart } from '../observation-progress'

const handler = lifecycleHandlers.find(handler => handler.kind === 'journeys')!
const pageUrl = 'https://example.com/'
const context = (): TaskContext => ({
  audit: { id: 'audit', projectId: 'owned-site', productContract: null, executionSpec: { version: 1, engine: 'progressive-v1',
    targetUrl: pageUrl, environment: 'production', scope: 'SITE', checks: { 'journey-signup-no-form': 1 }, outcomes: [], verificationTarget: null } },
  task: { id: 'journeys', workResult: null, workGeneration: 1 }, input: { pageUrl, position: 0, primary: true, role: 'primary' },
  dependencies: new Map(), deadline: Date.now() + 60_000,
}) as TaskContext

beforeEach(() => {
  vi.resetAllMocks()
  mocks.metadata = parseMetadataFromHtml('<html><head><title>Product</title></head><body><h1>Useful product for website owners</h1><a href="/signup">Start free</a></body></html>', pageUrl)
  mocks.history.mockResolvedValue(['#first', '#second'].map(selector => ({ journeyType: 'signup', phase: 'destination',
    pageKey: capturePageKey(pageUrl), route: [{ selector, label: 'Start free' }] })))
  mocks.run.mockResolvedValue(0)
})

describe('journey observation continuation', () => {
  it('collects original routes with native observations when full-document metadata is unavailable', async () => {
    mocks.metadata = null
    const result = await handler.evaluate(context())
    expect(result.continuation).toBe(true)
    expect(mocks.run).toHaveBeenCalledWith('audit', pageUrl, expect.objectContaining({
      metadata: null, journeyRuns: [{ journeyType: 'signup', route: [{ selector: '#first', label: 'Start free' }] }],
    }))
  })

  it('keeps every original route and gives each one its own delivery before ordinary discovery finishes', async () => {
    let current = context(), deliveries = 0
    const routes: string[] = []
    for (;;) {
      const result = await handler.evaluate(current)
      const options = mocks.run.mock.calls.at(-1)![2]
      expect(options.journeyRuns).toHaveLength(1)
      routes.push(options.journeyRuns[0].route?.[0]?.selector ?? options.journeyRuns[0].journeyType)
      expect(observationBatchStart(current, result, 1)).toBe(deliveries)
      deliveries++
      expect(options.completeReview).toBe(!result.continuation)
      if (!result.continuation) break
      mocks.history.mockRejectedValue(new Error('History changed between deliveries'))
      current = { ...current, task: { ...current.task, workResult: result as never, workGeneration: current.task.workGeneration + 1 } }
    }
    expect(routes.slice(0, 2)).toEqual(['#first', '#second'])
    expect(new Set(routes).size).toBe(routes.length)
    expect(mocks.history).toHaveBeenCalledTimes(1)
    expect(routes).toContain('first-visit')
    expect(routes).toContain('multi-step-funnel')
  })

  it('records each observation before publishing its findings and never replaces a prior receipt', async () => {
    const current = context(), result = await handler.evaluate(current)
    const upsert = vi.fn(async input => ({ id: 'cohort', ...input.create })), findMany = vi.fn(async () => [])
    const tx = { auditVerificationReceipt: { upsert, findUnique: vi.fn(async () => null) }, journeyFinding: { findMany } }
    await handler.commit!(current, result, tx as never)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      targetKey: OBSERVATION_COHORT_TARGET, taskId: current.task.id,
    }), update: {} }))
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      targetKey: OBSERVATION_TARGET, taskId: current.task.id, detail: expect.objectContaining({ data: expect.objectContaining({
        observationProgress: expect.objectContaining({ cohortId: 'cohort', total: expect.any(Number) }),
      }) }),
    }), update: {} }))
  })
})
