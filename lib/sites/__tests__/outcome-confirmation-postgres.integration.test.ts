import { randomUUID } from 'node:crypto'
import { Prisma, type Flag, type OutcomeAssessment } from '@prisma/client'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmSiteOutcome, createSiteOutcome, listSiteOutcomes, loadSiteOutcomeDetail, loadSiteOutcomeDetails, renameSiteOutcome, setSiteOutcomeEnabled } from '@/lib/sites/outcomes'
import { currentExecutionOwnership, executionWrite, ExecutionOwnershipLost, withExecutionOwnership } from '@/lib/audit/execution-ownership'
import { buildExecutionSpec } from '@/lib/sites/application/execution-spec'
import { admittedOutcomeCoverage, comparableOutcomeCoverage } from '@/lib/sites/domain/outcome-proof'
import { snapshotOutcomeAuthorization } from '@/lib/sites/domain/outcome-authorization'
import { mcpOutcomePayload } from '@/lib/mcp/outcome-payload'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { persistOutcomeAssessment } from '@/lib/sites/application/outcome-incidents'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { readOutcomeIncident } from '@/lib/sites/domain/outcome-incident'
import { loadIncidentRecoveryProofs } from '@/lib/sites/application/incident-proofs'
import { outcomeMonitoringDiff } from '@/lib/sites/application/outcome-monitoring'
import { loadSiteFindings, loadSiteFlagDetail, loadSiteFlags, loadSiteResolvedFlags } from '@/lib/sites/flags'
import type { SiteRecord } from '@/lib/sites/types'

const runPostgres = process.env.OUTCOME_CONFIRMATION_DB_REQUIRED === 'true' ? describe : describe.skip
const queryTrace = vi.hoisted(() => ({ active: false, queries: [] as string[] }))
vi.mock('@/lib/db', async importOriginal => {
  if (process.env.OUTCOME_CONFIRMATION_DB_REQUIRED !== 'true') return importOriginal<typeof import('@/lib/db')>()
  const { PrismaClient } = await import('@prisma/client')
  const client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
  client.$on('query', event => { if (queryTrace.active) queryTrace.queries.push(event.query) })
  return { prisma: client }
})

