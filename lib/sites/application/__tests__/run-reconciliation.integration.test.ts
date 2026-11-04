import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { recoverExpiredSiteRuns } from '../run-leases'
import { reconcileOutcomeRunsForAudit } from '../run-reconciliation'
import { getOwnedRun } from '../run-queries'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteOutcomeDetail } from '../outcome-queries'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('bounded run settlement evidence', () => {
  let userId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'settlement-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it.each([
    { stored: 'unrecorded success', disposition: 'SUCCEEDED' as const, version: null, detail: {}, state: 'COULD_NOT_VERIFY' },
    { stored: 'unrecorded failure', disposition: 'FAILED' as const, version: null, detail: {}, state: 'COULD_NOT_VERIFY' },
    { stored: 'explicit legacy version', disposition: 'SUCCEEDED' as const, version: null, detail: { bindingVersion: 1 }, state: 'CLEAR' },
    { stored: 'different legacy version', disposition: 'SUCCEEDED' as const, version: null, detail: { bindingVersion: 2 }, state: 'COULD_NOT_VERIFY' },
    { stored: 'structured version', disposition: 'SUCCEEDED' as const, version: 1, detail: { bindingVersion: 2 }, state: 'CLEAR' },
  ])('retains $stored as history without inferring an unrecorded version-one binding', async sample => {
    const site = await prisma.project.create({ data: { userId, name: 'Binding correspondence', canonicalHost: 'example.com',
      url: 'https://example.com/', notificationLevel: 'OFF', accountChecksEnabled: false } })
    const config = { startUrl: site.url, expectedSelector: 'body' }
    const outcome = await prisma.siteOutcome.create({ data: { projectId: site.id, slug: 'page-loads', name: 'This page loads',
      kind: 'AVAILABILITY', bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config } } } })
    const spec = { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl: site.url, environment: 'production',
      checks: {}, verificationTarget: null, outcomes: [{ id: outcome.id, kind: outcome.kind, expectation: null,
        bindingPolicy: outcome.bindingPolicy, bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY',
          required: true, config, scope: null }] }] }
    const completedAt = new Date(Date.now() - 1000)
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, isPublic: false,
      status: 'COMPLETED', completedAt, executionSpec: spec } })
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      requestedByUserId: userId, idempotencyKey: randomUUID(), executionSpec: spec, leaseUntil: new Date(0),
      selections: { create: { outcomeId: outcome.id } } } })
    const execution = await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id,
      bindingKey: 'http', bindingVersion: sample.version, mechanism: 'HTTP_AVAILABILITY', disposition: sample.disposition,
      reason: sample.disposition === 'SUCCEEDED' ? 'available' : 'http_error', detail: sample.detail, createdAt: completedAt } })
    await reconcileOutcomeRunsForAudit(audit.id)
    const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: {
      runRequestId: request.id, outcomeId: outcome.id } } })
    expect(assessment).toMatchObject({ state: sample.state, evidence: {
      reason: sample.state === 'CLEAR' ? 'required_bindings_succeeded' : 'binding_changed' },
    coverage: { requiredBindings: ['http'], observedBindings: sample.state === 'CLEAR' ? ['http'] : [] } })
    expect(assessment.validUntil.getTime()).toBe(sample.state === 'CLEAR'
      ? completedAt.getTime() + outcome.staleAfterMinutes * 60_000 : completedAt.getTime())
    expect(await prisma.outcomeBindingExecution.findUniqueOrThrow({ where: { id: execution.id } })).toEqual(execution)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'COMPLETED', leaseUntil: null })
    expect(await getOwnedRun(userId, request.id, site.id)).toMatchObject({ result: sample.state,
      outcomes: [{ outcomeId: outcome.id, result: sample.state }] })
    const detail = await loadSiteOutcomeDetail((await loadSiteRecord(site.id))!, outcome.id)
    expect(detail?.state).toBe(sample.state)
    expect(detail?.bindings[0].latestEvidence).toEqual(sample.state === 'CLEAR'
      ? { disposition: sample.disposition, reason: execution.reason, detail: sample.detail,
        createdAt: completedAt.toISOString(), auditId: audit.id } : null)
    await reconcileOutcomeRunsForAudit(audit.id)
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
  })

  it.each([
    ['SUCCEEDED', 'CLEAR'], ['FAILED', 'FLAG'], ['BLOCKED', 'COULD_NOT_VERIFY'],
  ] as const)('recovers a completed %s binding without transferring retained reports or journey bodies', async (disposition, state) => {
    const site = await prisma.project.create({ data: { userId, name: 'Settlement fixture', canonicalHost: 'example.com',
      url: 'https://example.com/', notificationLevel: 'OFF', accountChecksEnabled: false } })
    const outcome = await prisma.siteOutcome.create({ data: { projectId: site.id, slug: 'checkout', name: 'Checkout',
      kind: 'CHECKOUT', staleAfterMinutes: 60, bindings: { create: { key: 'checkout', mechanism: 'BROWSER_JOURNEY',
        config: { startUrl: site.url, steps: [], goal: { type: 'url_pattern', pattern: '/checkout' }, safety: 'stop-at-checkout' },
        scope: { device: 'mobile' } } } }, include: { bindings: true } })
    const binding = outcome.bindings[0]
    const spec = { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl: site.url, environment: 'production',
      checks: {}, verificationTarget: null, outcomes: [{ id: outcome.id, kind: outcome.kind, expectation: null,
        bindingPolicy: outcome.bindingPolicy, bindings: [{ key: binding.key, version: binding.version, mechanism: binding.mechanism,
          required: true, config: binding.config, scope: binding.scope }] }] }
    const retained = 'PRIVATE_RETAINED_SETTLEMENT_BODY:' + 'x'.repeat(1_000_000)
    const completedAt = new Date(Date.now() - 60_000)
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, isPublic: false,
      status: 'COMPLETED', completedAt, executionSpec: spec,
      htmlMetadata: { retained }, performanceData: { retained }, flowData: { retained }, productContract: { retained } } })
    const review = await prisma.journeyReview.create({ data: { auditId: audit.id, journeyType: 'checkout', startUrl: site.url,
      status: 'COMPLETED', completedAt, planJson: { retained }, steps: { create: [
        { stepNumber: 2, actionType: 'wait', actionDetail: { retained }, url: site.url + 'checkout', accessibilityTree: retained,
          screenshotAfterUrl: 'https://private-storage.example/second' },
        { stepNumber: 1, actionType: 'navigate', actionDetail: { retained }, url: site.url, accessibilityTree: retained,
          screenshotAfterUrl: 'https://private-storage.example/first' },
      ] } }, include: { steps: { orderBy: { stepNumber: 'asc' } } } })
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      requestedByUserId: userId, idempotencyKey: randomUUID(), executionSpec: spec, leaseUntil: new Date(0),
      selections: { create: { outcomeId: outcome.id } } } })
    // Stored binding dispositions exercise settlement only. They do not prove
    // that a checkout or an external website was actually collected.
    const execution = await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id,
      bindingKey: binding.key, bindingVersion: binding.version, mechanism: binding.mechanism, disposition,
      reason: disposition === 'SUCCEEDED' ? 'checkout_reached' : disposition === 'FAILED' ? 'checkout_failed' : 'access_restricted',
      createdAt: completedAt } })
    const queries = vi.spyOn(prisma.runRequest, 'findMany')
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(1)
    const settled = await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(settled).toMatchObject({ status: 'COMPLETED', leaseUntil: null, errorCode: null })
    const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: {
      runRequestId: request.id, outcomeId: outcome.id } } })
    expect(assessment).toMatchObject({ state, assessedAt: completedAt, evidence: { journeyReviewId: review.id, stepCount: 2,
      screenshots: ['https://private-storage.example/first', 'https://private-storage.example/second'] },
    coverage: { requiredBindings: ['checkout'], observedBindings: disposition === 'BLOCKED' ? [] : ['checkout'],
      bindings: [{ key: binding.key, version: binding.version, config: binding.config, scope: binding.scope }] } })
    expect(assessment.validUntil.getTime()).toBe(completedAt.getTime() + (disposition === 'BLOCKED' ? 0 : 60 * 60_000))
    const resultIndex = queries.mock.calls.findIndex(([args]) => args?.where?.auditId === audit.id)
    expect(resultIndex).toBeGreaterThanOrEqual(0)
    const rows = await queries.mock.results[resultIndex].value
    const transferred = JSON.stringify(rows)
    console.info('Run settlement projection', { disposition, transferredBytes: Buffer.byteLength(transferred) })
    expect(Buffer.byteLength(transferred)).toBeLessThan(16_000)
    expect(transferred).not.toContain('PRIVATE_RETAINED_SETTLEMENT_BODY:')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    expect(await prisma.journeyReview.findUniqueOrThrow({ where: { id: review.id }, include: { steps: { orderBy: { stepNumber: 'asc' } } } })).toEqual(review)
    expect(await prisma.outcomeBindingExecution.findUniqueOrThrow({ where: { id: execution.id } })).toEqual(execution)
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(0)
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(settled)
  })
})
