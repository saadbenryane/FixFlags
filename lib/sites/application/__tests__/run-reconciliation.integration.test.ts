import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { recoverExpiredSiteRuns } from '../run-leases'
import { markOutcomeRunsCouldNotVerify, reconcileOutcomeRunsForAudit } from '../run-reconciliation'
import { persistOutcomeAssessment } from '../outcome-incidents'
import { getOwnedRun } from '../run-queries'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteOutcomeDetail } from '../outcome-queries'
import { persistFlagDiffSummary } from '@/lib/audit/diff-flags'
import { CHECKOUT_ENTRY_EVALUATOR, DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { loadIncidentRecoveryProofs } from '../incident-proofs'

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

  it('settles only requests and Outcome selections in the Audit’s Site', async () => {
    const [site, other] = await Promise.all(['example.com', 'other.example'].map(host => prisma.project.create({
      data: { userId, name: host, canonicalHost: host, url: 'https://' + host + '/' },
    })))
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, status: 'COMPLETED', completedAt: new Date() } })
    const [outcome, foreign] = await Promise.all([site, other].map(project => prisma.siteOutcome.create({
      data: { projectId: project.id, name: 'Availability', slug: 'availability', kind: 'AVAILABILITY' },
    })))
    const own = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      idempotencyKey: 'own', selections: { create: [outcome, foreign].map(item => ({ outcomeId: item.id })) } } })
    const mismatched = await prisma.runRequest.create({ data: { projectId: other.id, auditId: audit.id, source: 'WEB',
      idempotencyKey: 'foreign', selections: { create: { outcomeId: foreign.id } } } })
    const attempted = { projectId: site.id, runRequestId: own.id, auditId: audit.id, outcomeId: foreign.id,
      outcomeKind: 'AVAILABILITY', bindingKeys: [], failureFlagIds: [], state: 'COULD_NOT_VERIFY' as const,
      summary: 'Controlled invalid projection', assessedAt: new Date(), validUntil: new Date() }
    await expect(persistOutcomeAssessment(attempted)).rejects.toThrow('no matching Site request')
    const unrelatedAudit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url,
      status: 'COMPLETED', completedAt: new Date() } })
    await expect(persistOutcomeAssessment({ ...attempted, outcomeId: outcome.id, auditId: unrelatedAudit.id }))
      .rejects.toThrow('no matching Site request')
    expect(await reconcileOutcomeRunsForAudit(audit.id)).toBe(1)
    expect(await prisma.outcomeAssessment.findMany({ where: { auditId: audit.id }, select: { outcomeId: true, runRequestId: true } }))
      .toEqual([{ outcomeId: outcome.id, runRequestId: own.id }])
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: mismatched.id } })).toEqual(mismatched)

    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED' } })
    await prisma.runRequest.update({ where: { id: own.id }, data: { status: 'QUEUED' } })
    expect(await markOutcomeRunsCouldNotVerify(audit.id, 'FIXTURE', 'Controlled interruption')).toBe(1)
    expect(await prisma.outcomeAssessment.count({ where: { auditId: audit.id } })).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: mismatched.id } })).toEqual(mismatched)
  })

  it.each(['SITE', 'CATEGORY'] as const)('keeps %s completion pending until its original comparison is published', async scope => {
    const site = await prisma.project.create({ data: { userId, name: 'Publication ordering', canonicalHost: 'example.com',
      url: 'https://example.com/', notificationLevel: 'OFF', accountChecksEnabled: false } })
    const outcome = scope === 'SITE' ? await prisma.siteOutcome.create({ data: { projectId: site.id,
      name: 'Page responds', slug: 'page-responds', kind: 'AVAILABILITY' } }) : null
    const binding = { key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', required: true,
      config: { startUrl: site.url, expectedSelector: 'body' }, scope: null }
    const spec = { version: 1, engine: 'progressive-v1', scope, targetUrl: site.url, environment: 'production',
      checks: { 'title-missing': 1 }, verificationTarget: null,
      outcomes: outcome ? [{ id: outcome.id, kind: outcome.kind, expectation: null,
        bindingPolicy: outcome.bindingPolicy, bindings: [binding] }] : [],
      ...(scope === 'CATEGORY' ? { category: { area: 'search', sourceAuditId: 'original-scope', pages: [site.url] } } : {}) }
    const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, isPublic: false,
      status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      requestedByUserId: userId, idempotencyKey: randomUUID(), executionSpec: spec, leaseUntil: new Date(0),
      ...(outcome ? { selections: { create: { outcomeId: outcome.id } } } : {}) } })
    if (outcome) await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id,
      bindingKey: binding.key, bindingVersion: binding.version, mechanism: binding.mechanism,
      disposition: 'SUCCEEDED', reason: 'available', createdAt: audit.completedAt!, detail: { evaluator: DEFAULT_AVAILABILITY_EVALUATOR } } })
    await reconcileOutcomeRunsForAudit(audit.id)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'QUEUED', completedAt: null })
    if (outcome) expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: {
      runRequestId: request.id, outcomeId: outcome.id } } })).toMatchObject({ state: 'CLEAR' })
    await persistFlagDiffSummary(null, audit.id)
    await reconcileOutcomeRunsForAudit(audit.id)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'COMPLETED' })
    const http = await getOwnedRun(userId, request.id, site.id)
    const connected = await getOwnedRun(userId, request.id)
    expect(http).toEqual(connected)
    await reconcileOutcomeRunsForAudit(audit.id)
    expect(await getOwnedRun(userId, request.id)).toEqual(http)
  })

  it('uses only matching failed binding evidence to link and recover an Outcome Flag', async () => {
    const site = await prisma.project.create({ data: { userId, name: 'Binding identity', canonicalHost: 'example.com',
      url: 'https://example.com/', notificationLevel: 'OFF', accountChecksEnabled: false } })
    const outcome = await prisma.siteOutcome.create({ data: { projectId: site.id, name: 'Primary page', slug: 'primary',
      kind: 'AVAILABILITY' } })
    const sibling = await prisma.siteOutcome.create({ data: { projectId: site.id, name: 'Sibling page', slug: 'sibling',
      kind: 'AVAILABILITY' } })
    const bindings = ['old-revision', 'wrong-method', 'wrong-flag', 'confirmed', 'confirmed-peer'].map(key => ({
      key, version: 2, mechanism: 'HTTP_AVAILABILITY' as const, required: true,
      config: { startUrl: site.url, expectedSelector: 'body' }, scope: null,
    }))
    const spec = { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl: site.url, environment: 'production',
      checks: {}, verificationTarget: null, outcomes: [{ id: outcome.id, kind: outcome.kind, expectation: null,
        bindingPolicy: outcome.bindingPolicy, bindings }] }
    const now = Date.now()
    async function observation(at: number) {
      const completedAt = new Date(at)
      const audit = await prisma.audit.create({ data: { userId, projectId: site.id, url: site.url, isPublic: false,
        status: 'COMPLETED', completedAt, executionSpec: spec } })
      const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WATCH',
        requestedAt: new Date(at - 1000), requestedByUserId: userId, idempotencyKey: randomUUID(), executionSpec: spec,
        selections: { create: { outcomeId: outcome.id } } } })
      return { audit, request }
    }
    const failed = await observation(now - 60_000)
    async function finding(key: string, owner: string, position: number, linkedOutcomeId: string | null = owner) {
      const fingerprint = outcomeFlagFingerprint(owner, key)
      const flag = await prisma.flag.create({ data: { auditId: failed.audit.id, source: 'DETERMINISTIC', fingerprint,
        rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'The page was unavailable', evidence: 'Controlled HTTP 503',
        whyItMatters: 'The page cannot be reached', fix: 'Restore the page', confidence: 1, position } })
      const improvement = await prisma.improvement.create({ data: { projectId: site.id, outcomeId: linkedOutcomeId, fingerprint,
        title: 'Restore the page', judgment: 'Controlled unavailable response', expectedBenefit: 'The page responds',
        recommendedChange: 'Restore the response', successCondition: 'Comparable public response succeeds',
        occurrences: { create: { flagId: flag.id, auditId: failed.audit.id, kind: 'OBSERVED' } } } })
      return { flag, improvement }
    }
    const old = await finding('old-revision', outcome.id, 0)
    const wrongMethod = await finding('wrong-method', outcome.id, 1)
    const wrongFlag = await finding('wrong-flag', sibling.id, 2)
    const confirmed = await finding('confirmed', outcome.id, 3, null)
    const confirmedPeer = await finding('confirmed-peer', outcome.id, 4, null)
    await prisma.outcomeBindingExecution.createMany({ data: [old, wrongMethod, wrongFlag, confirmed, confirmedPeer].map(({ flag }, index) => ({
      auditId: failed.audit.id, outcomeId: outcome.id, bindingKey: bindings[index].key,
      bindingVersion: index === 0 ? 1 : 2, mechanism: index === 1 ? 'BROWSER_JOURNEY' : 'HTTP_AVAILABILITY',
      disposition: 'FAILED', reason: 'http_unavailable', detail: { failureFlagId: flag.id },
      createdAt: failed.audit.completedAt!,
    })) })
    await expect(persistOutcomeAssessment({ projectId: site.id, outcomeId: outcome.id, auditId: failed.audit.id, runRequestId: failed.request.id,
      outcomeKind: outcome.kind, bindingKeys: bindings.map(binding => binding.key), failureFlagIds: [confirmed.flag.id, confirmedPeer.flag.id],
      state: 'FLAG', summary: 'Controlled assessment write refusal', validUntil: new Date(NaN),
    })).rejects.toThrow('Invalid Date')
    expect(await prisma.outcomeAssessment.count({ where: { runRequestId: failed.request.id } })).toBe(0)
    for (const { improvement } of [confirmed, confirmedPeer])
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } })).toEqual(improvement)
    await reconcileOutcomeRunsForAudit(failed.audit.id)
    expect(await prisma.outcomeAssessment.findFirstOrThrow({ where: { runRequestId: failed.request.id } })).toMatchObject({
      state: 'FLAG', improvementId: confirmed.improvement.id, coverage: { observedBindings: ['wrong-flag', 'confirmed', 'confirmed-peer'] },
      evidence: { incident: { transition: 'failure', rootFlagIds: [confirmed.flag.id, confirmedPeer.flag.id], flagIds: [confirmed.flag.id, confirmedPeer.flag.id] } },
    })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: confirmedPeer.improvement.id } })).toMatchObject({ outcomeId: outcome.id })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: wrongFlag.improvement.id } })).toMatchObject({ outcomeId: sibling.id })

    const clear = await observation(now)
    await prisma.outcomeBindingExecution.createMany({ data: bindings.map(binding => ({
      auditId: clear.audit.id, outcomeId: outcome.id, bindingKey: binding.key, bindingVersion: binding.version,
      mechanism: binding.mechanism, disposition: 'SUCCEEDED', reason: 'available', createdAt: clear.audit.completedAt!,
      detail: { evaluator: DEFAULT_AVAILABILITY_EVALUATOR },
    })) })
    await reconcileOutcomeRunsForAudit(clear.audit.id)
    expect(await prisma.outcomeAssessment.findFirstOrThrow({ where: { runRequestId: clear.request.id } })).toMatchObject({
      state: 'CLEAR', evidence: { incident: { transition: 'recovery', recoveredFlagIds: expect.arrayContaining([confirmed.flag.id, confirmedPeer.flag.id]) } },
    })
    for (const { flag, improvement } of [confirmed, confirmedPeer]) {
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED', resolvedInId: clear.audit.id })
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } }))
        .toMatchObject({ status: 'VERIFIED', outcomeId: outcome.id })
    }
    for (const { flag, improvement } of [old, wrongMethod, wrongFlag]) {
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } })).toMatchObject({ status: 'PROPOSED' })
    }
    const unproven = { ...old.flag, status: 'FIXED', resolvedInId: clear.audit.id }
    const proofs = await loadIncidentRecoveryProofs([{ projectId: site.id, flags: [unproven] }])
    expect(proofs.get(site.id)?.hasFlag(unproven) ?? false).toBe(false)
  })

  it.each([
    { stored: 'unrecorded success', disposition: 'SUCCEEDED' as const, version: null, detail: {}, state: 'COULD_NOT_VERIFY' },
    { stored: 'unrecorded failure', disposition: 'FAILED' as const, version: null, detail: {}, state: 'COULD_NOT_VERIFY' },
    { stored: 'older evaluator success', disposition: 'SUCCEEDED' as const, version: 1, detail: {}, state: 'COULD_NOT_VERIFY', reason: 'evaluation_changed' },
    { stored: 'explicit legacy version', disposition: 'SUCCEEDED' as const, version: null,
      detail: { bindingVersion: 1, evaluator: DEFAULT_AVAILABILITY_EVALUATOR }, state: 'CLEAR' },
    { stored: 'different legacy version', disposition: 'SUCCEEDED' as const, version: null, detail: { bindingVersion: 2 }, state: 'COULD_NOT_VERIFY' },
    { stored: 'structured version', disposition: 'SUCCEEDED' as const, version: 1,
      detail: { bindingVersion: 2, evaluator: DEFAULT_AVAILABILITY_EVALUATOR }, state: 'CLEAR' },
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
      reason: sample.state === 'CLEAR' ? 'required_bindings_succeeded' : sample.reason ?? 'binding_changed' },
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
    ['SUCCEEDED', 'CLEAR', CHECKOUT_ENTRY_EVALUATOR, 'legacy'], ['FAILED', 'FLAG', CHECKOUT_ENTRY_EVALUATOR, 'legacy'],
    ['BLOCKED', 'COULD_NOT_VERIFY', CHECKOUT_ENTRY_EVALUATOR, 'legacy'],
    ['SUCCEEDED', 'COULD_NOT_VERIFY', null, 'legacy'], ['SUCCEEDED', 'COULD_NOT_VERIFY', 'checkout-entry-v1', 'legacy'],
    ['SUCCEEDED', 'CLEAR', CHECKOUT_ENTRY_EVALUATOR, 'ambiguous'],
    ['SUCCEEDED', 'CLEAR', CHECKOUT_ENTRY_EVALUATOR, 'foreign'],
  ] as const)('settles a %s binding as %s with evaluator %s and %s review provenance', async (disposition, state, evaluator, provenance) => {
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
        { stepNumber: 2, actionType: 'wait', actionDetail: { retained, bindingKey: binding.key }, url: site.url + 'checkout', accessibilityTree: retained,
          screenshotAfterUrl: 'https://private-storage.example/second' },
        { stepNumber: 1, actionType: 'navigate', actionDetail: { retained, bindingKey: binding.key }, url: site.url, accessibilityTree: retained,
          screenshotAfterUrl: 'https://private-storage.example/first' },
      ] } }, include: { steps: { orderBy: { stepNumber: 'asc' } } } })
    let journeyReviewId: string | undefined
    if (provenance !== 'legacy') {
      const source = provenance === 'ambiguous' ? audit : await prisma.audit.create({ data: {
        userId, projectId: site.id, url: site.url, isPublic: false, status: 'COMPLETED', completedAt,
      } })
      const otherReview = await prisma.journeyReview.create({ data: {
        auditId: source.id, journeyType: 'checkout', startUrl: site.url, status: 'COMPLETED', completedAt,
        steps: { create: { stepNumber: 1, actionType: 'navigate', actionDetail: { bindingKey: binding.key },
          url: site.url, accessibilityTree: '', screenshotAfterUrl: 'https://private-storage.example/other' } },
      } })
      if (provenance === 'foreign') journeyReviewId = otherReview.id
    }
    const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source: 'WEB',
      requestedByUserId: userId, idempotencyKey: randomUUID(), executionSpec: spec, leaseUntil: new Date(0),
      selections: { create: { outcomeId: outcome.id } } } })
    // Stored binding dispositions exercise settlement only. They do not prove
    // that a checkout or an external website was actually collected.
    const execution = await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id,
      bindingKey: binding.key, bindingVersion: binding.version, mechanism: binding.mechanism, disposition,
      detail: { ...(evaluator ? { evaluator } : {}), ...(journeyReviewId ? { journeyReviewId } : {}) },
      reason: disposition === 'SUCCEEDED' ? 'checkout_reached' : disposition === 'FAILED' ? 'checkout_failed' : 'access_restricted',
      createdAt: completedAt } })
    const queries = vi.spyOn(prisma.runRequest, 'findMany')
    const reviewQueries = vi.spyOn(prisma.journeyReview, 'findMany')
    expect(await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)).toBe(1)
    const settled = await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(settled).toMatchObject({ status: 'COMPLETED', leaseUntil: null, errorCode: null })
    const assessment = await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: {
      runRequestId: request.id, outcomeId: outcome.id } } })
    const reviewEvidence = provenance === 'legacy' ? { journeyReviewId: review.id, stepCount: 2,
      screenshots: ['https://private-storage.example/first', 'https://private-storage.example/second'] }
      : { journeyReviewId: null, stepCount: 0, screenshots: [] }
    expect(assessment).toMatchObject({ state, assessedAt: completedAt, evidence: reviewEvidence,
    coverage: { requiredBindings: ['checkout'], observedBindings: state === 'COULD_NOT_VERIFY' ? [] : ['checkout'],
      bindings: [{ key: binding.key, version: binding.version, config: binding.config, scope: binding.scope }] } })
    expect(assessment.validUntil.getTime()).toBe(completedAt.getTime() + (state === 'COULD_NOT_VERIFY' ? 0 : 60 * 60_000))
    const resultIndex = queries.mock.calls.findIndex(([args]) => args?.where?.auditId === audit.id && args.include?.selections)
    expect(resultIndex).toBeGreaterThanOrEqual(0)
    const rows = await queries.mock.results[resultIndex].value
    const reviewRows = await Promise.all(reviewQueries.mock.results.map(result => result.value))
    const transferred = JSON.stringify([rows, reviewRows])
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
