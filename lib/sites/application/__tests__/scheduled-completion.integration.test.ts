import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as auditAdmission from '@/lib/audit/create-audit'
import { classifyWatchResult, notifyWatchRegression, processDueProjectWatches, retryPendingWatchNotifications } from '@/lib/audit/project-watch'
import { diffFlagsAgainstParent, getFlagDiffSummary, persistFlagDiffSummary, readReportComparisonWithRecovery } from '@/lib/audit/diff-flags'
import { FLAG_COMPARISON_TARGET } from '@/lib/audit/flag-comparison'
import { materializeAttentionForAudit } from '@/lib/improvements/occurrences'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { loadSiteHome } from '../queries'
import { countMonitoringOperations } from '../monitoring-operations'
import * as transactions from '@/lib/billing/product-transaction'
import { requestScheduledSiteRun } from '../scheduled-runs'
import { requestSiteRun } from '../run-requests'
import { ensureDefaultMonitoring } from '../default-monitoring'
import { commitScheduledRun, reconcileScheduledCompletions } from '../scheduled-completion'
import * as watchStorage from '../scheduled-watch-storage'
import { markOutcomeRunsCouldNotVerify } from '../run-reconciliation'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { setSiteOutcomeEnabled } from '../outcome-commands'
import { executeUptimeProbe } from '@/lib/uptime/service'
import { dispatchAudit } from '@/lib/audit/dispatch'
import { emailRecipientHash } from '@/lib/email/delivery-events'
import { updateOwnedSiteIdentity } from '../settings-commands'
import { performAdminExternalAction } from '@/lib/admin/external-actions'
import { resolveAdminTarget } from '@/lib/admin/targets'
import { Prisma } from '@prisma/client'
import { interruptedAnalysisWorkSql, interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'
import { assessPageResponse } from '@/lib/audit/checks/page-response'
import { serializeArtifact } from '@/lib/audit/progressive/contracts'
import { checkArtifactSchema } from '@/lib/audit/progressive/results'
import { readExecutionSpec } from '../../domain/execution-spec'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { admittedOutcomeAuthorization } from '../../domain/outcome-authorization'
import { resolveRunExecution, validateRunSelection } from '../run-selection'
import { admittedResponsibilityHash } from '../run-retry'

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: 'queued' })) }))
const provider = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture({
  resolve4: async hostname => hostname === 'example.com' || hostname.endsWith('.example.com') ? ['203.0.114.1'] : [],
  resolve6: async () => [],
}))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => queue }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: provider.send } } }))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ resolveIncludeAiForNewAudit: async () => false }))
const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('scheduled completion after cadence advancement', () => {
  let userId: string, projectId: string
  let otherOwners: string[] = []
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    otherOwners = []
    userId = 'scheduled-completion-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', emailVerified: true } })
    const site = await prisma.project.create({ data: { userId, name: 'Scheduled completion', url: 'https://example.com/',
      canonicalHost: 'example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000),
      accountChecksEnabled: false, notificationLevel: 'OFF' } })
    projectId = site.id
    queue.add.mockReset().mockResolvedValue({ id: 'queued' })
    provider.send.mockReset().mockResolvedValue({ data: { id: 'shared-watch-' + randomUUID() }, error: null })
  })
  afterEach(async () => {
    const siteId = projectId
    const ownerId = userId
    const owners = [ownerId, ...otherOwners]
    vi.useRealTimers(); vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId: ownerId } })
    await prisma.project.deleteMany({ where: { id: siteId } })
    await prisma.user.deleteMany({ where: { id: { in: owners } } })
  })
  async function admit(failures = 0, interval: 'weekly' | 'hourly' = 'weekly') {
    if (failures) await prisma.project.update({ where: { id: projectId }, data: { watchConsecutiveFailures: failures, watchLastError: 'Earlier failure' } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    expect(request.context).toMatchObject({ scheduled: { version: 1, interval, failures } })
    expect(JSON.stringify(request.context)).not.toContain('https://')
    return request
  }
  async function fail(auditId: string) {
    // Controlled terminal state exercises schedule projection only. This is not
    // invented webpage collection or a positive website conclusion.
    await prisma.audit.update({ where: { id: auditId }, data: { status: 'FAILED', completedAt: new Date() } })
    await markOutcomeRunsCouldNotVerify(auditId, 'CONTROLLED_EXECUTION_FAILURE', 'Controlled execution failure')
  }

  it.each(['first setup', 'legacy target', 'explicit binding'] as const)('freezes the availability binding during %s', async mode => {
    const root = 'https://example.com/', url = mode === 'first setup' ? root : root + 'pricing'
    if (mode !== 'first setup') await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    if (mode === 'explicit binding') await prisma.outcomeExecutionBinding.updateMany({ where: { outcome: { projectId, slug: 'page-loads' } },
      data: { config: { startUrl: root, expectedSelector: 'body', expectedText: 'Public product page' } } })
    await prisma.project.update({ where: { id: projectId }, data: { url,
      ...(mode === 'first setup' ? { watchInterval: null, watchNextRunAt: null } : {}) } })
    const command = { projectId, userId, source: 'WEB' as const, scope: 'SITE' as const, outcomeIds: [], idempotencyKey: 'freeze-default-availability' }
    let admittedDuringRetry: Awaited<ReturnType<typeof requestSiteRun>> | undefined
    if (mode === 'legacy target') {
      const prepared = await resolveRunExecution(command, validateRunSelection(command))
      const retry = { ...command, expectedResponsibilityHash: admittedResponsibilityHash(prepared.executionSpec) }
      await expect(requestSiteRun(retry)).rejects.toMatchObject({ code: 'RETRY_SCOPE_CHANGED' })
      expect(await prisma.outcomeExecutionBinding.findFirstOrThrow({ where: { outcome: { projectId, slug: 'page-loads' } } }))
        .toMatchObject({ version: 1, config: { startUrl: root } })
      expect(await prisma.runRequest.count({ where: { projectId } })).toBe(0)
      expect(queue.add).not.toHaveBeenCalled()

      // Commit a fresh Run after the retry prepares its old scope but before it locks the Site.
      const create = auditAdmission.createAndEnqueueAudit
      vi.spyOn(auditAdmission, 'createAndEnqueueAudit').mockImplementationOnce(async (...args) => {
        admittedDuringRetry = await requestSiteRun(command)
        return create(...args)
      })
      await expect(requestSiteRun(retry)).rejects.toMatchObject({ code: 'RETRY_SCOPE_CHANGED' })
    }
    const admissions = await Promise.all([admittedDuringRetry ?? requestSiteRun(command), requestSiteRun(command)])
    const admitted = admissions.find(run => !run.reused)!
    expect(admissions.find(run => run.reused)).toEqual({ ...admitted, reused: true })
    const saved = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId }, include: { audit: true, selections: true } })
    const outcome = await prisma.siteOutcome.findUniqueOrThrow({ where: { projectId_slug: { projectId, slug: 'page-loads' } }, include: { bindings: true } })
    const binding = outcome.bindings[0]
    expect(binding).toMatchObject({ version: mode === 'legacy target' ? 2 : 1,
      config: { startUrl: mode === 'explicit binding' ? root : url, expectedSelector: 'body' } })
    expect(admitted.outcomeIds).toEqual([outcome.id])
    expect(saved.legacyOutcomeId).toBe(outcome.id)
    expect(saved.selections.map(selection => selection.outcomeId)).toEqual([outcome.id])
    expect(saved.audit?.executionSpec).toEqual(saved.executionSpec)
    expect(admittedOutcomeAuthorization(saved.context, outcome.id)).toBe(outcome.authorizationRevision)
    const spec = readExecutionSpec(saved.executionSpec)!
    expect(spec.outcomes).toMatchObject([{ id: outcome.id, bindings: [{ key: binding.key, version: binding.version, config: binding.config }] }])
    expect(initialTaskPlan(spec).filter(task => task.kind === 'bindings')).toMatchObject([{ input: { outcomeId: outcome.id, bindingKey: binding.key } }])
    expect(await requestSiteRun(command)).toMatchObject({ ...admitted, reused: true })
    expect(queue.add).toHaveBeenCalledTimes(1)
    if (mode === 'first setup') expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId } })).toMatchObject({ targetUrl: url, enabled: true })
  })

  it.each(['outcome-off', 'binding-off', 'supporting-only'] as const)('keeps care scheduled without inventing execution when the remaining binding is %s', async mode => {
    const now = new Date(), sourceAt = new Date(now.getTime() - 3600_000)
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId, now))
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
    if (mode === 'outcome-off') await setSiteOutcomeEnabled({ site: (await loadSiteRecord(projectId))!, outcomeId: outcome.id, enabled: false })
    else await prisma.outcomeExecutionBinding.updateMany({ where: { outcomeId: outcome.id },
      data: mode === 'binding-off' ? { enabled: false } : { required: false } })
    // Retained completion is a saved scheduling fixture, not a fresh website observation.
    const source = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'COMPLETED',
      createdAt: sourceAt, completedAt: new Date(sourceAt.getTime() + 1000), reportCompleteness: 'FULL',
      pages: { create: { url: 'https://example.com/', normalizedUrl: 'https://example.com/', position: 0, role: 'primary', status: 'COMPLETED' } },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    await prisma.project.update({ where: { id: projectId }, data: { watchConsecutiveFailures: 2,
      watchLastError: 'The disabled binding did not finish.' } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    const current = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const renewal = new Date(sourceAt.getTime() + 7 * 86400_000 - 60_000)
    expect(current).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: renewal, watchLeaseUntil: null,
      watchConsecutiveFailures: 0, watchLastError: null, watchLastRunAt: null })
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(0)
    expect(await prisma.audit.count({ where: { projectId } })).toBe(1)
    expect(queue.add).not.toHaveBeenCalled()
    const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId } })
    expect(monitor).toMatchObject({ enabled: true, targetUrl: source.url })
    await executeUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: monitor.nextProbeAt.toISOString(), attempt: 1 }, async () => ({
      result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 10, finalUrl: source.url,
    }), { now: () => now })
    expect(await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId: monitor.id } })).toMatchObject({ result: 'ONLINE' })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchNextRunAt: renewal, watchLastRunAt: null })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(renewal.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    expect(await prisma.runRequest.findFirstOrThrow({ where: { projectId } })).toMatchObject({ executionSpec: { scope: 'SITE', outcomes: [] } })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ enabled: mode !== 'outcome-off' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source)
  })

  it.each([
    { interval: 'weekly' as const, stored: 'WEEKLY' as const, everyMinutes: null, age: 6 * 86400_000, period: 7 * 86400_000, entry: 'https://example.com/' },
    { interval: 'weekly' as const, stored: 'WEEKLY' as const, everyMinutes: null, age: 6 * 86400_000, period: 7 * 86400_000, entry: 'https://www.example.com/catalog?sort=new#/bags' },
    { interval: 'daily' as const, stored: 'DAILY' as const, everyMinutes: null, age: 20 * 3600_000, period: 86400_000, entry: 'https://example.com/catalog/' },
    { interval: 'hourly' as const, stored: 'HOURLY' as const, everyMinutes: null, age: 23.5 * 3600_000, period: 86400_000, entry: 'https://www.example.com/?locale=fr' },
    { interval: 'custom' as const, stored: 'CUSTOM' as const, everyMinutes: 4320, age: 2 * 86400_000, period: 3 * 86400_000, entry: 'https://example.com/#/catalog' },
  ])('renews retained broad evidence at its own deadline during $interval care for $entry', async ({ stored, everyMinutes, age, period, entry }) => {
    const now = new Date(), observedAt = new Date(now.getTime() - age)
    const monitoringPages = [...new Set([entry, 'https://example.com/'])]
    // This saved terminal scope exercises scheduling, not webpage collection.
    const source = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
      reportCompleteness: 'FULL', createdAt: observedAt, completedAt: new Date(observedAt.getTime() + 1000),
      pages: { create: monitoringPages.map((url, position) => ({ url, normalizedUrl: url, position, role: position ? 'linked' : 'primary', status: 'COMPLETED' })) },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: entry,
        monitoringPages,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: stored, watchEveryMinutes: everyMinutes } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const first = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
    expect(first.executionSpec).toMatchObject({ scope: 'OUTCOMES' })
    const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const renewal = new Date(observedAt.getTime() + period - 60_000)
    expect(saved.watchNextRunAt).toEqual(renewal)
    expect(first.context).toMatchObject({ scheduled: { nextRunAt: renewal.getTime() } })
    expect(saved.watchLastRunAt).toBeNull()
    await prisma.audit.update({ where: { id: first.auditId! }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: first.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(renewal.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    const next = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: first.id } } })
    expect(next.executionSpec).toMatchObject({ scope: 'SITE' })
    expect(next.executionSpec).toMatchObject({ monitoringPages: expect.arrayContaining([entry]) })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source)
    expect((await prisma.runRequest.findUniqueOrThrow({ where: { id: first.id } })).context).toEqual(first.context)
  })

  it.each(['FAILED', 'EXHAUSTED'] as const)('does not hide a newer %s Site analysis on another entry URL behind older healthy evidence', async failure => {
    const entry = 'https://www.example.com/catalog?sort=new#/bags'
    const older = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'COMPLETED',
      createdAt: new Date(Date.now() - 3600_000), completedAt: new Date(Date.now() - 3599_000),
      pages: { create: { url: 'https://example.com/', normalizedUrl: 'https://example.com/', position: 0, role: 'primary', status: 'COMPLETED' } },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    const admitted = await requestSiteRun({ projectId, userId, url: entry, scope: 'SITE', outcomeIds: [], idempotencyKey: 'other-entry-failed', source: 'WEB' })
    if (failure === 'FAILED') await fail(admitted.auditId!)
    else {
      await prisma.auditExecutionTask.create({ data: { auditId: admitted.auditId!, targetKey: 'task:browser', source: 'EXECUTION',
        workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', workErrorCode: 'RECOVERY_EXHAUSTED' } })
      await prisma.audit.update({ where: { id: admitted.auditId! }, data: { status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
      await prisma.runRequest.update({ where: { id: admitted.runId }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    }
    const interrupted = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const watch = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
    expect(watch.executionSpec).toMatchObject({ scope: 'SITE', targetUrl: 'https://example.com/', monitoringPages: expect.arrayContaining([entry]) })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: older.id } })).toEqual(older)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: interrupted.id } })).toEqual(interrupted)
  })

  it.each(['https://example.com/', 'http://example.com:8080/', 'https://example.com/?locale=fr', 'https://example.com/#/catalog'])(
    'requires broad care when the latest Site scope did not include the current target %s', async target => {
      const entry = 'https://www.example.com/catalog?sort=new#/bags'
      const older = await prisma.audit.create({ data: { projectId, userId, url: target, status: 'COMPLETED',
        createdAt: new Date(Date.now() - 3600_000), completedAt: new Date(Date.now() - 3599_000),
        pages: { create: { url: target, normalizedUrl: target, position: 0, role: 'primary', status: 'COMPLETED' } },
        executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: target,
          environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
      const latest = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
        createdAt: new Date(Date.now() - 60_000), completedAt: new Date(Date.now() - 59_000),
        pages: { create: { url: entry, normalizedUrl: entry, position: 0, role: 'primary', status: 'COMPLETED' } },
        executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: entry,
          monitoringPages: [entry], environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
      await prisma.project.update({ where: { id: projectId }, data: { url: target } })
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
      const watch = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
      expect(watch.executionSpec).toMatchObject({ scope: 'SITE', targetUrl: target, monitoringPages: expect.arrayContaining([target, entry]) })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: older.id } })).toEqual(older)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: latest.id } })).toEqual(latest)
    })

  it('renews broad care for retained responsibilities absent from the latest completed scope', async () => {
    const retainedEntry = 'https://example.com/catalog?locale=fr#/bags', unobserved = 'https://example.com/help/shipping/'
    const older = await prisma.audit.create({ data: { userId, url: retainedEntry, status: 'FAILED',
      createdAt: new Date(Date.now() - 2 * 3600_000), completedAt: new Date(Date.now() - 2 * 3600_000 + 1000),
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: retainedEntry,
        monitoringPages: [retainedEntry, unobserved], environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    const latest = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'COMPLETED',
      createdAt: new Date(Date.now() - 3600_000), completedAt: new Date(Date.now() - 3599_000),
      pages: { create: { url: 'https://example.com/', normalizedUrl: 'https://example.com/', position: 0, role: 'primary', status: 'COMPLETED' } },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        monitoringPages: ['https://example.com/'], environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    // A claim can retain an older analysis after the latest broad collection.
    // Its admitted but unobserved page remains owed. This fixture starts after
    // that identity transfer and exercises actual scheduling and admission.
    const retained = await prisma.audit.update({ where: { id: older.id }, data: { projectId } })
    expect(await prisma.auditPage.count({ where: { auditId: retained.id } })).toBe(0)
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const watch = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
    expect(watch.executionSpec).toMatchObject({ scope: 'SITE', monitoringPages: expect.arrayContaining(['https://example.com/', retainedEntry, unobserved]) })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: retained.id } })).toEqual(retained)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: latest.id } })).toEqual(latest)
  })

  it.each([
    ['missing receipt', 'SITE'], ['rate limited', 'SITE'], ['different query', 'SITE'], ['different Run', 'SITE'],
    ['mismatched Site intent', 'SITE'], ['different task', 'SITE'], ['confirmed failure', 'OUTCOMES'], ['successful response', 'OUTCOMES'],
    ['retained receipt crowding', 'OUTCOMES'], ['retained receipts without peer proof', 'SITE'],
  ] as const)('selects Watch scope from recorded public response evidence (%s)', async (scenario, scope) => {
    const entry = 'https://example.com/', peer = entry + 'pricing?plan=team'
    const createdAt = new Date(Date.now() - 120_000), completedAt = new Date(createdAt.getTime() + 1000)
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: entry,
      monitoringPages: [entry, peer], environment: 'production', checks: { 'page-http-error': 1, 'page-redirect-loop': 1 },
      outcomes: [], verificationTarget: null }
    const source = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
      createdAt, completedAt, reportCompleteness: 'PARTIAL', executionSpec: scenario === 'mismatched Site intent'
        ? { ...spec, targetUrl: peer, monitoringPages: [peer, entry] } : spec,
      pages: { create: [entry, peer].map((url, position) => ({ url, normalizedUrl: url, position,
        role: position ? 'linked' : 'primary', status: 'COMPLETED' })) } } })
    const observed = scenario === 'different query' ? peer.replace('team', 'solo') : peer
    const crowded = scenario === 'retained receipt crowding' || scenario === 'retained receipts without peer proof'
    const observations = [{ url: entry, status: 200 }, ...(scenario === 'missing receipt' || scenario === 'retained receipts without peer proof' ? []
      : [{ url: observed, status: scenario === 'rate limited' ? 429 : scenario === 'confirmed failure' ? 404 : 200 }])]
    if (crowded) await prisma.auditVerificationReceipt.createMany({ data: Array.from({ length: 60 }, (_, index) => ({
      id: `early-${source.id}-${String(index).padStart(3, '0')}`, auditId: source.id,
      targetKey: 'module:page-response', scopeKey: 'retained:' + index, pageUrl: index === 0 ? entry : peer,
      status: 'COMPLETED', source: 'DETERMINISTIC', detail: {},
    })) })
    const unrelated = scenario === 'different task' ? await prisma.auditExecutionTask.create({ data: {
      auditId: source.id, targetKey: 'task:unrelated', pageUrl: peer, source: 'SYSTEM', status: 'COMPLETED', workKind: 'check',
    } }) : null
    await prisma.auditVerificationReceipt.createMany({ data: observations.map(({ url, status }) => {
      const checked = assessPageResponse(url, { url, finalUrl: url, status, headers: { 'content-type': 'text/html' },
        body: '<title>Public product page</title><h1>Public product page</h1>', complete: true, reason: null,
        redirects: [], collectedAt: createdAt.toISOString() })
      return { ...(crowded ? { id: 'late-' + source.id + '-' + url } : {}),
        auditId: source.id, pageUrl: url, targetKey: 'module:page-response', scopeKey: 'page:' + url,
        ...(unrelated && url === peer ? { taskId: unrelated.id } : {}),
        status: 'COMPLETED', source: 'DETERMINISTIC', detail: { kind: 'site-module-check', version: 1, module: 'page-response',
          pageUrl: url, applicable: true, passed: checked.assertions[0].passed, complete: checked.complete, assertions: checked.assertions,
          execution: { auditId: scenario === 'different Run' && url === peer ? 'older-run' : source.id,
            taskId: 'page-response:' + url, source: 'http', checkVersion: 1, collectedAt: createdAt.toISOString() } } }
    }) })
    const watch = await admit()
    expect(watch.executionSpec).toMatchObject(scope === 'SITE' ? { scope, monitoringPages: [entry, peer] } : { scope })
    if (scope === 'OUTCOMES') expect(watch.context).toMatchObject({ scheduled: { nextRunAt: createdAt.getTime() + 7 * 86400_000 - 60_000 } })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source)
  })

  it('retries a failed broad attempt instead of letting an older completed source narrow its recovery', async () => {
    const first = await admit()
    expect(first.executionSpec).toMatchObject({ scope: 'SITE' })
    const older = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'COMPLETED',
      createdAt: new Date(Date.now() - 3600_000), completedAt: new Date(Date.now() - 3599_000), reportCompleteness: 'FULL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    await fail(first.auditId!)
    const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(saved.watchNextRunAt!.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    const retry = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: first.id } } })
    expect(retry.executionSpec).toMatchObject({ scope: 'SITE' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: older.id } })).toEqual(older)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: first.auditId! } })).toMatchObject({ status: 'FAILED' })
  })

  it.each([
    ['entry browser gap', 'SITE'], ['retained browser gap', 'SITE'], ['missing retained page', 'SITE'], ['missing discovered page', 'SITE'],
    ['unfinished retained page', 'SITE'], ['undated completion', 'SITE'], ['provider gap', 'OUTCOMES'],
  ] as const)('selects the Watch scope after a recent %s', async (scenario, scope) => {
    const now = Date.now(), entry = 'https://example.com/', peer = entry + 'pricing'
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: entry,
      monitoringPages: scenario === 'missing discovered page' ? [entry] : [entry, peer],
      environment: 'production', checks: {}, outcomes: [], verificationTarget: null }
    const older = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
      createdAt: new Date(now - 3600_000), completedAt: new Date(now - 3599_000), reportCompleteness: 'FULL', executionSpec: spec } })
    const latest = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
      createdAt: new Date(now - 120_000), completedAt: scenario === 'undated completion' ? null : new Date(now - 119_000),
      reportCompleteness: 'PARTIAL', executionSpec: spec } })
    await prisma.auditPage.createMany({ data: [entry, peer].flatMap((url, position) => {
      if (position > 0 && (scenario === 'missing retained page' || scenario === 'missing discovered page')) return []
      const unavailable = scenario === (position === 0 ? 'entry browser gap' : 'retained browser gap')
      return [{ auditId: latest.id, url, normalizedUrl: url, position, role: position === 0 ? 'primary' : 'linked',
        status: unavailable && position > 0 ? 'FAILED' : position > 0 && scenario === 'unfinished retained page' ? 'CHECKING' : 'COMPLETED',
        completeness: 'PARTIAL', ...(unavailable ? { failureCode: 'BROWSER_SCOPE_UNAVAILABLE' } : {}) }]
    }) })
    if (scenario === 'missing discovered page') await prisma.auditExecutionTask.create({ data: {
      auditId: latest.id, targetKey: 'task:p1:browser', pageUrl: peer, source: 'EXECUTION',
      workKind: 'browser', workState: 'COMPLETED', status: 'NOT_APPLICABLE',
    } })
    if (scenario === 'provider gap') await prisma.auditExecutionTask.create({ data: {
      auditId: latest.id, targetKey: 'task:p0:pagespeed-desktop', source: 'EXECUTION',
      workKind: 'pagespeed', workState: 'EXHAUSTED', status: 'FAILED', workErrorCode: 'PROVIDER_UNAVAILABLE',
    } })
    const watch = await admit()
    expect(watch.executionSpec).toMatchObject(scope === 'SITE' ? { scope, monitoringPages: [entry, peer] } : { scope })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: older.id } })).toEqual(older)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: latest.id } })).toEqual(latest)
  })

  it.each(['write-failure', 'unreadable-context'] as const)('rotates a full %s cohort so independent Sites receive completion recovery', async mode => {
    const now = new Date(Date.now() + 60_000), clock = { now: () => now }
    const sites = [projectId]
    for (const host of ['second', 'following']) {
      const owner = 'fair-completion-' + randomUUID(); otherOwners.push(owner)
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test', emailVerified: true } })
      sites.push((await prisma.project.create({ data: { userId: owner, name: host, canonicalHost: 'example.com',
        url: 'https://example.com/', watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000),
        accountChecksEnabled: false, notificationLevel: 'OFF' } })).id)
    }
    const rows = []
    const originals = new Map<string, Prisma.JsonValue>()
    for (const [index, siteId] of sites.entries()) {
      expect(await processDueProjectWatches(1, { onlyProjectId: siteId })).toMatchObject({ enqueued: 1, errors: 0 })
      const request = await prisma.runRequest.findFirstOrThrow({ where: { projectId: siteId, source: 'WATCH' } })
      originals.set(request.id, request.context)
      // Model interruption after terminal status commits, before the normal
      // completion callback can project the Site clock. No collection is claimed.
      await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'FAILED', completedAt: new Date() } })
      await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'FAILED', completedAt: new Date(), leaseUntil: null } })
      const context = mode === 'unreadable-context' && index < 2
        ? { scheduled: { ...(request.context as { scheduled: object }).scheduled, scheduledAt: 'unreadable historical time' } } : request.context!
      rows.push(await prisma.runRequest.update({ where: { id: request.id }, data: { context: context as Prisma.InputJsonValue,
        updatedAt: now } }))
    }
    const before = await prisma.project.findMany({ where: { id: { in: sites } } })
    const rejected = new Set(sites.slice(0, 2)), update = watchStorage.updateUnlockedWatchProject
    const projection = vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockImplementation((...args) => {
      if (mode === 'write-failure' && rejected.has(args[0])) throw new Error('Controlled persistent completion projection failure')
      return update(...args)
    })
    try {
      for (let batch = 0; batch < 3; batch++) await reconcileScheduledCompletions(1, clock)
      const following = await prisma.project.findUniqueOrThrow({ where: { id: sites[2] } })
      expect(following).toMatchObject({ watchConsecutiveFailures: 1,
        watchLastError: 'The scheduled check did not finish. FixFlags will try again.', watchInterval: 'WEEKLY' })
      expect(following.watchNextRunAt!.getTime()).toBeLessThan(now.getTime() + 16 * 60_000)
      for (const siteId of sites.slice(0, 2)) expect(await prisma.project.findUniqueOrThrow({ where: { id: siteId } }))
        .toEqual(before.find(site => site.id === siteId))
      for (const row of rows) {
        const current = await prisma.runRequest.findUniqueOrThrow({ where: { id: row.id } })
        expect(current).toEqual({ ...row, updatedAt: expect.any(Date) })
        expect(current.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime())
      }
      rejected.clear()
      if (mode === 'unreadable-context') for (const row of rows.slice(0, 2)) await prisma.runRequest.update({
        where: { id: row.id }, data: { context: originals.get(row.id) as Prisma.InputJsonValue },
      })
      expect(await reconcileScheduledCompletions(1, clock)).toBe(1)
      expect(await reconcileScheduledCompletions(1, clock)).toBe(1)
      expect(await reconcileScheduledCompletions(1, clock)).toBe(0)
      expect(await prisma.project.count({ where: { id: { in: sites }, watchConsecutiveFailures: 1 } })).toBe(3)
      expect(await prisma.audit.count({ where: { projectId: { in: sites } } })).toBe(3)
    } finally { projection.mockRestore() }
  })

  it.each(['SITE', 'OUTCOMES'] as const)('retries exhausted %s work even when the containing execution completed', async scope => {
    // An older complete receipt must not hide the newest interruption when the
    // next admission decides whether broad collection is still needed.
    const createOlder = () => prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/', status: 'COMPLETED',
      reportCompleteness: 'FULL', createdAt: new Date(Date.now() - 60 * 60_000), completedAt: new Date(Date.now() - 59 * 60_000),
      pages: { create: { url: 'https://example.com/', normalizedUrl: 'https://example.com/', position: 0, role: 'primary', status: 'COMPLETED' } },
      executionSpec: { version: 1, scope: 'SITE', targetUrl: 'https://example.com/', environment: 'production',
        outcomes: [], checks: {}, verificationTarget: null } } })
    let older = scope === 'OUTCOMES' ? await createOlder() : undefined
    const request = await admit()
    expect(request.executionSpec).toMatchObject({ scope })
    older ??= await createOlder()
    const kind = scope === 'SITE' ? 'browser' : 'bindings'
    await prisma.auditExecutionTask.create({ data: { auditId: request.auditId!, targetKey: 'task:p0:' + kind, source: 'EXECUTION',
      workKind: kind, workState: 'EXHAUSTED', status: 'FAILED', workErrorCode: 'RECOVERY_EXHAUSTED' } })
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(1)
    expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(site.watchNextRunAt!.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    const next = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: request.id } } })
    expect(next.executionSpec).toMatchObject({ scope })
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: request.auditId! } }))
      .toMatchObject({ workState: 'EXHAUSTED', status: 'FAILED' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: older.id } })).toEqual(older)
  })

  it.each([
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:browser', interrupted: true },
    { workKind: null, workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:legacy', interrupted: true },
    { workKind: 'prescription', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:prescription', interrupted: false },
    { workKind: 'pagespeed', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:pagespeed', interrupted: false },
    { workKind: 'google', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:google', interrupted: false },
    { workKind: 'judge', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'task:judge', interrupted: false },
    { workKind: 'browser', workState: 'BLOCKED', status: 'FAILED', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'COMPLETED', status: 'COMPLETED', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'NOT_APPLICABLE', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'module:browser', interrupted: false },
  ] as const)('preserves interruption meaning across SQL selection and conditional settlement: %j', async ({ interrupted, ...task }) => {
    const request = await admit(2)
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt
    if (task.targetKey.startsWith('task:'))
      await prisma.auditExecutionTask.create({ data: { ...task, auditId: request.auditId!, source: 'EXECUTION' } })
    else
      await prisma.auditVerificationReceipt.create({ data: { auditId: request.auditId!, targetKey: task.targetKey, status: task.status, source: 'EXECUTION' } })
    const [sql] = await prisma.$queryRaw<Array<{ interrupted: boolean }>>(Prisma.sql`SELECT ${interruptedAnalysisWorkSql} AS interrupted
      FROM audits "source" WHERE "source".id = ${request.auditId!}`)
    expect(sql.interrupted).toBe(interrupted)
    expect(Boolean(await prisma.auditVerifierExecution.count({ where: { auditId: request.auditId!, ...interruptedAnalysisWorkWhere } }))).toBe(interrupted)
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(interrupted ? 3 : 0)
    if (!interrupted) expect(site.watchNextRunAt).toEqual(due)
    else expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 361 * 60_000)
  })

  it.each(['COMPLETED', 'FAILED'] as const)('retries missing browser evidence on a %s page without changing the saved result', async status => {
    const request = await admit()
    const completedAt = new Date(), url = 'https://example.com/'
    const page = await prisma.auditPage.create({ data: { auditId: request.auditId!, url, normalizedUrl: url, position: 0, role: 'primary',
      status, completeness: 'PARTIAL', failureCode: 'BROWSER_SCOPE_UNAVAILABLE' } })
    const source = await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt, reportCompleteness: 'PARTIAL' } })
    const receipt = await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt, leaseUntil: null } })
    expect(await prisma.auditExecutionTask.count({ where: { auditId: source.id, ...interruptedAnalysisWorkWhere } })).toBe(0)
    expect(await reconcileScheduledCompletions()).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({
      watchConsecutiveFailures: 1, watchNextRunAt: new Date(completedAt.getTime() + 15 * 60_000), watchLeaseUntil: null,
    })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source)
    expect(await prisma.auditPage.findUniqueOrThrow({ where: { id: page.id } })).toEqual(page)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: receipt.status, context: receipt.context })
  })

  it('backs off after a committed page response interruption without changing the completed Run', async () => {
    const request = await admit()
    const url = 'https://example.com/', completedAt = new Date()
    const audit = await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt, reportCompleteness: 'PARTIAL' } })
    const run = await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt, leaseUntil: null } })
    function recordResponse(auditId: string, collectedAt: string, interrupted: boolean) {
      const checked = assessPageResponse(url, { url, finalUrl: url, status: 200, headers: { 'content-type': 'text/html' },
        body: interrupted ? '<title>Interrupted</title>' : '<title>Available page</title><h1>Available page</h1>',
        complete: !interrupted, reason: interrupted ? 'response_body_unavailable' : null, redirects: [], collectedAt })
      const taskId = randomUUID()
      return prisma.auditExecutionTask.create({ data: { id: taskId, auditId, targetKey: 'task:p0:page-response',
        pageUrl: url, source: 'EXECUTION', workKind: 'check', workState: 'COMPLETED', status: 'COMPLETED',
        workResult: serializeArtifact('check', checkArtifactSchema.parse({ flags: checked.flags,
          ...(checked.interrupted ? { pageResponseInterrupted: true } : {}),
          receipt: { kind: 'site-module-check', version: 1, module: 'page-response', pageUrl: url, applicable: true,
            complete: checked.complete, passed: checked.assertions[0].passed, assertions: checked.assertions,
            execution: { auditId, taskId, checkVersion: 1, source: 'http', collectedAt } } })) } })
    }
    const pageTask = await recordResponse(audit.id, completedAt.toISOString(), true)
    expect(await prisma.auditExecutionTask.count({ where: { auditId: audit.id, ...interruptedAnalysisWorkWhere } })).toBe(0)
    expect(await reconcileScheduledCompletions(1, undefined, { runId: run.id })).toBe(1)
    expect(await reconcileScheduledCompletions(1, undefined, { runId: run.id })).toBe(0)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 1,
      watchNextRunAt: new Date(completedAt.getTime() + 15 * 60_000) })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: pageTask.id } })).toEqual(pageTask)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: run.status, context: run.context })

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(completedAt.getTime() + 15 * 60_000 + 1000)
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const retry = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: run.id } } })
    expect(retry).toMatchObject({ executionSpec: { scope: 'SITE' }, context: { scheduled: { failures: 1 } } })
    const recoveredAt = new Date()
    await recordResponse(retry.auditId!, recoveredAt.toISOString(), false)
    await prisma.audit.update({ where: { id: retry.auditId! }, data: { status: 'COMPLETED', completedAt: recoveredAt } })
    await prisma.runRequest.update({ where: { id: retry.id }, data: { status: 'COMPLETED', completedAt: recoveredAt, leaseUntil: null } })
    expect(await reconcileScheduledCompletions(1, undefined, { runId: retry.id })).toBe(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 0, watchLastError: null })
  })

  it.each(['pause', 'cadence', 'target', 'owner', 'suspend', 'remove', 'attempt', 'due', 'lease', 'failure-count'] as const)(
    'preserves a newer %s decision when an earlier scheduled execution fails', async change => {
      const request = await admit()
      const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      if (change === 'owner') {
        const next = 'next-' + randomUUID(); otherOwners.push(next)
        await prisma.user.create({ data: { id: next, email: next + '@example.test' } })
        await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
      } else if (change === 'suspend') await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
      else await prisma.project.update({ where: { id: projectId }, data: {
        ...(change === 'pause' ? { watchNextRunAt: null, watchLastError: 'Paused' } : {}),
        ...(change === 'cadence' ? { watchInterval: 'DAILY' } : {}),
        ...(change === 'target' ? { url: 'http://example.com:8080/' } : {}),
        ...(change === 'remove' ? { deletedAt: new Date() } : {}),
        ...(change === 'attempt' ? { watchLastAttemptAt: new Date(site.watchLastAttemptAt!.getTime() + 1) } : {}),
        ...(change === 'due' ? { watchNextRunAt: new Date(site.watchNextRunAt!.getTime() + 1) } : {}),
        ...(change === 'lease' ? { watchLeaseUntil: new Date(Date.now() + 600_000) } : {}),
        ...(change === 'failure-count' ? { watchConsecutiveFailures: 1 } : {}),
      } })
      const edited = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      await fail(request.auditId!)
      expect(await reconcileScheduledCompletions(20)).toBe(0)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(edited)
    })

  it('preserves a target change committed between recovery selection and its guarded write', async () => {
    const request = await admit()
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const target = 'http://example.com:8080/changed'
    const update = watchStorage.updateUnlockedWatchProject
    const write = vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockImplementationOnce(async (...args) => {
      await prisma.project.update({ where: { id: projectId }, data: { url: target } })
      return update(...args)
    })
    try {
      await fail(request.auditId!)
      expect(write).toHaveBeenCalledTimes(1)
    } finally { write.mockRestore() }
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ url: target,
      watchNextRunAt: before.watchNextRunAt, watchConsecutiveFailures: 0, watchLastError: null })
    expect(await reconcileScheduledCompletions()).toBe(0)
  })

  it('recovers an interrupted completion once when workers reconcile concurrently', async () => {
    const request = await admit()
    const write = vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockRejectedValueOnce(new Error('Controlled completion write interruption'))
    try { await fail(request.auditId!) } finally { write.mockRestore() }
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchConsecutiveFailures).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED' })
    const results = await Promise.all([reconcileScheduledCompletions(), reconcileScheduledCompletions()])
    // Short competing locks can defer both workers to the next sweep.
    expect(results.reduce((sum, count) => sum + count, await reconcileScheduledCompletions())).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(1)
    expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
  })

  it.each(['owner transfer', 'session revoked'] as const)('preserves the Site clock when a completion operation loses scope after %s', async change => {
    const request = await admit()
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'FAILED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'FAILED', leaseUntil: null } })
    const actorId = 'completion-operator-' + randomUUID(), sessionId = randomUUID()
    otherOwners.push(actorId)
    await prisma.user.create({ data: { id: actorId, email: actorId + '@example.test', role: 'admin' } })
    await prisma.session.create({ data: { id: sessionId, userId: actorId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
    const operation = await prisma.adminOperation.create({ data: { actorId, actorSessionId: sessionId, actorAuthenticatedAt: new Date(),
      action: 'SITE_RECONCILE', targetType: 'SITE', targetId: projectId, ownerId: userId, reason: 'Controlled completion authority',
      input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(Date.now() + 60_000),
      status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(Date.now() + 60_000) } })
    let owner = userId
    if (change === 'owner transfer') {
      owner = 'completion-replacement-' + randomUUID()
      otherOwners.push(owner)
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
      const select = watchStorage.selectScheduledCompletionCandidates
      vi.spyOn(watchStorage, 'selectScheduledCompletionCandidates').mockImplementationOnce(async (...args) => {
        await prisma.$transaction([
          prisma.project.update({ where: { id: projectId }, data: { userId: owner } }),
          prisma.audit.update({ where: { id: request.auditId! }, data: { userId: owner } }),
        ])
        return select(...args)
      })
    } else {
      const update = watchStorage.updateUnlockedWatchProject
      vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockImplementationOnce(async (...args) => {
        await prisma.session.delete({ where: { id: sessionId } })
        return update(...args)
      })
    }
    try {
      const tick = processDueProjectWatches(1, { onlyProjectId: projectId,
        operator: { kind: 'admin', actorId, operationId: operation.id, executionToken: operation.executionToken! } })
      if (change === 'owner transfer') await expect(tick).resolves.toEqual({ processed: 0, enqueued: 0, errors: 0 })
      else await expect(tick).rejects.toMatchObject({ code: 'ADMIN_ACCESS_REVOKED' })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ userId: owner,
        watchLastAttemptAt: before.watchLastAttemptAt, watchNextRunAt: before.watchNextRunAt, watchConsecutiveFailures: 0 })
      expect(await reconcileScheduledCompletions(1)).toBe(1)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 1 })
    } finally { await prisma.adminOperation.delete({ where: { id: operation.id } }) }
  })

  it.each([
    ['site', 'before selection'], ['request', 'before selection'], ['site', 'after selection'], ['request', 'after selection'],
  ] as const)('keeps completion and admission moving when the oldest %s row is locked %s', async (row, timing) => {
    const now = new Date()
    async function leaveFailedCompletion(request: Awaited<ReturnType<typeof admit>>, updatedAt: Date) {
      await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'FAILED', completedAt: new Date() } })
      await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'FAILED', leaseUntil: null, updatedAt } })
    }
    async function createDueSite(name: string) {
      const owner = 'completion-lock-' + randomUUID()
      otherOwners.push(owner)
      await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
      return prisma.project.create({ data: { userId: owner, name, url: 'https://example.com/', canonicalHost: 'example.com',
        watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000), notificationLevel: 'OFF' } })
    }
    const first = await admit()
    const next = await createDueSite('Next completion')
    expect(await processDueProjectWatches(1, { onlyProjectId: next.id })).toMatchObject({ enqueued: 1 })
    const second = await prisma.runRequest.findFirstOrThrow({ where: { projectId: next.id, source: 'WATCH' } })
    await leaveFailedCompletion(first, new Date(now.getTime() - 1000))
    await leaveFailedCompletion(second, now)
    const due = await createDueSite('Independent due Site')
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

    let release!: () => void, acquired!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { acquired = resolve })
    let holder: Promise<void> | undefined
    async function holdCompletionRow() {
      holder = prisma.$transaction(async tx => {
        if (row === 'site') await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`
        else await tx.$queryRaw`SELECT id FROM run_requests WHERE id = ${first.id} FOR UPDATE`
        acquired()
        await released
      }, { timeout: 10_000 })
      await locked
    }
    if (timing === 'before selection') await holdCompletionRow()
    else {
      const select = watchStorage.selectScheduledCompletionCandidates
      vi.spyOn(watchStorage, 'selectScheduledCompletionCandidates').mockImplementationOnce(async (...args) => {
        const rows = await select(...args)
        await holdCompletionRow()
        return rows
      })
    }
    const sweep = processDueProjectWatches(timing === 'before selection' ? 1 : 2)
    try {
      await vi.waitFor(async () => {
        expect(await prisma.runRequest.count({ where: { projectId: due.id, source: 'WATCH' } })).toBe(1)
      }, { timeout: 1500, interval: 20 })
      expect(await sweep).toEqual({ processed: 1, enqueued: 1, errors: 0 })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(before)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({ watchConsecutiveFailures: 1 })
    } finally { release(); await holder; await sweep }
    expect(await reconcileScheduledCompletions(1)).toBe(1)
    expect(await reconcileScheduledCompletions(1)).toBe(0)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 1 })
  })

  it('admits an independent Site during stalled completion and uses spare capacity after recovery', async () => {
    const request = await admit(2)
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const completedAt = new Date()
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'FAILED', completedAt } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'FAILED', completedAt, leaseUntil: null } })
    const owner = 'independent-watch-' + randomUUID()
    otherOwners.push(owner)
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    const independent = await prisma.project.create({ data: { userId: owner, name: 'Independent due Site',
      url: 'https://example.com/', canonicalHost: 'example.com', watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(completedAt.getTime() - 60_000), notificationLevel: 'OFF' } })

    const record = watchStorage.recordCompletionAttempt
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const completion = vi.spyOn(watchStorage, 'recordCompletionAttempt').mockImplementation(async (...args) => {
      if (args[0].id === request.id) await held
      return record(...args)
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(before.watchNextRunAt!.getTime() + 1000))
    const sweep = processDueProjectWatches(2)
    try {
      await vi.waitFor(async () => {
        expect(completion).toHaveBeenCalledWith(expect.objectContaining({ id: request.id }), expect.any(Object), undefined)
        expect(await prisma.runRequest.count({ where: { projectId: independent.id, source: 'WATCH' } })).toBe(1)
      }, { timeout: 2500 })
      expect(await prisma.runRequest.count({ where: { projectId, source: 'WATCH' } })).toBe(1)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(before)
      release()
      await expect(sweep).resolves.toEqual({ processed: 2, enqueued: 2, errors: 0 })
      expect(await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: request.id }, source: 'WATCH' } }))
        .toMatchObject({ context: { scheduled: { failures: 3 } } })
      expect(await prisma.runRequest.count({ where: { projectId: independent.id, source: 'WATCH' } })).toBe(1)
    } finally {
      release()
      await sweep
      vi.useRealTimers()
    }
  })

  it('retains an execution failure streak until a matching run actually completes', async () => {
    const request = await admit(2)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchConsecutiveFailures).toBe(2)
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 0, watchLastError: null })
  })

  it.each(['locked receipt', 'receipt appears after selection', 'still running', 'completion backlog', 'invalid receipt'] as const)(
    'preserves the predecessor and advances due care correctly: %s', async scenario => {
      await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
      await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'HOURLY' } })
      const request = await admit(2, 'hourly')
      const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      const now = new Date(before.watchNextRunAt!.getTime() + 1000)
      const markTerminal = async (run = request, updatedAt = now) => {
        await prisma.audit.update({ where: { id: run.auditId! }, data: { status: 'FAILED', completedAt: now } })
        await prisma.runRequest.update({ where: { id: run.id }, data: { status: 'FAILED', leaseUntil: null, updatedAt } })
      }
      async function addDueSite(name: string) {
        const owner = 'predecessor-' + randomUUID()
        otherOwners.push(owner)
        await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
        return prisma.project.create({ data: { userId: owner, name, url: 'https://example.com/', canonicalHost: 'example.com',
          watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000), notificationLevel: 'OFF' } })
      }
      let independentId: string | undefined
      if (scenario === 'completion backlog') {
        const earlier = await addDueSite('Older completion')
        expect(await processDueProjectWatches(1, { onlyProjectId: earlier.id })).toMatchObject({ enqueued: 1 })
        await markTerminal(await prisma.runRequest.findFirstOrThrow({ where: { projectId: earlier.id, source: 'WATCH' } }), new Date(now.getTime() - 1000))
        const independent = await addDueSite('Independent admission')
        independentId = independent.id
        // Put the blocked Site first by attempt order to exercise the limit.
        await prisma.project.update({ where: { id: independent.id }, data: { watchLastAttemptAt: new Date(now.getTime() - 1000) } })
      }
      if (scenario !== 'still running') await markTerminal()
      if (scenario === 'invalid receipt' || scenario === 'receipt appears after selection') {
        const scheduled = (request.context as { scheduled: Prisma.JsonObject }).scheduled
        await prisma.runRequest.update({ where: { id: request.id }, data: { context: { scheduled: { ...scheduled, scheduledAt: 'invalid historical value' } } } })
      }
      if (scenario === 'receipt appears after selection') {
        const select = watchStorage.selectDueWatchProjects
        vi.spyOn(watchStorage, 'selectDueWatchProjects').mockImplementationOnce(async (...args) => {
          const rows = await select(...args)
          expect(rows.map(row => row.id)).toContain(projectId)
          await prisma.runRequest.update({ where: { id: request.id }, data: { context: request.context as Prisma.InputJsonValue } })
          return rows
        })
      }
      let release!: () => void, acquired!: () => void
      const released = new Promise<void>(resolve => { release = resolve })
      const locked = new Promise<void>(resolve => { acquired = resolve })
      const holder = scenario === 'locked receipt' ? prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM run_requests WHERE id = ${request.id} FOR UPDATE`
        acquired()
        await released
      }, { timeout: 10_000 }) : undefined
      if (holder) await locked
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(now)
      try {
        const tick = () => processDueProjectWatches(1, { onlyProjectId: projectId })
        if (scenario === 'invalid receipt') {
          expect(await tick()).toEqual({ processed: 1, enqueued: 1, errors: 0 })
          return
        }
        if (independentId) {
          expect(await processDueProjectWatches(1)).toEqual({ processed: 1, enqueued: 1, errors: 0 })
          expect(await prisma.runRequest.count({ where: { projectId: independentId, source: 'WATCH' } })).toBe(1)
        } else expect(await tick()).toEqual({ processed: 0, enqueued: 0, errors: 0 })
        expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(before)
        expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
        release(); await holder
        if (scenario === 'still running') await markTerminal()
        expect(await tick()).toEqual({ processed: 1, enqueued: 1, errors: 0 })
        expect(await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: request.id } } }))
          .toMatchObject({ context: { scheduled: { failures: 3 } } })
      } finally { release(); await holder; vi.useRealTimers() }
    })

  it('bounds completion recovery independently of retained scheduled request history', async () => {
    const siteId = projectId, ownerId = userId
    const request = await admit(2)
    const scheduled = (request.context as { scheduled: Record<string, Prisma.JsonValue> }).scheduled
    const history = Array.from({ length: 10_000 }, (_, index) => {
      const attemptedAt = Number(scheduled.attemptedAt) - (index + 1) * 60_000
      return { id: randomUUID(), attemptedAt, completedAt: new Date(attemptedAt + 1000) }
    })
    // Retained terminal history models query cost. No browser, natural calendar
    // execution or real website failures are claimed by these synthetic rows.
    await prisma.audit.createMany({ data: history.map(row => ({ id: row.id, projectId: siteId, userId: ownerId, url: 'https://example.com/',
      status: 'FAILED' as const, createdAt: new Date(row.attemptedAt), completedAt: row.completedAt,
      recheckTrigger: 'WATCH' as const, executionSpec: request.executionSpec! })) })
    await prisma.runRequest.createMany({ data: history.map(row => ({ projectId: siteId, auditId: row.id, source: 'WATCH',
      idempotencyKey: 'retained:' + row.id, status: 'FAILED' as const, completedAt: row.completedAt,
      executionSpec: request.executionSpec!, context: { scheduled: { ...scheduled, scheduledAt: row.attemptedAt - 1000,
        attemptedAt: row.attemptedAt, nextRunAt: row.attemptedAt + 7 * 86400_000, failures: 0 } } })) })
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    await prisma.$executeRaw`ANALYZE run_requests`
    await prisma.$executeRaw`ANALYZE audits`
    await prisma.$executeRaw`ANALYZE projects`
    const selected = watchStorage.scheduledCompletionSelection(new Date(), 20, {})
    const dueAt = new Date(Number(scheduled.nextRunAt) + 1000)
    const due = watchStorage.dueWatchSelection(dueAt, 20, {})
    const explain = async (query: Prisma.Sql) => {
      const rows = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>>(
        'EXPLAIN (ANALYZE, FORMAT JSON) ' + query.text, ...query.values)
      return rows[0]['QUERY PLAN'][0].Plan
    }
    const activePlan = await explain(selected)
    const deferredPlan = await explain(due)
    expect(await watchStorage.selectDueWatchProjects(dueAt, 20, {})).toEqual([])
    expect(await reconcileScheduledCompletions()).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    expect(await watchStorage.selectDueWatchProjects(dueAt, 20, {})).toMatchObject([{ id: siteId }])
    for (const [state, plan] of Object.entries({ active: activePlan, empty: await explain(selected),
      deferred: deferredPlan, due: await explain(due) })) {
      const indexes = new Set<string>()
      const visits = (node: Record<string, unknown>): number => {
        if (typeof node['Index Name'] === 'string') indexes.add(node['Index Name'])
        return (node['Relation Name'] === 'run_requests'
          ? (Number(node['Actual Rows'] ?? 0) + Number(node['Rows Removed by Filter'] ?? 0)) * Number(node['Actual Loops'] ?? 1) : 0) +
          (Array.isArray(node.Plans) ? node.Plans.reduce((sum, child) => sum + visits(child), 0) : 0)
      }
      const inspected = visits(plan)
      console.info('Scheduled completion request history:', { state, inspected, indexes: [...indexes] })
      expect(inspected).toBeLessThan(50)
    }
    expect(await prisma.runRequest.count({ where: { projectId: siteId } })).toBe(10_001)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: siteId } })).toMatchObject({ watchConsecutiveFailures: 0, watchLastError: null })
  })

  it('uses six-hour backoff for repeated execution failures without forgetting the streak', async () => {
    const request = await admit(2)
    await fail(request.auditId!)
    const retry = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(retry.watchConsecutiveFailures).toBe(3)
    expect(retry.watchNextRunAt!.getTime()).toBeGreaterThan(Date.now() + 359 * 60_000)
    expect(retry.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 361 * 60_000)
  })

  it('caps a long retry backoff at an earlier normal cadence', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'HOURLY' } })
    const request = await admit(2, 'hourly')
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt
    await fail(request.auditId!)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 3, watchNextRunAt: due })
  })

  it('rolls back receipt context and clock together, then commits idempotently without reviving a pause', async () => {
    const now = new Date(), until = new Date(now.getTime() + 600_000)
    const site = await prisma.project.update({ where: { id: projectId }, data: { watchLastAttemptAt: now, watchLeaseUntil: until } })
    const admitted = await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt: site.watchNextRunAt!, now })
    const original = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const input = { projectId, userId, runId: admitted.runId, admittedAt: now, claim: { targetUrl: site.url, interval: 'weekly' as const,
      everyMinutes: null, scheduledAt: site.watchNextRunAt!, attemptedAt: now, leaseUntil: until } }
    const transact = transactions.productTransaction
    const interrupted = vi.spyOn(transactions, 'productTransaction').mockImplementationOnce(operation => transact(async tx => {
      await operation(tx)
      throw new Error('Controlled clock commit interruption')
    }))
    try { await expect(commitScheduledRun(input)).rejects.toThrow('Controlled clock commit interruption') }
    finally { interrupted.mockRestore() }
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(before)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })).toEqual(original)
    await commitScheduledRun(input)
    const committed = await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
    const paused = await prisma.project.update({ where: { id: projectId }, data: { watchNextRunAt: null, watchLastError: 'Paused' } })
    await commitScheduledRun(input)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(paused)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })).toEqual(committed)
  })

  it.each(['no recent source', 'fresh source', 'changed binding authorization'] as const)('shares due care with compatible manual work (%s)', async mode => {
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    const url = 'https://example.com/'
    if (mode !== 'no recent source') await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED',
      createdAt: new Date(Date.now() - 120_000), completedAt: new Date(Date.now() - 119_000), reportCompleteness: 'FULL',
      pages: { create: { url, normalizedUrl: url, position: 0, role: 'primary', status: 'COMPLETED' } },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
        checks: {}, outcomes: [], verificationTarget: null } } })
    const manual = await requestSiteRun({ projectId, userId, source: 'WEB', scope: 'SITE', outcomeIds: [], idempotencyKey: 'compatible-manual' })
    expect(manual.outcomeIds).toHaveLength(1)
    const incompatible = mode === 'changed binding authorization'
    if (incompatible) await prisma.siteOutcome.updateMany({ where: { projectId, id: { in: manual.outcomeIds } },
      data: { authorizationRevision: { increment: 1 } } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: incompatible ? 0 : 1, errors: 0 })
    expect(queue.add).toHaveBeenCalledTimes(1)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    if (incompatible) {
      expect(await prisma.runRequestKey.count({ where: { projectId, source: 'WATCH' } })).toBe(0)
      return
    }
    expect(await prisma.runRequestKey.count({ where: { projectId, source: 'WATCH', runRequestId: manual.runId } })).toBe(1)
    const shared = await prisma.runRequest.findUniqueOrThrow({ where: { id: manual.runId } })
    expect(shared).toMatchObject({ source: 'WEB', context: { scheduled: { version: 1 } } })
    const scheduledAt = new Date((shared.context as { scheduled: { scheduledAt: number } }).scheduled.scheduledAt)
    expect(await requestScheduledSiteRun({ projectId, userId, interval: 'weekly', scheduledAt, now: new Date() }))
      .toMatchObject({ runId: manual.runId, auditId: manual.auditId, outcomeIds: manual.outcomeIds, reused: true })
    await fail(manual.auditId!)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
  })

  it('declines reuse-only admission when there is no live Run to share', async () => {
    await expect(requestSiteRun({ projectId, userId, source: 'WATCH', scope: 'SITE', outcomeIds: [], idempotencyKey: 'live-only' },
      { reuseOnly: true })).rejects.toMatchObject({ code: 'SITE_RUN_IN_PROGRESS' })
    expect(await prisma.audit.count({ where: { projectId } })).toBe(0)
    expect(await prisma.runRequestKey.count({ where: { projectId } })).toBe(0)
    expect(queue.add).not.toHaveBeenCalled()
  })

  async function completedSharedObservation(source: 'WEB' | 'WATCH' = 'WEB', key = 'shared-manual-alert') {
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS' } })
    const manualRun = source === 'WEB' ? await requestSiteRun({ projectId, userId, source, scope: 'SITE', outcomeIds: [], idempotencyKey: key }) : null
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const native = !manualRun ? await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } }) : null
    const manual = manualRun ?? { runId: native!.id, auditId: native!.auditId }
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })
    // Controlled stored observation exercises schedule and notification
    // projection, not fresh collection or a real provider send.
    await prisma.flag.create({ data: { auditId: manual.auditId!, checkId: key === 'shared-manual-alert' ? 'security-headers-missing-csp' : 'security-headers-missing-hsts', source: 'DETERMINISTIC',
      rubric: 'REACH', severity: 'IMPORTANT', confidence: 1, position: 0, problem: 'Content policy is absent',
      evidence: 'Controlled header observation.', whyItMatters: 'Restrict public script permissions.', fix: 'Configure the response policy.' } })
    const completedAt = new Date()
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { status: 'COMPLETED', completedAt } })
    await persistFlagDiffSummary(original.parentId, manual.auditId!)
    return { manual, original, completedAt }
  }

  it.each([false, true])('records page recovery and recurrence alongside a sibling failure (already known: %s)', async knownSibling => {
    const url = 'https://example.com/'
    const firstPage = url + 'first'
    const siblingPage = url + 'sibling'
    const executionSpec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url,
      environment: 'production', checks: { 'title-missing': CHECK_REGISTRY['title-missing'].version }, outcomes: [], verificationTarget: null }
    const now = Date.now()
    async function audit(age: number, parentId?: string) {
      const at = new Date(now - age)
      return prisma.audit.create({ data: { projectId, userId, parentId, url, status: 'COMPLETED', completedAt: at, createdAt: at,
        executionSpec, recheckTrigger: parentId ? 'WATCH' : null } })
    }
    function finding(auditId: string, pageUrl: string, position = 0) {
      return prisma.flag.create({ data: { auditId, pageUrl, position, source: 'DETERMINISTIC', checkId: 'title-missing',
        rubric: 'REACH', severity: 'IMPORTANT', confidence: 1, problem: 'Missing page title', evidence: 'The captured title is empty.',
        whyItMatters: 'A title describes this page in search and browser tabs.', fix: 'Add a descriptive page title.' } })
    }
    await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS', notifyOnRecovery: true } })
    const original = await audit(180_000)
    const old = await finding(original.id, firstPage)
    await materializeAttentionForAudit(original.id)
    const prior = knownSibling ? await audit(150_000, original.id) : original
    if (knownSibling) {
      await finding(prior.id, siblingPage)
      await materializeAttentionForAudit(prior.id)
    }
    const repaired = await audit(120_000, prior.id)
    const newSibling = await finding(repaired.id, siblingPage)
    await prisma.auditVerificationReceipt.create({ data: { auditId: repaired.id, targetKey: 'check:title-missing',
      scopeKey: 'page:' + firstPage, pageUrl: firstPage, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
        kind: 'search-verifier', version: 1, auditId: repaired.id, pageUrl: firstPage, checkId: 'title-missing',
        verdict: 'passed', comparable: true, observationIds: ['title-present'], reason: 'The original page title is present.',
      } } })
    await diffFlagsAgainstParent(repaired.id, prior.id)
    await materializeAttentionForAudit(repaired.id)
    await persistFlagDiffSummary(prior.id, repaired.id)
    await classifyWatchResult(repaired.id)
    expect(await getFlagDiffSummary(prior.id, repaired.id)).toMatchObject({
      fixed: [{ id: old.id, pageUrl: firstPage }], newIssues: knownSibling ? [] : [{ id: newSibling.id }],
      unchanged: knownSibling ? [{ id: newSibling.id, pageUrl: siblingPage }] : [], regressed: [],
    })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: repaired.id } })).toMatchObject({ watchRegressionCount: knownSibling ? 0 : 1, watchRecoveryCount: 1 })
    const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: repaired.id, targetKey: FLAG_COMPARISON_TARGET } })
    expect(receipt.evidenceReference).toMatchObject({ auditId: repaired.id, parentAuditId: prior.id, verifiedRecoveryIds: [old.id] })
    if (knownSibling) {
      await prisma.audit.update({ where: { id: repaired.id }, data: { improvementProjectedAt: new Date() } })
      await notifyWatchRegression(repaired.id)
      expect(provider.send).toHaveBeenCalledOnce()
      expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('(/first)') }), expect.anything())
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: repaired.id } })).toMatchObject({ watchNotificationStatus: 'SENT' })
    }
    // Simulate a stored comparison that predates explicit recovery IDs.
    await prisma.auditVerificationReceipt.update({ where: { id: receipt.id }, data: { evidenceReference: { auditId: repaired.id, parentAuditId: prior.id } } })
    expect(await readReportComparisonWithRecovery(prior.id, repaired.id)).toMatchObject({ verifiedRecoveryIds: [old.id] })

    const recurrence = await audit(60_000, repaired.id)
    const stillOpen = await finding(recurrence.id, siblingPage)
    const regressed = await finding(recurrence.id, firstPage, 1)
    await diffFlagsAgainstParent(recurrence.id, repaired.id)
    await materializeAttentionForAudit(recurrence.id)
    await persistFlagDiffSummary(repaired.id, recurrence.id)
    await classifyWatchResult(recurrence.id)
    expect(await getFlagDiffSummary(repaired.id, recurrence.id)).toMatchObject({
      fixed: [], newIssues: [], unchanged: [{ id: stillOpen.id }], regressed: [{ id: regressed.id }],
    })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: recurrence.id } })).toMatchObject({ watchRegressionCount: 1, watchRecoveryCount: 0 })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: 'FIXED', resolvedInId: repaired.id })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: stillOpen.id } })).toMatchObject({ status: 'OPEN' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: regressed.id } })).toMatchObject({ status: 'REGRESSED' })
    expect(await readReportComparisonWithRecovery(prior.id, repaired.id)).toMatchObject({ verifiedRecoveryIds: [old.id] })
  })

  it('retains deterministic Flag history without an Improvement and refuses evidence from another environment', async () => {
    const url = 'https://example.com/', checkId = 'title-missing', now = Date.now()
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, checks: { [checkId]: CHECK_REGISTRY[checkId].version },
      outcomes: [], verificationTarget: null }
    async function audit(age: number, parentId?: string, environment = 'production') {
      const at = new Date(now - age)
      return prisma.audit.create({ data: { projectId, userId, parentId, url, status: 'COMPLETED', completedAt: at, createdAt: at,
        executionSpec: { ...spec, environment }, recheckTrigger: parentId ? 'WATCH' : null } })
    }
    function finding(auditId: string) {
      return prisma.flag.create({ data: { auditId, pageUrl: url, position: 0, source: 'DETERMINISTIC', checkId,
        rubric: 'REACH', severity: 'CRITICAL', confidence: 1, problem: 'Missing page title', evidence: 'The captured title is empty.',
        whyItMatters: 'A title describes the page.', fix: 'Add a descriptive page title.' } })
    }
    async function project(run: { id: string; parentId: string | null }) {
      await diffFlagsAgainstParent(run.id, run.parentId)
      await persistFlagDiffSummary(run.parentId, run.id)
      return getFlagDiffSummary(run.parentId, run.id)
    }

    const initial = await audit(300_000)
    const original = await finding(initial.id)
    const preview = await finding((await audit(295_000, undefined, 'preview')).id)
    const gap = await audit(270_000, initial.id)
    expect(await project(gap)).toMatchObject({ fixed: [], inconclusive: [{ id: original.id }] })
    const continued = await audit(240_000, gap.id)
    const sameFailure = await finding(continued.id)
    expect(await project(continued)).toMatchObject({ unchanged: [{ id: sameFailure.id }], newIssues: [], regressed: [] })
    const nextGap = await audit(210_000, continued.id)
    await project(nextGap)

    const repaired = await audit(180_000, nextGap.id)
    await prisma.auditVerificationReceipt.create({ data: { auditId: repaired.id, targetKey: 'check:' + checkId,
      scopeKey: 'page:' + url, pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
        kind: 'search-verifier', version: 1, auditId: repaired.id, pageUrl: url, checkId, verdict: 'passed', comparable: true,
        observationIds: ['title-present'], reason: 'The original page title is present.',
      } } })
    expect((await project(repaired)).fixed).toHaveLength(1)
    for (const flag of [original, sameFailure]) expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } }))
      .toMatchObject({ status: 'FIXED', resolvedInId: repaired.id })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: preview.id } })).toMatchObject({ status: 'OPEN', resolvedInId: null })

    const returned = await audit(120_000, repaired.id)
    const recurrence = await finding(returned.id)
    expect(await project(returned)).toMatchObject({ regressed: [{ id: recurrence.id }], newIssues: [], fixed: [] })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: recurrence.id } })).toMatchObject({ status: 'REGRESSED' })
    expect(await prisma.improvementOccurrence.count({ where: { audit: { projectId } } })).toBe(0)
  })

  it.each(['WEB', 'WATCH'] as const)('keeps an earlier %s Watch alert out of current retry after switching away and back', async source => {
    const prior = await completedSharedObservation(source)
    await classifyWatchResult(prior.manual.auditId!)
    await prisma.audit.update({ where: { id: prior.manual.auditId! }, data: { improvementProjectedAt: new Date(), updatedAt: new Date(0) } })
    await prisma.runRequest.update({ where: { id: prior.manual.runId }, data: { status: 'COMPLETED', leaseUntil: null } })
    await updateOwnedSiteIdentity({ projectId, userId }, { origin: 'http://example.com:8080' })
    await updateOwnedSiteIdentity({ projectId, userId }, { origin: 'https://example.com' })
    await classifyWatchResult(prior.manual.auditId!)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchTargetRevision: 3, watchLastRunAt: null })
    expect((await loadSiteHome(projectId))?.watch.alert.state).toBe('none')
    expect(await countMonitoringOperations(prisma, new Date(Date.now() + 3600_000))).toMatchObject({ undeliveredWatchAlerts: 0 })
    expect(await retryPendingWatchNotifications(1)).toBe(0)
    expect(provider.send).not.toHaveBeenCalled()
    if (source === 'WEB') {
      await prisma.audit.update({ where: { id: prior.manual.auditId! }, data: { watchNotificationStatus: 'FAILED' } })
      await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
      const expiresAt = new Date(Date.now() + 60_000)
      const session = await prisma.session.create({ data: { id: randomUUID(), userId, token: randomUUID(), expiresAt } })
      const intent = { action: 'WATCH_NOTIFICATION_RETRY' as const, targetId: prior.manual.auditId!, reason: 'Controlled stale alert', input: {} }
      const target = await resolveAdminTarget(intent)
      const operation = await prisma.adminOperation.create({ data: {
        ...intent, actorId: userId, actorSessionId: session.id, actorAuthenticatedAt: new Date(),
        targetType: 'AUDIT', ownerId: userId, expectedRevision: target.revision, idempotencyKey: 'stale-watch-alert',
        requestHash: 'fixture', intentExpiresAt: expiresAt, status: 'RUNNING', executionToken: randomUUID(), leaseUntil: expiresAt,
      } })
      try {
        await expect(performAdminExternalAction(operation, {})).rejects.toMatchObject({ code: 'TARGET_CHANGED' })
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: prior.manual.auditId! } })).toMatchObject({
          watchNotificationAttempts: 0, watchNotificationAttemptCeiling: 5, watchNotificationStatus: 'FAILED',
        })
      } finally { await prisma.adminOperation.delete({ where: { id: operation.id } }) }
    }

    const current = await completedSharedObservation(source, 'current-manual-alert')
    await classifyWatchResult(current.manual.auditId!)
    await prisma.audit.update({ where: { id: current.manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    expect(await retryPendingWatchNotifications(1)).toBe(1)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: prior.manual.auditId! } })).toMatchObject({ watchNotificationAttempts: 0 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: current.manual.auditId! } })).toMatchObject({ watchNotificationStatus: 'SENT' })
  })

  it('refuses an earlier target at provider claim and retains acceptance for an admitted send', async () => {
    const prior = await completedSharedObservation()
    await prisma.audit.update({ where: { id: prior.manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: prior.manual.runId }, data: { status: 'COMPLETED', leaseUntil: null } })
    const write = prisma.audit.updateMany.bind(prisma.audit)
    const edit = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (input.data.watchNotificationStatus === 'SENDING')
        await updateOwnedSiteIdentity({ projectId, userId }, { origin: 'http://example.com:8080' })
      return write(input)
    })
    try { expect(await retryPendingWatchNotifications(1)).toBe(1) } finally { edit.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: prior.manual.auditId! } })).toMatchObject({ watchNotificationAttempts: 0 })
    const current = await completedSharedObservation('WEB', 'accepted-after-edit')
    await prisma.audit.update({ where: { id: current.manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    const providerId = 'retained-watch-' + randomUUID()
    provider.send.mockImplementationOnce(async () => {
      await updateOwnedSiteIdentity({ projectId, userId }, { origin: 'https://example.com' })
      return { data: { id: providerId }, error: null }
    })
    expect(await retryPendingWatchNotifications(1)).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: current.manual.auditId! } })).toMatchObject({
      watchNotificationStatus: 'SENT', watchNotificationProviderId: providerId, watchNotificationAttempts: 1,
    })
    expect(await prisma.emailDelivery.findUnique({ where: { providerId } })).toMatchObject({ sourceId: current.manual.auditId, userId })
  })

  it.each([false, true])('retains monitoring classification when due care shares a manual execution (deferred: %s)', async deferred => {
    const { manual, original, completedAt } = await completedSharedObservation()
    if (!deferred) await classifyWatchResult(manual.auditId!)
    else expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })).toMatchObject({
      watchNotificationStatus: 'NOT_APPLICABLE', watchRegressionCount: null, watchRecoveryCount: null })
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    if (!deferred) {
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })).toMatchObject({
        recheckTrigger: original.recheckTrigger, skipUsageCount: original.skipUsageCount,
        watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
    }
    expect(await retryPendingWatchNotifications()).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })).toMatchObject({
      recheckTrigger: original.recheckTrigger, skipUsageCount: original.skipUsageCount,
      watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'SENT', watchNotificationAttempts: 1 })
    expect(provider.send).toHaveBeenCalledOnce()
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'accepted', status: 'SENT', attempts: 1 })
    expect(await countMonitoringOperations(prisma, new Date())).toMatchObject({ undeliveredWatchAlerts: 0 })
    expect(await retryPendingWatchNotifications()).toBe(0)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: completedAt })
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    expect(queue.add).toHaveBeenCalledOnce()
  })

  it('does not grant alerts from schedule-shaped context without the server Watch key', async () => {
    const { manual } = await completedSharedObservation()
    await prisma.runRequestKey.deleteMany({ where: { runRequestId: manual.runId, source: 'WATCH' } })
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    expect(await retryPendingWatchNotifications()).toBe(0)
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })).toMatchObject({
      watchNotificationStatus: 'NOT_APPLICABLE', watchRegressionCount: null, watchNotificationAttempts: 0 })
  })

  it('rechecks a shared monitoring obligation before provider admission', async () => {
    const { manual } = await completedSharedObservation()
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    const write = prisma.audit.updateMany.bind(prisma.audit)
    const revoke = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (input.data.watchNotificationStatus === 'SENDING')
        await prisma.runRequestKey.deleteMany({ where: { runRequestId: manual.runId, source: 'WATCH' } })
      return write(input)
    })
    try { expect(await retryPendingWatchNotifications()).toBe(1) } finally { revoke.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0 })
  })

  it('exposes a shared monitoring delivery failure through owner and operational reads', async () => {
    const { manual } = await completedSharedObservation()
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Controlled provider refusal' } })
    expect(await retryPendingWatchNotifications()).toBe(1)
    expect(provider.send).toHaveBeenCalledOnce()
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'delivering', status: 'FAILED', attempts: 1 })
    expect(await countMonitoringOperations(prisma, new Date())).toMatchObject({ undeliveredWatchAlerts: 1 })
    expect(await retryPendingWatchNotifications()).toBe(0)
  })

  it('honors a complaint recorded after Watch delivery is claimed', async () => {
    const { manual } = await completedSharedObservation()
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    const recipientHash = emailRecipientHash(userId + '@example.test')
    const write = prisma.audit.updateMany.bind(prisma.audit)
    let claimed = false
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      const result = await write(input)
      if (input.data.watchNotificationStatus === 'SENDING' && result.count === 1) {
        await prisma.emailSuppression.create({ data: {
          recipientHash, reason: 'COMPLAINED', occurredAt: new Date(), providerId: randomUUID(),
        } })
        claimed = true
      }
      return result
    })
    try {
      expect(await retryPendingWatchNotifications()).toBe(1)
      expect(claimed).toBe(true)
      expect(provider.send).not.toHaveBeenCalled()
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })).toMatchObject({
        watchRegressionCount: 1, watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationAttempts: 0,
        watchNotificationLeaseUntil: null, watchNotificationNextAttemptAt: null, watchNotificationProviderId: null,
      })
      expect(await retryPendingWatchNotifications()).toBe(0)
    } finally {
      admission.mockRestore()
      await prisma.emailSuppression.deleteMany({ where: { recipientHash } })
    }
  })

  it('defers an unreadable shared classification without consuming a provider attempt', async () => {
    const { manual } = await completedSharedObservation()
    await prisma.runRequest.update({ where: { id: manual.runId }, data: { context: { scheduled: { version: 1 } } } })
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    expect(await retryPendingWatchNotifications()).toBe(1)
    expect(provider.send).not.toHaveBeenCalled()
    const deferred = await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })
    expect(deferred).toMatchObject({ watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationAttempts: 0,
      watchNotificationLastError: 'Notification classification could not complete' })
    expect(deferred.watchNotificationNextAttemptAt!.getTime()).toBeGreaterThan(Date.now())
    expect(await retryPendingWatchNotifications()).toBe(0)
    expect(await countMonitoringOperations(prisma, new Date(Date.now() + 2 * 60 * 60_000))).toMatchObject({ undeliveredWatchAlerts: 1 })
  })

  it('bounds an empty notification sweep independently of unrelated manual history', async () => {
    const { manual } = await completedSharedObservation()
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { improvementProjectedAt: new Date() } })
    await prisma.audit.createMany({ data: Array.from({ length: 10_000 }, () => ({ userId, projectId, url: 'https://example.com/',
      status: 'COMPLETED' as const, completedAt: new Date(), improvementProjectedAt: new Date() })) })
    await prisma.$executeRaw`ANALYZE audits`
    await prisma.$executeRaw`ANALYZE run_requests`
    let selected: Prisma.Sql | undefined
    const read = prisma.$queryRaw.bind(prisma)
    const capture = vi.spyOn(prisma, '$queryRaw').mockImplementation(async query => {
      if (typeof query === 'object' && 'text' in query && query.text.includes('watchNotificationAttemptCeiling')) selected = query as Prisma.Sql
      return read(query)
    })
    try { expect(await retryPendingWatchNotifications(1)).toBe(1) } finally { capture.mockRestore() }
    expect(selected).toBeDefined()
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>>(
      'EXPLAIN (ANALYZE, FORMAT JSON) ' + selected!.text, ...selected!.values)
    const visits = (node: Record<string, unknown>): number => (node['Relation Name'] === 'audits'
      ? (Number(node['Actual Rows'] ?? 0) + Number(node['Rows Removed by Filter'] ?? 0)) * Number(node['Actual Loops'] ?? 1) : 0) +
      (Array.isArray(node.Plans) ? node.Plans.reduce((sum, child) => sum + visits(child), 0) : 0)
    const inspected = visits(plan[0]['QUERY PLAN'][0].Plan)
    console.info('Shared Watch empty sweep audit visits:', inspected)
    expect(inspected).toBeLessThan(50)
    expect(await prisma.audit.count({ where: { projectId } })).toBe(10_001)
  })

  it('retries an exhausted dispatch after the scheduler has already advanced its weekly clock', async () => {
    queue.add.mockRejectedValueOnce(new Error('Controlled queue outage'))
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' } })
    const advanced = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(advanced.watchNextRunAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000)
    await prisma.audit.update({ where: { id: request.auditId! }, data: { recoveryUntil: new Date(0), dispatchNextAt: new Date(0) } })
    queue.add.mockRejectedValueOnce(new Error('Controlled outage persists'))
    expect(await dispatchAudit(request.auditId!)).toBe(false)
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: request.auditId! } })
    expect(failed).toMatchObject({ status: 'FAILED', startedAt: null, failureCode: 'QUEUE_ENQUEUE_FAILED' })
    await processDueProjectWatches(1, { onlyProjectId: projectId })
    const retry = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(retry.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
    expect(retry.watchConsecutiveFailures).toBe(1)
    expect(queue.add).toHaveBeenCalledTimes(2)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(retry.watchNextRunAt!.getTime() + 1000)
      expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    } finally { vi.useRealTimers() }
    expect(queue.add).toHaveBeenCalledTimes(3)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: failed.id } })).toEqual(failed)
    expect(await prisma.flag.count({ where: { audit: { projectId } } })).toBe(0)
  })
})
