import { spawnSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checks/route'
import { prisma } from '@/lib/db'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { projectSiteAnalysis } from '@/lib/sites/application/project-analysis'
import { reconcileOutcomeRunsForAudit } from '@/lib/sites/application/run-reconciliation'
import { DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
import { DESTINATION_STUDY_EDITION_SHA256, DESTINATION_STUDY_PATH } from '@/lib/growth/destination-study-publication'
import { destinationStudyReadout } from '@/lib/growth/destination-study-readout'
import { loadDestinationStudyOperationalSnapshot } from '@/lib/growth/destination-study-operational'
import { checkPublicLinks, originalPublicLinkContexts } from '@/lib/audit/checks/public-links'
import { nativeHttpCollection } from '@/lib/audit/native-http-evidence'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { commitCheckReceipt } from '@/lib/audit/progressive/results'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { observationsForFlag } from '@/lib/audit/flag-observations'
import { buildDeterministicFlagRow } from '@/lib/audit/persist'
import { materializeAttentionForAudit } from '@/lib/improvements/occurrences'
import { reconcileImprovementVerification } from '@/lib/improvements/verification'
import { COPIED_HANDOFF_CLIENT } from '@/lib/improvements/handoff-contract'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { loadOutcomeRecoveryValue } from '../outcome-recovery-query'
import { loadSiteValueCohort } from '../site-value-query'
import { loadSiteFirstValueFunnel } from '../site-first-value-funnel'

const admission = vi.hoisted(() => ({ claimedIds: [] as string[], dispatch: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/sites/visitor-identity', async original => ({
  ...await original<typeof import('@/lib/sites/visitor-identity')>(),
  resolveVisitorKey: async () => 'anon-v1:controlledtest01',
}))
vi.mock('@/lib/audit/usage', async original => ({
  ...await original<typeof import('@/lib/audit/usage')>(),
  checkAnonymousAuditAllowed: async () => ({ allowed: true }),
  enforceAnonymousIpSoftCeiling: async () => undefined,
  trackAnonymousAuditId: async (id: string) => { admission.claimedIds.push(id) },
  readClaimedAnonymousIds: async () => [...admission.claimedIds],
  clearAnonymousAuditCookie: async () => { admission.claimedIds.length = 0 },
}))
vi.mock('@/lib/audit/dispatch', () => ({ dispatchAudit: admission.dispatch }))
vi.mock('@/lib/security/rate-limit', async original => ({
  ...await original<typeof import('@/lib/security/rate-limit')>(),
  enforceRateLimit: async () => undefined,
  recordRateLimit: async () => ({ exceeded: false, retryAfterSeconds: 0 }),
}))
vi.mock('@/lib/queue/estimate', async original => ({
  ...await original<typeof import('@/lib/queue/estimate')>(),
  getWorkerQueueEstimate: async () => ({ waitingJobs: 0, activeJobs: 0, workerAvailable: false }),
}))

describe.skipIf(process.env.DEFAULT_MONITORING_DB_REQUIRED !== 'true')('Growth reporting over retained repairs and native Outcomes', () => {
  function requireDisposableDatabase() {
    const url = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname)) {
      throw new Error('Use the disposable execution verifier')
    }
  }

  it('observes a scheduled pass and later failure after a recorded recovery', async () => {
    requireDisposableDatabase()
    const base = Date.now() - 40 * 86_400_000
    const at = (day: number, ms = 0) => new Date(base + day * 86_400_000 + ms)
    const user = await prisma.user.create({ data: { email: 'native-recovery@example.test' } })
    const admittedIds: string[] = []
    try {
      const guide = 'website-online-but-not-working'
      const journeyId = `ffj_${'d'.repeat(32)}`
      const referrer = 'http://localhost/new'
      async function analyze(target: string, consent: 'granted' | 'denied', label = guide) {
        const response = await POST(new NextRequest('http://localhost/api/checks', {
          method: 'POST', headers: { 'content-type': 'application/json', cookie: `${ANALYTICS_CONSENT_COOKIE}=${consent}`,
            referer: `${referrer}?ff_guide=${label}&journey_id=${journeyId}` },
          body: JSON.stringify({ url: target, source: 'homepage', journeyId }),
        }))
        expect(response.status).toBe(201)
        const body: { reportId: string; reused: boolean } = await response.json()
        admittedIds.push(body.reportId)
        return body
      }
      // Public literal addresses exercise target admission without DNS or network probes.
      const denied = await analyze('https://93.184.215.15/', 'denied')
      const startKey = (id: string) => `analyze_started:${id}`
      expect((await prisma.siteLifecycleEvent.findUniqueOrThrow({ where: { idempotencyKey: startKey(denied.reportId) } })).properties)
        .toEqual({ anonymous: true, trigger: 'manual' })
      admission.claimedIds.length = 0
      const granted = await analyze('https://93.184.215.14/', 'granted')
      expect(await analyze('https://93.184.215.14/', 'granted', 'guides-index')).toMatchObject({
        reportId: granted.reportId, reused: true,
      })
      expect(admission.dispatch.mock.calls.map(([id]) => id)).toEqual([denied.reportId, granted.reportId])
      expect(await prisma.audit.findMany({ where: { id: { in: admittedIds } }, select: { referrer: true, userId: true } }))
        .toEqual([{ referrer, userId: null }, { referrer, userId: null }])
      expect((await prisma.siteLifecycleEvent.findUniqueOrThrow({ where: { idempotencyKey: startKey(granted.reportId) } })).properties)
        .toEqual({ anonymous: true, trigger: 'manual', guideEntry: guide, journeyId })

      // Move the synthetic admissions into a mature cohort, then run the real
      // completion projection and claim writers before assembling the readout.
      const initial = await prisma.audit.update({ where: { id: granted.reportId }, data: {
        status: 'COMPLETED', createdAt: at(-1), startedAt: at(-1, 1), completedAt: at(-1, 3),
      } })
      await prisma.siteLifecycleEvent.update({ where: { idempotencyKey: startKey(initial.id) }, data: { createdAt: at(-1, 1) } })
      await projectSiteAnalysis(initial.id)
      await prisma.siteLifecycleEvent.update({
        where: { idempotencyKey: `analysis_completed:${initial.id}` }, data: { createdAt: at(-1, 3) },
      })
      admission.claimedIds.splice(0, admission.claimedIds.length, initial.id)
      expect(await claimAnonymousAudits(user.id)).toBe(1)
      const claim = await prisma.siteLifecycleEvent.update({
        where: { idempotencyKey: `analysis_claimed:${initial.id}` }, data: { createdAt: at(0, -1) },
      })
      expect(claim.userId).toBe(user.id)
      const site = await prisma.project.update({ where: { id: claim.projectId! },
        data: { createdAt: at(-1, 4), notificationLevel: 'OFF' } })
      const privateHost = new URL(site.url).hostname
      const outcome = await prisma.siteOutcome.create({ data: {
        projectId: site.id, name: 'Availability', slug: 'availability', kind: 'AVAILABILITY',
      } })
      const binding = { key: 'http', version: 1, required: true, mechanism: 'HTTP_AVAILABILITY' as const,
        config: { startUrl: site.url, expectedSelector: 'body' }, scope: null }
      const spec = { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl: site.url, environment: 'production',
        checks: {}, verificationTarget: null, outcomes: [{ id: outcome.id, kind: outcome.kind, expectation: null,
          bindingPolicy: outcome.bindingPolicy, bindings: [binding] }] }
      vi.useFakeTimers({ toFake: ['Date'] })
      async function observe(day: number, source: 'WEB' | 'WATCH', failed: boolean) {
        vi.setSystemTime(at(day, 4))
        const audit = await prisma.audit.create({ data: { userId: user.id, projectId: site.id, url: site.url,
          isPublic: false, status: 'COMPLETED', createdAt: at(day), startedAt: at(day, 1), completedAt: at(day, 3), executionSpec: spec } })
        const request = await prisma.runRequest.create({ data: { projectId: site.id, auditId: audit.id, source,
          requestedByUserId: user.id, requestedAt: at(day), idempotencyKey: `controlled-${day}`, executionSpec: spec,
          selections: { create: { outcomeId: outcome.id } } } })
        const flag = failed ? await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC',
          checkId: 'outcome-availability-failed',
          fingerprint: outcomeFlagFingerprint(outcome.id, binding.key), rubric: 'EXPERIENCE', severity: 'IMPORTANT',
          problem: 'Controlled unavailable response', evidence: 'Synthetic HTTP 503',
          whyItMatters: 'The page cannot be reached', fix: 'Restore the page',
          confidence: 1, position: 0, createdAt: at(day, 2) } }) : null
        await prisma.outcomeBindingExecution.create({ data: {
          auditId: audit.id, outcomeId: outcome.id, bindingKey: binding.key, bindingVersion: binding.version,
          mechanism: binding.mechanism, disposition: failed ? 'FAILED' : 'SUCCEEDED',
          reason: failed ? 'http_unavailable' : 'available', createdAt: at(day, 2),
          detail: { evaluator: DEFAULT_AVAILABILITY_EVALUATOR, ...(flag ? { failureFlagId: flag.id } : {}) },
        } })
        expect(await reconcileOutcomeRunsForAudit(audit.id)).toBe(1)
        return prisma.outcomeAssessment.findUniqueOrThrow({
          where: { runRequestId_outcomeId: { runRequestId: request.id, outcomeId: outcome.id } },
        })
      }

      expect((await observe(0, 'WATCH', true)).state).toBe('FLAG')
      expect((await observe(1, 'WEB', false)).evidence).toMatchObject({
        incident: { transition: 'recovery', recoveredFlagIds: [expect.any(String)] },
      })
      expect((await observe(2, 'WATCH', false)).state).toBe('CLEAR')
      expect((await observe(3, 'WATCH', true)).state).toBe('FLAG')
      const report = await loadOutcomeRecoveryValue({ since: at(1), now: at(12) })
      expect(report.counts).toMatchObject({
        matureRecoveredFlags: 1, firstComparablePass: 1, firstComparableFailure: 0,
        anyComparableFailure: 1, comparableFailureAfterScheduledPass: 1,
      })
      expect(JSON.stringify(report)).not.toContain(privateHost)
      const cohort = () => loadSiteValueCohort({
        since: at(-1), startWindowEnd: at(0, -1000), now: at(40), followupDays: 28, includeNativeOutcomeRecovery: true,
      })
      expect(await cohort()).toMatchObject({
        nativeOutcomeFollowup: { counts: { sitesWithMatureRecoveryFollowup: 1, sitesWithCompletedOwnerWebCheckAfterRecovery: 0 } },
      })
      const ownerCheck = await observe(4, 'WEB', true)
      const expectedOutcomeCounts = {
        sitesWithRetainedAssessments: 1, sitesWithVerifiedRecovery: 1,
        sitesWithMatureRecoveryFollowup: 1, sitesWithFailureAfterScheduledPass: 1,
        sitesWithCompletedOwnerWebCheckAfterRecovery: 1,
      }
      const where = { id: ownerCheck.runRequestId }
      await prisma.runRequest.update({ where, data: { requestedByUserId: null } })
      expect(await cohort()).toMatchObject({
        nativeOutcomeFollowup: { counts: { sitesWithCompletedOwnerWebCheckAfterRecovery: 0 } },
      })
      const retained = await prisma.runRequest.update({ where, data: { requestedByUserId: user.id, requestedAt: at(2) } })
      expect(await cohort()).toMatchObject({
        nativeOutcomeFollowup: { counts: { sitesWithCompletedOwnerWebCheckAfterRecovery: 0 } },
      })
      await prisma.runRequest.update({ where, data: { requestedAt: at(4), completedAt: at(9) } })
      expect(await cohort()).toMatchObject({
        nativeOutcomeFollowup: { counts: { sitesWithCompletedOwnerWebCheckAfterRecovery: 0 } },
      })
      await prisma.runRequest.update({ where, data: { completedAt: retained.completedAt } })
      expect(await cohort()).toMatchObject({ nativeOutcomeFollowup: {
        counts: expectedOutcomeCounts, guideEntries: [{ guide, ...expectedOutcomeCounts }],
      } })
      expect(await loadSiteValueCohort({ since: at(-1), now: at(40), followupDays: 7,
        includeNativeOutcomeRecovery: true })).toMatchObject({ nativeOutcomeFollowup: { guideEntries: [{ guide,
        sitesWithVerifiedRecovery: 1, sitesWithMatureRecoveryFollowup: 0, sitesWithFailureAfterScheduledPass: 0,
        sitesWithCompletedOwnerWebCheckAfterRecovery: 0,
      }] } })
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts', '60', 'sites28'], {
        env: process.env, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(0)
      expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout)).toMatchObject({ nativeOutcomeFollowup: { guideEntries: [{ guide, ...expectedOutcomeCounts }] } })
      for (const privateValue of [initial.id, site.id, user.id, outcome.id, 'ffj_', privateHost]) {
        expect(command.stdout).not.toContain(privateValue)
      }
      const day = 86_400_000
      const date = (time: number) => new Date(time).toISOString().slice(0, 10)
      const end = (Math.floor(at(-1, 1).getTime() / day) + 1) * day
      const start = end - 28 * day
      const collectBundle = () => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-customer-value.ts',
        'destination-study', '--start-window', date(start), date(end)], { env: process.env, encoding: 'utf8', timeout: 15_000 })
      const bundled = collectBundle()
      expect(bundled.status).toBe(0)
      expect(bundled.stderr).toBe('')
      for (const privateValue of [initial.id, site.id, user.id, outcome.id, 'ffj_', privateHost]) {
        expect(bundled.stdout).not.toContain(privateValue)
      }
      const operational = JSON.parse(bundled.stdout)
      const releasedOn = date(start - day)
      const publication = { version: 4, origin: 'https://fixflags.com', path: DESTINATION_STUDY_PATH, method: 'public-http-get',
        observedAt: releasedOn + 'T12:00:00.000Z', state: 'edition-match', editionSha256: DESTINATION_STUDY_EDITION_SHA256,
        discovery: { analyzeLink: 'direct', analyzeForm: 'direct', indexDirective: 'no-noindex-observed',
          crawlerRules: 'allowed', sitemapEntry: 'edition-date', articleMetadata: 'edition-matched', llmsEntry: 'canonical-guide' } }
      const studyEvidence = {
        operational, releasedOn,
        publication,
        windowEnd: { ...publication, observedAt: date(end) + 'T12:00:00.000Z' },
        reporting: {
          fetchedAt: at(40).toISOString(), observationWindow: { startDate: date(start), endDate: date(end - day) },
          databaseWritten: false, guide: { path: DESTINATION_STUDY_PATH, canonicalUrl: 'https://fixflags.com' + DESTINATION_STUDY_PATH },
          searchConsole: { status: 'report-read-succeeded', property: 'sc-domain:fixflags.com', pageAggregationConfirmed: true,
            finalizedWindow: { method: 'unfiltered-final-web-by-date', timeZone: 'America/Los_Angeles',
              startDate: date(start), endDate: date(end - day), status: 'confirmed', expectedDays: 28, observedDays: 28, firstMissingDate: null },
            metrics: { clicks: 1, impressions: 1 } },
          ga4: { status: 'report-read-failed' },
          analyzeClicks: { status: 'report-read-failed', eventName: 'guide_analyze_clicked', count: null },
        },
      }
      const readout = destinationStudyReadout(studyEvidence)
      expect(readout).toMatchObject({
        operational: { method: 'single-read-only-snapshot', startCounts: { starts: 1, analysisCompletionReceipts: 1, claimReceipts: 1 }, siteCounts: { sites: 1 },
          recoveryCounts: { sitesWithVerifiedRecovery: 1, sitesWithMatureRecoveryFollowup: 1,
            sitesWithCompletedOwnerWebCheckAfterRecovery: 1 } },
        decision: 'inconclusive', gaps: ['guide-start-minimum-unmet', 'verified-public-link-repair-unobserved'],
      })
      expect(await loadSiteFirstValueFunnel(at(-2))).toMatchObject({ started: 1, claimed: 1, claimRate: 100 })
      const claimKey = `analysis_claimed:${initial.id}`
      await prisma.siteLifecycleEvent.update({ where: { idempotencyKey: claimKey }, data: { createdAt: at(-1) } })
      expect(await loadSiteFirstValueFunnel(at(-2))).toMatchObject({ started: 1, claimed: 0, claimRate: null })
      await prisma.siteLifecycleEvent.update({ where: { idempotencyKey: claimKey }, data: { createdAt: at(0, -1) } })
      await prisma.audit.update({ where: { id: denied.reportId }, data: { createdAt: at(-1) } })
      await prisma.siteLifecycleEvent.delete({ where: { idempotencyKey: startKey(denied.reportId) } })
      const withGap = collectBundle()
      expect(withGap.status).toBe(0)
      expect(withGap.stderr).toBe('')
      expect(destinationStudyReadout({ ...studyEvidence, operational: JSON.parse(withGap.stdout) })).toMatchObject({
        operational: { startCounts: { starts: 1, claimReceipts: 1 }, recoveryCounts: { sitesWithVerifiedRecovery: 1 } },
        decision: 'inconclusive', gaps: ['operational-coverage-partial', 'guide-start-minimum-unmet', 'verified-public-link-repair-unobserved'],
      })
      await prisma.siteLifecycleEvent.update({
        where: { idempotencyKey: `analysis_claimed:${initial.id}` }, data: { createdAt: at(0, 1) },
      })
      expect(await cohort()).toMatchObject({ nativeOutcomeFollowup: { guideEntries: [{ guide,
        sitesWithRetainedAssessments: 1, sitesWithVerifiedRecovery: 0, sitesWithMatureRecoveryFollowup: 0,
        sitesWithFailureAfterScheduledPass: 0,
      }] } })
    } finally {
      vi.useRealTimers()
      await prisma.audit.deleteMany({ where: { OR: [{ userId: user.id }, { id: { in: admittedIds } }] } })
      await prisma.user.deleteMany({ where: { id: user.id } })
    }
  }, 30_000)

  it('reports a public-link repair from the consented start through real handoff and verification writers', async () => {
    requireDisposableDatabase()
    const user = await prisma.user.create({ data: { email: 'public-link-study@example.test' } })
    const url = 'https://93.184.215.16/'
    const destination = url + 'book'
    const guide = 'website-online-but-not-working'
    const journeyId = `ffj_${'e'.repeat(32)}`
    const checkId = 'broken-internal-links'
    const checkVersion = CHECK_REGISTRY[checkId].version
    const inventory = { links: [{ href: '/book', text: 'Book', rel: null }], complete: true }
    let heading = 'Page not found'
    let responseStatus = 200
    let requestedDestination = destination
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      expect(input).toBe(requestedDestination)
      return new Response(`<!doctype html><html><body><h1>${heading}</h1></body></html>`, {
        status: responseStatus, headers: { 'content-type': 'text/html' },
      })
    })
    let initialId: string | undefined
    try {
      const response = await POST(new NextRequest('http://localhost/api/checks', {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: `${ANALYTICS_CONSENT_COOKIE}=granted`,
          referer: `http://localhost/new?ff_guide=${guide}&journey_id=${journeyId}` },
        body: JSON.stringify({ url, source: 'homepage', journeyId }),
      }))
      expect(response.status).toBe(201)
      const { reportId } = await response.json() as { reportId: string }
      initialId = reportId
      const initial = await prisma.audit.findUniqueOrThrow({ where: { id: initialId } })
      const sourceTask = await prisma.auditExecutionTask.create({ data: { auditId: initial.id, targetKey: 'fixture:public-link',
        status: 'COMPLETED', source: 'EXECUTION', pageUrl: url } })
      const observe = (contexts?: string[], links = inventory) => checkPublicLinks(url, links, Date.now() + 5_000,
        nativeHttpCollection().options.openDestination, contexts)
      async function completeLinkReview(audit: typeof initial, observed: Awaited<ReturnType<typeof observe>>, startedAt: Date) {
        const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'fixture:public-link',
          status: 'COMPLETED', source: 'EXECUTION', pageUrl: url } })
        const completedAt = new Date()
        const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo', applicable: true,
          passed: observed.assertions.every(assertion => assertion.passed), complete: observed.complete, pageUrl: url, assertions: observed.assertions,
          execution: { auditId: audit.id, taskId: task.id, checkVersion, checkVersions: { [checkId]: checkVersion },
            source: 'http', collectedAt: completedAt.toISOString() } })
        await prisma.$transaction(async tx => {
          await commitCheckReceipt({ audit, task, input: { pageUrl: url, position: 0, primary: true, role: 'primary', module: 'seo' },
            deadline: Date.now() + 5_000, dependencies: new Map() }, receipt, tx)
          await tx.audit.update({ where: { id: audit.id }, data: { status: 'COMPLETED', startedAt, completedAt } })
        })
        return completedAt
      }
      const broken = await observe()
      expect(broken.assertions).toMatchObject([{ passed: false, complete: true }])
      expect(broken.flags).toHaveLength(1)
      const observation = broken.flags[0]
      const startedAt = new Date()
      const flag = await prisma.flag.create({ data: { ...buildDeterministicFlagRow({
        ...observation, supportingObservations: observationsForFlag({ ...observation, source: 'DETERMINISTIC' },
          { auditId: initial.id, taskId: sourceTask.id, checkVersion, collectedAt: startedAt.toISOString() }),
      }, 0, new Map(), new Map()), auditId: initial.id } })
      await prisma.audit.update({ where: { id: initial.id }, data: { status: 'COMPLETED', startedAt, completedAt: new Date() } })
      await projectSiteAnalysis(initial.id)
      admission.claimedIds.splice(0, admission.claimedIds.length, initial.id)
      expect(await claimAnonymousAudits(user.id)).toBe(1)
      const claim = await prisma.siteLifecycleEvent.findUniqueOrThrow({ where: { idempotencyKey: `analysis_claimed:${initial.id}` } })
      const site = (await loadSiteRecord(claim.projectId!))!
      await materializeAttentionForAudit(initial.id)
      const copy = await loadSiteFlagCopyTask(site, flag.id)
      expect(copy.revision.kind).toBe('repair')
      await executeSiteCommand({ type: 'RECORD_FIX_HANDOFF', userId: user.id, flagId: flag.id, builder: 'copy',
        client: COPIED_HANDOFF_CLIENT, preparedHandoff: { siteId: site.siteId, referenceFlagId: flag.id,
          promptHash: copy.promptHash, context: copy.revision } })

      const day = 86_400_000
      // Evaluate maturity by moving only the reader's as-of time.
      const cutoff = new Date((Math.floor(claim.createdAt.getTime() / day) + 1) * day)
      const window = { since: new Date(cutoff.getTime() - 28 * day), startWindowEnd: cutoff,
        now: new Date(cutoff.getTime() + 35 * day) }
      const snapshot = () => loadDestinationStudyOperationalSnapshot(window, prisma)
      expect((await snapshot()).sites.guideEntries).toMatchObject([{ guide, sites: 1, verifiedPublicLinkRepair: 0,
        ownerAcknowledgedClipboardHandoff: 1, ownerClipboardHandoffWithIndependentResult: 0 }])

      const run = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId: site.siteId, userId: user.id,
        flagId: flag.id, idempotencyKey: 'guide-public-link-repair', changeSummary: 'Restore the original booking document' })
      if (!run.ok || !('verificationAuditId' in run) || !run.verificationAuditId) throw new Error('Repair verification not admitted')
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: run.verificationAuditId } })
      const spec = readExecutionSpec(audit.executionSpec)
      expect(spec?.verificationSourceFlagIds).toEqual([flag.id])
      const contexts = originalPublicLinkContexts(spec?.verificationSources?.flags ?? [], url)
      expect(contexts).toHaveLength(1)
      heading = 'Book a consultation'
      const rechecked = await observe(contexts)
      expect(rechecked.assertions).toMatchObject([{ passed: true, complete: true }])
      await completeLinkReview(audit, rechecked, audit.createdAt)
      expect(await prisma.auditVerificationReceipt.findFirst({ where: { auditId: audit.id, targetKey: `check:${checkId}` } }))
        .toMatchObject({ detail: { verdict: 'passed', source: 'http' } })
      expect(await reconcileImprovementVerification({ parentAuditId: initial.id, verificationAuditId: audit.id }))
        .toMatchObject([{ attemptId: run.attemptId, outcome: 'IMPROVED', comparable: true }])
      const result = await snapshot()
      expect(result.acquisition).toMatchObject({ status: 'available', fullyMature: true,
        guideEntries: [{ guide, starts: 1, analysisCompletionReceipts: 1, claimReceipts: 1,
          claimReceiptsWithCompletionReceipt: 1, processingEvidence: { receiptWithinFollowup: 1 } }] })
      expect(result.sites).toMatchObject({ status: 'available', fullyMature: true })
      expect(result.sites.guideEntries).toMatchObject([{ guide, sites: 1, verifiedPublicLinkRepair: 1, independentlyImproved: 1,
        ownerAcknowledgedClipboardHandoff: 1, ownerClipboardHandoffWithIndependentResult: 1, ownerClipboardHandoffWithVerifiedImprovement: 1,
        comparableScheduledPublicLinkRecheck: 0, publicLinkFailureAfterVerifiedRepair: 0 }])

      async function watch(key: string, href = '/book') {
        const requestedAt = new Date()
        const watchSpec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url,
          environment: 'production', checks: { [checkId]: checkVersion }, outcomes: [], verificationTarget: null }
        const audit = await prisma.audit.create({ data: { projectId: site.projectId, userId: user.id, url,
          status: 'CHECKING', createdAt: requestedAt, startedAt: requestedAt, executionSpec: watchSpec } })
        requestedDestination = new URL(href, url).href
        const observed = await observe(undefined, { ...inventory, links: [{ href, text: 'Book', rel: null }] })
        const completedAt = await completeLinkReview(audit, observed, requestedAt)
        await prisma.runRequest.create({ data: { projectId: site.projectId!, auditId: audit.id, source: 'WATCH', status: 'COMPLETED',
          environment: 'production', idempotencyKey: key, requestedAt, completedAt, executionSpec: watchSpec } })
        return audit.id
      }

      heading = 'Page not found'
      await watch('another-destination', '/other')
      responseStatus = 401
      await watch('incomplete-destination')
      expect((await snapshot()).sites.guideEntries).toMatchObject([{
        comparableScheduledPublicLinkRecheck: 0, publicLinkFailureAfterVerifiedRepair: 0,
      }])
      responseStatus = 200
      heading = 'Book a consultation'
      await watch('comparable-pass')
      expect((await snapshot()).sites.guideEntries).toMatchObject([{
        comparableScheduledPublicLinkRecheck: 1, publicLinkFailureAfterVerifiedRepair: 0,
      }])
      heading = 'Page not found'
      const recurrenceId = await watch('comparable-failure')
      const withRecurrence = await snapshot()
      expect(withRecurrence.sites.guideEntries).toMatchObject([{
        verifiedPublicLinkRepair: 1, comparableScheduledPublicLinkRecheck: 1, publicLinkFailureAfterVerifiedRepair: 1,
      }])
      const failureReceipt = await prisma.auditVerificationReceipt.findFirstOrThrow({
        where: { auditId: recurrenceId, targetKey: 'module:seo' },
      })
      const otherTask = await prisma.auditExecutionTask.create({ data: {
        auditId: recurrenceId, targetKey: 'fixture:unrelated', status: 'COMPLETED', source: 'EXECUTION', pageUrl: url,
      } })
      const readFollowup = async () => (await snapshot()).sites.guideEntries
      const comparablePassOnly = [{ verifiedPublicLinkRepair: 1, comparableScheduledPublicLinkRecheck: 1,
        publicLinkFailureAfterVerifiedRepair: 0 }]
      await prisma.auditVerificationReceipt.update({ where: { id: failureReceipt.id }, data: { taskId: otherTask.id } })
      expect(await readFollowup()).toMatchObject(comparablePassOnly)
      await prisma.auditVerificationReceipt.update({ where: { id: failureReceipt.id },
        data: { taskId: failureReceipt.taskId, createdAt: window.now } })
      expect(await readFollowup()).toMatchObject(comparablePassOnly)
      expect(transport).toHaveBeenCalledTimes(6)
      for (const privateValue of [initial.id, flag.id, user.id, site.siteId, audit.id, recurrenceId, copy.promptHash, journeyId, destination]) {
        expect(JSON.stringify(withRecurrence)).not.toContain(privateValue)
      }
    } finally {
      transport.mockRestore()
      await prisma.audit.deleteMany({ where: { OR: [{ userId: user.id }, ...(initialId ? [{ id: initialId }] : [])] } })
      await prisma.user.deleteMany({ where: { id: user.id } })
    }
  }, 30_000)
})