runPostgres('Outcome confirmation PostgreSQL serialization', () => {
  afterAll(async () => { await prisma.$disconnect() })
  let userId = ''
  let projectId = ''
  let site: SiteRecord

  beforeEach(async () => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    const hostname = new URL(databaseUrl).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      throw new Error('Outcome confirmation integration tests require a local PostgreSQL database')
    }

    const suffix = randomUUID()
    userId = `outcome-confirmation-user-${suffix}`
    projectId = `outcome-confirmation-project-${suffix}`
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        preferredTools: [],
      },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        userId,
        name: 'Outcome confirmation fixture',
        url: 'https://example.com/',
        canonicalHost: 'example.com',
      },
    })
    site = {
      siteId: projectId,
      kind: 'project',
      projectId,
      provisionalSiteId: null,
      url: 'https://example.com/',
      canonicalHost: 'example.com',
      name: 'Outcome confirmation fixture',
      primaryAuditId: null,
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId,
    }
  })

  afterEach(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it('projects joined Outcome pages across list, detail, confirmation and rename without borrowing another Site', async () => {
    const otherOwner = await prisma.user.create({ data: { email: `foreign-page-${randomUUID()}@example.test` } })
    const other = await prisma.project.create({ data: { userId: otherOwner.id, name: 'Other Site', url: 'https://other.example/', canonicalHost: 'other.example' } })
    try {
      const own = await prisma.sitePage.create({ data: { projectId, url: site.url, path: '/' } })
      const privatePage = await prisma.sitePage.create({ data: { projectId: other.id, url: 'https://other.example/private', path: '/private' } })
      const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page loads', slug: 'joined-page-projection',
        kind: 'GENERIC', pages: { create: [{ pageId: own.id }, { pageId: privatePage.id }] } } })
      const reads = vi.spyOn(prisma.sitePage, 'findMany')
      try {
        const views = [(await listSiteOutcomes(site)).find(view => view.id === outcome.id), await loadSiteOutcomeDetail(site, outcome.id),
          await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'AVAILABILITY' }),
          await renameSiteOutcome({ site, outcomeId: outcome.id, name: 'The original page loads' })]
        for (const view of views) {
          expect(view?.pageIds).toEqual([own.id])
          expect(view?.pageUrls).toEqual([own.url])
          expect(JSON.stringify(view)).not.toContain(privatePage.url)
        }
        expect(reads).not.toHaveBeenCalled()
        expect(await prisma.siteOutcomePage.count({ where: { outcomeId: outcome.id } })).toBe(2)
        expect(await prisma.sitePage.findUnique({ where: { id: privatePage.id } })).toMatchObject({ projectId: other.id, url: privatePage.url })
      } finally { reads.mockRestore() }
    } finally { await prisma.project.delete({ where: { id: other.id } }); await prisma.user.delete({ where: { id: otherOwner.id } }) }
  })

  async function genericOutcome(slug: string) {
    return prisma.siteOutcome.create({
      data: {
        projectId,
        name: 'A customer can complete an important action',
        slug,
        inferenceSource: 'browser',
      },
    })
  }

  it('keeps evidence limits and older successful verification separate for each Outcome in a batch', async () => {
    const now = Date.now(), binding = { key: 'http', mechanism: 'HTTP_AVAILABILITY' as const, version: 1, required: true, config: { startUrl: site.url } }
    const outcomes = await Promise.all(['first', 'second'].map(slug => prisma.siteOutcome.create({ data: {
      projectId, name: slug, slug, kind: 'AVAILABILITY', bindings: { create: binding },
    } })))
    const audits = Array.from({ length: 55 }, (_, index) => ({ id: 'batch-evidence-' + randomUUID(), userId, projectId,
      url: site.url, status: 'COMPLETED' as const, createdAt: new Date(now - index * 60_000), completedAt: new Date(now - index * 60_000) }))
    await prisma.audit.createMany({ data: audits })
    try {
      for (const [position, outcome] of outcomes.entries()) {
        const requests = audits.slice(0, 22).map((audit, index) => ({ id: 'batch-request-' + randomUUID(), projectId, auditId: audit.id,
          requestedByUserId: userId, source: 'WEB' as const, status: 'COMPLETED' as const, idempotencyKey: randomUUID(),
          requestedAt: new Date(now - index * 60_000), executionSpec: {} }))
        await prisma.runRequest.createMany({ data: requests })
        await prisma.runRequestOutcome.createMany({ data: requests.map(request => ({ outcomeId: outcome.id, runRequestId: request.id })) })
        await prisma.outcomeAssessment.createMany({ data: requests.map((request, index) => ({
          outcomeId: outcome.id, runRequestId: request.id, auditId: request.auditId,
          state: position === 1 || index === 21 ? 'CLEAR' as const : 'FLAG' as const,
          summary: outcome.name, assessedAt: request.requestedAt, validUntil: new Date(now + 3600_000),
          coverage: { environment: 'production', requiredBindings: [binding.key], bindings: [binding] },
        })) })
        await prisma.outcomeBindingExecution.createMany({ data: audits.map(audit => ({
          outcomeId: outcome.id, auditId: audit.id, bindingKey: binding.key, bindingVersion: 1, mechanism: binding.mechanism,
          disposition: position === 0 ? 'FAILED' as const : 'SUCCEEDED' as const,
          reason: position === 0 ? 'response_error' : 'response_received', createdAt: audit.createdAt,
        })) })
      }
      queryTrace.active = true; queryTrace.queries = []
      const details = await loadSiteOutcomeDetails(site, { excludeGeneric: true })
      queryTrace.active = false
      expect(queryTrace.queries.some(query => query.includes('SELECT o.id') && query.includes('LIMIT 50'))).toBe(true)
      for (const table of ['outcome_assessments', 'outcome_binding_executions']) {
        const reads = queryTrace.queries.filter(query => query.startsWith(`SELECT "public"."${table}"`))
        expect(reads.length).toBeGreaterThan(0)
        for (const query of reads) expect(query).toContain(`"${table}"."id" IN`)
      }
      expect(details).toHaveLength(2)
      for (const [position, outcome] of outcomes.entries()) {
        const detail = details.find(item => item.id === outcome.id)!
        expect(detail.state).toBe(position === 0 ? 'FLAG' : 'CLEAR')
        expect(detail.timeline.filter(event => event.type === 'assessment')).toHaveLength(20)
        expect(detail.timeline.filter(event => event.type === 'attempt')).toHaveLength(50)
        expect(detail.timeline.filter(event => event.type === 'run')).toHaveLength(20)
        expect(detail.bindings[0].latestEvidence?.reason).toBe(position === 0 ? 'response_error' : 'response_received')
        expect(detail.lastSuccessfulVerificationAt).toBe(audits[position === 0 ? 21 : 0].createdAt.toISOString())
        expect(await loadSiteOutcomeDetail(site, outcome.id)).toEqual(detail)
      }
      queryTrace.active = true; queryTrace.queries = []
      const summaries = await listSiteOutcomes(site)
      queryTrace.active = false
      expect(summaries.map(item => [item.id, item.state])).toEqual(details.map(item => [item.id, item.state]))
      expect(queryTrace.queries.some(query => query.includes('outcome_binding_executions'))).toBe(false)
      const summaryAssessments = queryTrace.queries.find(query => query.startsWith('SELECT "public"."outcome_assessments"'))!
      expect(summaryAssessments).toContain('"outcome_assessments"."id" IN')
      expect(summaryAssessments.match(/"outcome_assessments"\."id" IN \(([^)]*)\)/)![1].split(',')).toHaveLength(2)
      const olderSuccess = await prisma.outcomeAssessment.findFirstOrThrow({ where: { outcomeId: outcomes[0].id, state: 'CLEAR' } })
      const read = prisma.siteOutcome.findMany.bind(prisma.siteOutcome)
      let superseded = false
      const changed = vi.spyOn(prisma.siteOutcome, 'findMany').mockImplementation(async args => {
        if (!superseded) {
          superseded = true
          await prisma.outcomeAssessment.update({ where: { id: olderSuccess.id }, data: { evidence: { supersededByAssessmentId: 'newer-assessment' } } })
        }
        return read(args)
      })
      try { expect((await loadSiteOutcomeDetail(site, outcomes[0].id))?.lastSuccessfulVerificationAt).toBeNull() }
      finally { changed.mockRestore() }
    } finally { queryTrace.active = false; await prisma.audit.deleteMany({ where: { id: { in: audits.map(audit => audit.id) } } }) }
  })

  it('keeps later Flags open while showing a successful repair only for its original captured occurrence', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    const base = Date.now()
    const original = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(base - 3000) } })
    const later = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(base - 2000) } })
    const proof = await prisma.audit.create({ data: { projectId, userId, parentId: original.id, url: site.url, status: 'COMPLETED', completedAt: new Date(base - 1000) } })
    const improvement = await prisma.improvement.create({ data: { projectId, fingerprint: 'check:broken-internal-links', status: 'VERIFIED',
      title: 'Repair a page link', judgment: 'Recorded response failure', expectedBenefit: 'The destination responds',
      recommendedChange: 'Restore the destination', successCondition: 'Comparable destination response succeeds' } })
    const flags: Flag[] = []
    for (const [index, audit] of [original, later].entries()) {
      const flag = await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', checkId: 'broken-internal-links',
        fingerprint: improvement.fingerprint, rubric: 'REACH', severity: 'IMPORTANT', impactTag: 'SEO', confidence: 1,
        problem: 'A page destination was unavailable', evidence: 'Controlled HTTP 503', whyItMatters: 'The page cannot be reached',
        fix: 'Restore the destination', pageUrl: site.url + (index ? 'later' : 'original'), status: 'OPEN', position: 0,
        createdAt: new Date(base - 3000 + index * 1000) } })
      await prisma.improvementOccurrence.create({ data: { improvementId: improvement.id, auditId: audit.id, flagId: flag.id,
        kind: 'OBSERVED', createdAt: flag.createdAt } })
      flags.push(flag)
    }
    await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: original.id,
      handoffReference: 'flag:' + flags[0].id, verificationAuditId: proof.id, builder: 'site', outcome: 'IMPROVED', comparable: true } })
    expect(await loadSiteFlags(site)).toMatchObject([{ sourceFlagId: flags[1].id, status: 'OPEN', verificationState: 'still_open' }])
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ sourceFlagId: flags[0].id, affectedPaths: [flags[0].pageUrl] }])
    expect(await loadSiteFlagDetail(site, improvement.id)).toMatchObject({ sourceFlagId: flags[1].id, status: 'OPEN', verificationState: 'still_open' })
    expect(await loadSiteFlagDetail(site, flags[0].id)).toMatchObject({ sourceFlagId: flags[0].id, status: 'VERIFIED', verificationState: 'verified' })
    const summary = (await loadSiteSummaries(userId)).find(value => value.id === projectId)!
    expect(summary.presentation.flags.count).toBe(1)
    expect(summary.presentation.result.state).toBe('flags')
  })

  it('retains newer incidents through a delayed older success, then verifies genuine recovery and recurrence', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page availability', slug: 'incident-order', kind: 'AVAILABILITY' } })
    const fingerprint = outcomeFlagFingerprint(outcome.id, 'http')
    const improvement = await prisma.improvement.create({ data: { projectId, outcomeId: outcome.id, fingerprint,
      title: 'Restore the page', judgment: 'Controlled unavailable response', expectedBenefit: 'The page responds',
      recommendedChange: 'Restore the response', successCondition: 'Comparable public response succeeds', status: 'PROPOSED' } })
    const base = Date.now(), coverage = { environment: 'production', policy: 'ALL_REQUIRED', requiredBindings: ['http'], observedBindings: ['http'], scope: null,
      bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: site.url }, scope: null }] }
    async function observation(label: string, requested: number, observed: number, state: 'FLAG' | 'CLEAR') {
      const audit = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(base + observed), isPublic: false } })
      const run = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: label,
        status: 'COMPLETED', requestedAt: new Date(base + requested), selections: { create: { outcomeId: outcome.id } } } })
      const flag = state === 'FLAG' ? await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', fingerprint,
        rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'The page was unavailable', evidence: 'Controlled HTTP 503',
        whyItMatters: 'The page cannot be reached', fix: 'Restore the page', confidence: 1, position: 0 } }) : null
      if (flag) await prisma.improvementOccurrence.create({ data: { improvementId: improvement.id, flagId: flag.id, auditId: audit.id, kind: 'OBSERVED' } })
      const input = { projectId, bindingKeys: ['http'], failureFlagIds: flag ? [flag.id] : [], outcomeKind: 'AVAILABILITY',
        outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id, improvementId: improvement.id, state,
        summary: 'Controlled ' + state.toLowerCase() + ' observation', coverage, evidence: { reason: state === 'FLAG' ? 'http_unavailable' : 'available' },
        assessedAt: new Date(base + observed), validUntil: new Date(base + observed + 60_000) }
      return { audit, run, flag, input }
    }
    const original = await observation('first-failure', -50_000, -40_000, 'FLAG')
    const delayed = await observation('delayed-success', -30_000, -5_000, 'CLEAR')
    const newer = await observation('newer-failure', -20_000, -10_000, 'FLAG')
    await persistOutcomeAssessment(original.input)
    const current = await persistOutcomeAssessment(newer.input)
    expect(readOutcomeIncident(current.evidence)?.transition).toBe('ongoing_failure')
    const historical = await persistOutcomeAssessment(delayed.input)
    expect(historical.evidence).toMatchObject({ supersededByAssessmentId: current.id, incident: { transition: 'clear', recoveredFlagIds: [] } })
    expect(await persistOutcomeAssessment(delayed.input)).toEqual(historical)
    await expect(persistOutcomeAssessment({ ...delayed.input, projectId: 'another-site' })).rejects.toThrow('no matching Site request')
    for (const flag of [original.flag!, newer.flag!]) expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }))
      .toMatchObject({ status: 'OPEN', resolvedInId: null })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } })).toMatchObject({ status: 'PROPOSED' })
    const duringOutage = await loadSiteOutcomeDetail(site, outcome.id)
    expect(duringOutage?.lastSuccessfulVerificationAt).toBeNull()
    expect(mcpOutcomePayload(duringOutage!).freshness.lastSuccessfulVerificationAt).toBeNull()
    const continued = await observation('continued-failure', 1000, 2000, 'FLAG')
    const ongoing = await persistOutcomeAssessment(continued.input)
    expect(readOutcomeIncident(ongoing.evidence)).toMatchObject({ transition: 'ongoing_failure', incidentRunRequestId: original.run.id })
    const repaired = await observation('genuine-recovery', 3000, 4000, 'CLEAR')
    expect(readOutcomeIncident((await persistOutcomeAssessment(repaired.input)).evidence)?.transition).toBe('recovery')
    for (const flag of [original.flag!, newer.flag!, continued.flag!]) expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }))
      .toMatchObject({ status: 'FIXED', resolvedInId: repaired.audit.id })
    const recoveredRows = await prisma.flag.findMany({ where: { id: { in: [original.flag!.id, newer.flag!.id, continued.flag!.id] } } })
    const proofs = await loadIncidentRecoveryProofs([{ projectId, flags: recoveredRows }])
    for (const flag of recoveredRows) expect(proofs.get(projectId)?.hasFlag?.(flag)).toBe(true)
    expect(await loadSiteFindings(site)).toMatchObject({ flags: [], recommendations: [] })
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ status: 'FIXED', verificationState: 'verified', resolvedInId: repaired.audit.id }])
    const monitored = { version: 1 as const, targetUrl: site.url, environment: 'production', scope: 'OUTCOMES' as const, checks: {},
      outcomes: [{ id: outcome.id, kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED',
        bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY' as const, required: true, config: { startUrl: site.url } }] }],
      verificationTarget: null }
    await prisma.audit.update({ where: { id: repaired.audit.id }, data: { executionSpec: monitored } })
    const summary = await outcomeMonitoringDiff(repaired.audit.id)
    const resolved = await loadSiteResolvedFlags(site)
    expect(summary?.fixed.map(flag => flag.id)).toEqual([continued.flag!.id])
    expect(resolved.map(flag => flag.sourceFlagId)).toEqual(summary?.fixed.map(flag => flag.id))
    const recoveredDetail = await loadSiteOutcomeDetail(site, outcome.id)
    expect(recoveredDetail?.lastSuccessfulVerificationAt).toBe(repaired.input.assessedAt.toISOString())
    expect(mcpOutcomePayload(recoveredDetail!).freshness.lastSuccessfulVerificationAt).toBe(repaired.input.assessedAt.toISOString())
    const repeated = await observation('genuine-recurrence', 5000, 6000, 'FLAG')
    expect(readOutcomeIncident((await persistOutcomeAssessment(repeated.input)).evidence)?.transition).toBe('regression')
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: repeated.flag!.id } })).toMatchObject({ status: 'REGRESSED' })
    const after = await loadIncidentRecoveryProofs([{ projectId, flags: await prisma.flag.findMany({ where: { audit: { projectId } } }) }])
    expect(after.get(projectId)?.hasFlag?.(repeated.flag!)).toBe(false)
    for (const flag of recoveredRows) expect(after.get(projectId)?.hasFlag?.(flag)).toBe(true)
    expect(await loadSiteFindings(site)).toMatchObject({ flags: [], recommendations: [{ sourceFlagId: repeated.flag!.id, status: 'REGRESSED' }] })
    await prisma.audit.update({ where: { id: repeated.audit.id }, data: { executionSpec: monitored } })
    const recurrence = await outcomeMonitoringDiff(repeated.audit.id)
    expect(recurrence?.regressed.map(flag => flag.id)).toEqual([repeated.flag!.id])
    expect((await loadSiteFindings(site)).recommendations.map(flag => flag.sourceFlagId)).toEqual(recurrence?.regressed.map(flag => flag.id))
    expect(await loadSiteResolvedFlags(site)).toMatchObject([{ status: 'FIXED', verificationState: 'verified', resolvedInId: repaired.audit.id }])
    const afterRecurrence = await loadSiteOutcomeDetail(site, outcome.id)
    expect(afterRecurrence?.lastSuccessfulVerificationAt).toBe(repaired.input.assessedAt.toISOString())
    expect(mcpOutcomePayload(afterRecurrence!).freshness.lastSuccessfulVerificationAt).toBe(repaired.input.assessedAt.toISOString())
    for (const flag of [continued.flag!, repeated.flag!]) await prisma.flag.update({ where: { id: flag.id },
      data: { supportingObservations: { version: 999, items: [{ evidence: 'Private unavailable observation' }] } } })
    const unreadableRecovery = await outcomeMonitoringDiff(repaired.audit.id)
    const unreadableRecurrence = await outcomeMonitoringDiff(repeated.audit.id)
    expect(unreadableRecovery?.fixed).toMatchObject([{ id: continued.flag!.id, supportingEvidenceUnreadable: true }])
    expect(unreadableRecurrence?.regressed).toMatchObject([{ id: repeated.flag!.id, supportingEvidenceUnreadable: true }])
    for (const comparison of [unreadableRecovery!, unreadableRecurrence!]) {
      expect(JSON.stringify(comparison)).not.toContain('Private unavailable observation')
    }
  })

  it('keeps the latest requested answer and its method when an older run finishes later', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page availability', slug: 'request-order', kind: 'AVAILABILITY',
      bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: site.url } } } } })
    const base = Date.now(), coverage = { environment: 'production', requiredBindings: ['http'],
      bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1 }] }
    const rows: Array<{ audit: { id: string }; run: { id: string }; assessment: OutcomeAssessment }> = []
    for (const older of [false, true]) {
      const audit = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', executionSpec: {
        version: 1, scope: 'OUTCOMES', targetUrl: site.url, environment: 'production', checks: {}, verificationTarget: null,
        outcomes: [{ id: outcome.id, kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED',
          bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, required: true, config: { startUrl: site.url } }] }],
      } } })
      const run = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: older ? 'old-request' : 'latest-request',
        status: 'COMPLETED', requestedAt: new Date(base - (older ? 120_000 : 60_000)), selections: { create: { outcomeId: outcome.id } } } })
      const assessedAt = new Date(base - (older ? 0 : 30_000))
      const assessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id,
        state: older ? 'CLEAR' : 'COULD_NOT_VERIFY', summary: older ? 'Earlier request succeeded' : 'The latest request could not complete',
        assessedAt, validUntil: new Date(base + 60_000), coverage } })
      await prisma.outcomeBindingExecution.create({ data: { auditId: audit.id, outcomeId: outcome.id, bindingKey: 'http', mechanism: 'HTTP_AVAILABILITY',
        bindingVersion: 1, disposition: older ? 'SUCCEEDED' : 'BLOCKED', reason: older ? 'http_ok' : 'request_failed', createdAt: assessedAt } })
      rows.push({ audit, run, assessment })
    }
    const [listed, detail] = await Promise.all([listSiteOutcomes(site), loadSiteOutcomeDetail(site, outcome.id)])
    expect(listed.find(value => value.id === outcome.id)).toMatchObject({ state: 'COULD_NOT_VERIFY', latestRunId: rows[0].run.id })
    expect(detail).toMatchObject({ state: 'COULD_NOT_VERIFY', summary: rows[0].assessment.summary, latestRunId: rows[0].run.id })
    expect(detail!.bindings[0].latestEvidence).toMatchObject({ auditId: rows[0].audit.id, disposition: 'BLOCKED', reason: 'request_failed' })
    expect(mcpOutcomePayload(detail!).methods[0].evidence).toMatchObject({ auditId: rows[0].audit.id, disposition: 'BLOCKED' })
    expect(detail!.timeline.some(event => event.type === 'attempt' && event.auditId === rows[1].audit.id)).toBe(true)
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: rows[1].assessment.id } })).toEqual(rows[1].assessment)
  })

  it('projects current watched configuration consistently across the list and Outcome detail without rewriting history', async () => {
    if (!/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
      throw new Error('Use the disposable execution verifier')
    // Controlled report facts isolate read projection from collector acceptance.
    const audit = await prisma.audit.create({ data: { projectId, userId, url: site.url, status: 'COMPLETED', completedAt: new Date(),
      reportCompleteness: 'FULL', evidenceCoverage: { metadata: true }, executionSpec: {
        version: 1, scope: 'SITE', targetUrl: site.url, environment: 'production',
        checks: { 'no-https': 1, 'security-mixed-content': 1 }, outcomes: [], verificationTarget: null,
      } } })
    await prisma.auditPage.create({ data: { auditId: audit.id, url: site.url, normalizedUrl: site.url, role: 'primary', position: 0, status: 'COMPLETED' } })
    await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'module:security', source: 'DETERMINISTIC', status: 'COMPLETED',
      detail: { kind: 'site-module-check', version: 1, module: 'security', pageUrl: site.url, passed: true, applicable: true,
        assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Secure transport', observed: 'Secure transport', passed: true })) } } })
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page availability', slug: 'current-read', kind: 'AVAILABILITY',
      bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: site.url } } } } })
    const run = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: 'read-proof', status: 'COMPLETED' } })
    const coverage = { environment: 'production', requiredBindings: ['http'], bindings: [{ key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1 }] }
    const assessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id,
      state: 'CLEAR', summary: 'Controlled availability observation', validUntil: new Date(Date.now() + 60_000), coverage } })
    async function expectCurrent(state: 'CLEAR' | 'COULD_NOT_VERIFY') {
      const [summaries, details] = await Promise.all([loadSiteSummaries(userId), listSiteOutcomes(site)])
      expect(summaries.find(row => row.id === projectId)?.presentation.result.state).toBe(state === 'CLEAR' ? 'clear' : 'could_not_verify')
      expect(details.find(row => row.id === outcome.id)?.state).toBe(state)
    }
    await expectCurrent('CLEAR')
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } }, data: { version: 2 } })
    await expectCurrent('COULD_NOT_VERIFY')
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } }, data: { version: 1, enabled: false } })
    await expectCurrent('COULD_NOT_VERIFY')
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } }, data: { enabled: true } })
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { environment: 'staging' } })
    await expectCurrent('COULD_NOT_VERIFY')
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { environment: 'production' } })
    const fixture = await prisma.outcomeFixture.create({ data: { projectId, configuredByUserId: userId, name: 'Read-only fixture metadata', targetUrl: site.url,
      fieldMapping: {}, encryptedValues: 'unused-in-read-fixture', successCriterion: {}, resetUrl: site.url, cleanupUrl: site.url,
      version: 1, lastDryRunVersion: 1, authorizedAt: new Date() } })
    await prisma.outcomeExecutionBinding.update({ where: { outcomeId_key: { outcomeId: outcome.id, key: 'http' } },
      data: { mechanism: 'SAFE_FORM', version: 2, config: { fixtureId: fixture.id } } })
    await expectCurrent('COULD_NOT_VERIFY')
    const formRun = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: 'form-read-proof', status: 'COMPLETED' } })
    const formAssessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: formRun.id, auditId: audit.id,
      state: 'CLEAR', summary: 'Controlled form observation', validUntil: new Date(Date.now() + 60_000), coverage: {
        environment: 'production', requiredBindings: ['http'], bindings: [{ key: 'http', mechanism: 'SAFE_FORM', version: 2,
          fixture: { id: fixture.id, version: 1 } }],
      } } })
    await expectCurrent('CLEAR')
    await prisma.outcomeFixture.update({ where: { id: fixture.id }, data: { authorizedAt: null } })
    await expectCurrent('COULD_NOT_VERIFY')
    await prisma.outcomeFixture.update({ where: { id: fixture.id }, data: { authorizedAt: new Date(), version: 2, lastDryRunVersion: 2 } })
    await expectCurrent('COULD_NOT_VERIFY')
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: formAssessment.id } })).toEqual(formAssessment)
  })

  it('never leaves an enabled binding behind when a concurrent withdrawal wins', async () => {
    for (let index = 0; index < 8; index += 1) {
      const outcome = await genericOutcome(`race-${index}`)
      await Promise.all([
        confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' }),
        confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: false }),
      ])

      const stored = await prisma.siteOutcome.findUniqueOrThrow({
        where: { id: outcome.id },
        include: { bindings: { where: { enabled: true } } },
      })
      if (stored.confirmedAt === null) {
        expect(stored.bindings, 'an unconfirmed Outcome must not execute unattended').toHaveLength(0)
      } else {
        expect(stored.bindings.map((binding) => binding.key)).toEqual(['checkout-browser-v1'])
      }
    }
  })

  it('keeps a customer rename and the original time across a repeated same-kind request', async () => {
    const outcome = await genericOutcome('same-kind')
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })
    await renameSiteOutcome({
      site,
      outcomeId: outcome.id,
      name: 'A customer can buy the annual plan',
    })
    const before = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })

    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })

    const after = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })
    expect(after.name).toBe('A customer can buy the annual plan')
    expect(after.confirmedAt?.toISOString()).toBe(before.confirmedAt?.toISOString())
  })

  it('preserves a page-specific target when its existing agreement is reconfirmed', async () => {
    const created = await createSiteOutcome({ site, kind: 'AVAILABILITY', targetUrl: site.url + 'pricing' })
    expect(created).not.toBeNull()
    const before = await prisma.outcomeExecutionBinding.findFirstOrThrow({ where: { outcomeId: created!.id, enabled: true } })
    await confirmSiteOutcome({ site, outcomeId: created!.id, confirmed: true, kind: 'AVAILABILITY' })
    const after = await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.config).toEqual(before.config)
    expect(after.scope).toEqual(before.scope)
    expect(after.version).toBe(before.version)
  })

  it('versions a changed target so work admitted against its old binding can be fenced', async () => {
    const outcome = await genericOutcome('changed-target')
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'AVAILABILITY' })
    const before = await prisma.outcomeExecutionBinding.findFirstOrThrow({ where: { outcomeId: outcome.id, enabled: true } })
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'AVAILABILITY', targetUrl: site.url + 'pricing' })
    const after = await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.version).toBe(before.version + 1)
    expect(after.config).not.toEqual(before.config)
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'AVAILABILITY', targetUrl: site.url + 'pricing' })
    expect((await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { id: before.id } })).version).toBe(after.version)
  })

  it('preserves the check definition while recording renewed authorization after withdrawal', async () => {
    const outcome = await genericOutcome('reauthorized-binding')
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'AVAILABILITY', targetUrl: site.url + 'pricing' })
    const before = await prisma.outcomeExecutionBinding.findFirstOrThrow({ where: { outcomeId: outcome.id, enabled: true } })
    const agreedBefore = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: false })
    expect((await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { id: before.id } })).enabled).toBe(false)
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'AVAILABILITY' })
    const after = await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { id: before.id } })
    expect(after).toMatchObject({ enabled: true, version: before.version, config: before.config })
    const agreedAfter = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })
    expect(agreedAfter.confirmedAt!.getTime()).toBeGreaterThan(agreedBefore.confirmedAt!.getTime())
    expect(agreedAfter.authorizationRevision).toBe(agreedBefore.authorizationRevision + 1)
  })

  it('revokes live task ownership without changing recovery obligations or unrelated evidence', async () => {
    const created = await createSiteOutcome({ site, kind: 'AVAILABILITY', targetUrl: site.url + 'pricing' })
    const ownedOutcomes = () => prisma.siteOutcome.findMany({ where: { id: created!.id }, include: { bindings: true } })
    const input = { projectId, targetUrl: site.url + 'pricing', environment: 'production', scope: 'OUTCOMES' as const }
    const originalOutcomes = await ownedOutcomes()
    const before = await buildExecutionSpec({ ...input, outcomes: originalOutcomes })
    const audit = await prisma.audit.create({ data: { userId, projectId, url: input.targetUrl, status: 'CHECKING', executionSpec: before as Prisma.InputJsonValue } })
    const token = randomUUID()
    const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:binding',
      source: 'EXECUTION', status: 'RUNNING', workKind: 'bindings', workState: 'RUNNING', workToken: token,
      workGeneration: 1, workLeaseUntil: new Date(Date.now() + 90_000), workInput: {
        pageUrl: input.targetUrl, position: 0, primary: true, role: 'primary', outcomeId: created!.id,
        bindingKey: before.outcomes[0]!.bindings[0]!.key,
      } } })
    const retained = await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'retained-observation',
      source: 'DETERMINISTIC', status: 'COMPLETED', detail: { observation: 'Already recorded evidence' } } })
    const owner = { auditId: audit.id, taskId: task.id, token, generation: 1 }
    let signal: AbortSignal | undefined
    const running = withExecutionOwnership(owner, () => new Promise((_resolve, reject) => {
      signal = currentExecutionOwnership()!.signal!
      signal.addEventListener('abort', () => reject(new ExecutionOwnershipLost()), { once: true })
    }))
    const stopped = expect(running).rejects.toBeInstanceOf(ExecutionOwnershipLost)
    try {
      await confirmSiteOutcome({ site, outcomeId: created!.id, confirmed: false })
      await stopped
      expect(signal!.aborted).toBe(true)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'BLOCKED', workToken: null, workErrorCode: 'OUTCOME_AUTHORIZATION_CHANGED' })
      await expect(withExecutionOwnership(owner, () => executionWrite(tx => tx.audit.update({
        where: { id: audit.id }, data: { status: 'COMPLETED' },
      })))).rejects.toBeInstanceOf(ExecutionOwnershipLost)
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).status).toBe('CHECKING')
      expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: retained.id } })).toEqual(retained)
      await confirmSiteOutcome({ site, outcomeId: created!.id, confirmed: true, kind: 'AVAILABILITY' })
      const renewedOutcomes = await ownedOutcomes()
      const after = await buildExecutionSpec({ ...input, outcomes: renewedOutcomes })
      expect(snapshotOutcomeAuthorization(renewedOutcomes).outcomes[0]!.revision)
        .toBe(snapshotOutcomeAuthorization(originalOutcomes).outcomes[0]!.revision + 1)
      expect(comparableOutcomeCoverage(admittedOutcomeCoverage(before, before.outcomes[0]!),
        admittedOutcomeCoverage(after, after.outcomes[0]!))).toBe(true)
    } finally {
      if (!signal?.aborted) await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workState: 'BLOCKED', workToken: null } })
      await stopped
    }
  })

  it('makes disable idempotent and keeps its new authorization after re-enabling', async () => {
    const created = await createSiteOutcome({ site, kind: 'AVAILABILITY', targetUrl: site.url + 'pricing' })
    const before = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: created!.id } })
    await setSiteOutcomeEnabled({ site, outcomeId: created!.id, enabled: false })
    await setSiteOutcomeEnabled({ site, outcomeId: created!.id, enabled: false })
    await setSiteOutcomeEnabled({ site, outcomeId: created!.id, enabled: true })
    const after = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: created!.id } })
    expect(after).toMatchObject({ enabled: true, authorizationRevision: before.authorizationRevision + 1 })
  })

  it('does not wait on or touch a foreign tenant Outcome row', async () => {
    const foreignProject = await prisma.project.create({
      data: {
        userId,
        name: 'Foreign Outcome fixture',
        url: 'https://other.example/',
        canonicalHost: 'other.example',
      },
    })
    const foreignOutcome = await prisma.siteOutcome.create({
      data: {
        projectId: foreignProject.id,
        name: 'Foreign purchase',
        slug: 'foreign-purchase',
        kind: 'CHECKOUT',
        inferenceSource: 'user',
        confirmedAt: new Date('2026-09-29T00:00:00.000Z'),
      },
    })

    let releaseLock: (() => void) | undefined
    const release = new Promise<void>((resolve) => { releaseLock = resolve })
    let announceLock: (() => void) | undefined
    const locked = new Promise<void>((resolve) => { announceLock = resolve })
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "site_outcomes"
        WHERE "id" = ${foreignOutcome.id}
        FOR UPDATE
      `)
      announceLock?.()
      await release
    })
    await locked

    const attempted = confirmSiteOutcome({
      site,
      outcomeId: foreignOutcome.id,
      confirmed: false,
    })
    const timeout = Symbol('foreign lock timeout')
    let observed: Awaited<typeof attempted> | typeof timeout
    try {
      observed = await Promise.race([
        attempted,
        new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), 1_000)),
      ])
      expect(observed, 'a foreign row lock must not contend with this tenant').not.toBe(timeout)
      expect(observed).toBeNull()
    } finally {
      releaseLock?.()
      await holder
      await attempted
    }

    const unchanged = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: foreignOutcome.id } })
    expect(unchanged.confirmedAt?.toISOString()).toBe('2026-09-29T00:00:00.000Z')
    expect(unchanged.name).toBe('Foreign purchase')
  })
})
