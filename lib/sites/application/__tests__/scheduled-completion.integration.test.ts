import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { classifyWatchResult, processDueProjectWatches, retryPendingWatchNotifications } from '@/lib/audit/project-watch'
import { persistFlagDiffSummary } from '@/lib/audit/diff-flags'
import { loadSiteHome } from '../queries'
import { countMonitoringOperations } from '../monitoring-operations'
import * as transactions from '@/lib/billing/product-transaction'
import { requestScheduledSiteRun } from '../scheduled-runs'
import { requestSiteRun } from '../run-requests'
import { ensureDefaultMonitoring } from '../default-monitoring'
import { commitScheduledRun, reconcileScheduledCompletions } from '../scheduled-completion'
import { markOutcomeRunsCouldNotVerify } from '../run-reconciliation'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { setSiteOutcomeEnabled } from '../outcome-commands'
import { executeUptimeProbe } from '@/lib/uptime/service'
import { dispatchAudit } from '@/lib/audit/dispatch'
import { Prisma } from '@prisma/client'
import { interruptedAnalysisWorkSql, interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: 'queued' })) }))
const provider = vi.hoisted(() => ({ send: vi.fn() }))
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
    vi.useRealTimers(); vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, ...otherOwners] } } })
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
    const scheduledAt = new Date(Math.floor(Date.now() / 300_000) * 300_000)
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: source.url, nextProbeAt: scheduledAt } })
    await executeUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 }, async () => ({
      result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 10, finalUrl: source.url,
    }))
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
    // This saved terminal scope exercises scheduling, not webpage collection.
    const source = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
      reportCompleteness: 'FULL', createdAt: observedAt, completedAt: new Date(observedAt.getTime() + 1000),
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: entry,
        monitoringPages: [...new Set([entry, 'https://example.com/'])],
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
        executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: target,
          environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
      const latest = await prisma.audit.create({ data: { projectId, userId, url: entry, status: 'COMPLETED',
        createdAt: new Date(Date.now() - 60_000), completedAt: new Date(Date.now() - 59_000),
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
    const rejected = new Set(sites.slice(0, 2)), update = prisma.project.updateMany.bind(prisma.project)
    const projection = vi.spyOn(prisma.project, 'updateMany').mockImplementation(args => {
      if (mode === 'write-failure' && rejected.has(String(args.where?.id))) throw new Error('Controlled persistent completion projection failure')
      return update(args)
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
    const concurrent = prisma.$extends({ query: { project: { async updateMany({ args, query }) {
      await prisma.project.update({ where: { id: projectId }, data: { url: target } })
      return query(args)
    } } } })
    const write = vi.spyOn(prisma.project, 'updateMany').mockImplementationOnce(args => concurrent.project.updateMany(args))
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
    const write = vi.spyOn(prisma.project, 'updateMany').mockRejectedValueOnce(new Error('Controlled completion write interruption'))
    try { await fail(request.auditId!) } finally { write.mockRestore() }
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchConsecutiveFailures).toBe(0)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED' })
    const results = await Promise.all([reconcileScheduledCompletions(), reconcileScheduledCompletions()])
    expect(results.reduce((sum, count) => sum + count, 0)).toBe(1)
    expect(await reconcileScheduledCompletions()).toBe(0)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(site.watchConsecutiveFailures).toBe(1)
    expect(site.watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
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

  it('bounds completion recovery independently of retained scheduled request history', async () => {
    const request = await admit(2)
    const scheduled = (request.context as { scheduled: Record<string, Prisma.JsonValue> }).scheduled
    const history = Array.from({ length: 10_000 }, (_, index) => {
      const attemptedAt = Number(scheduled.attemptedAt) - (index + 1) * 60_000
      return { id: randomUUID(), attemptedAt, completedAt: new Date(attemptedAt + 1000) }
    })
    // Retained terminal history models query cost. No browser, natural calendar
    // execution or real website failures are claimed by these synthetic rows.
    await prisma.audit.createMany({ data: history.map(row => ({ id: row.id, projectId, userId, url: 'https://example.com/',
      status: 'FAILED' as const, createdAt: new Date(row.attemptedAt), completedAt: row.completedAt,
      recheckTrigger: 'WATCH' as const, executionSpec: request.executionSpec! })) })
    await prisma.runRequest.createMany({ data: history.map(row => ({ projectId, auditId: row.id, source: 'WATCH',
      idempotencyKey: 'retained:' + row.id, status: 'FAILED' as const, completedAt: row.completedAt,
      executionSpec: request.executionSpec!, context: { scheduled: { ...scheduled, scheduledAt: row.attemptedAt - 1000,
        attemptedAt: row.attemptedAt, nextRunAt: row.attemptedAt + 7 * 86400_000, failures: 0 } } })) })
    await prisma.audit.update({ where: { id: request.auditId! }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    await prisma.$executeRaw`ANALYZE run_requests`
    await prisma.$executeRaw`ANALYZE audits`
    await prisma.$executeRaw`ANALYZE projects`
    let selected: Prisma.Sql | undefined
    let activePlan: Record<string, unknown> | undefined
    const explain = async (query: Prisma.Sql) => {
      const rows = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>>(
        'EXPLAIN (ANALYZE, FORMAT JSON) ' + query.text, ...query.values)
      return rows[0]['QUERY PLAN'][0].Plan
    }
    const read = prisma.$queryRaw.bind(prisma)
    const capture = vi.spyOn(prisma, '$queryRaw').mockImplementation(async query => {
      if (typeof query === 'object' && 'text' in query && query.text.includes('scheduled,attemptedAt')) {
        selected = query as Prisma.Sql
        activePlan ??= await explain(selected)
      }
      return read(query)
    })
    try {
      expect(await reconcileScheduledCompletions()).toBe(1)
      expect(await reconcileScheduledCompletions()).toBe(0)
    } finally { capture.mockRestore() }
    expect(selected).toBeDefined()
    expect(activePlan).toBeDefined()
    for (const [state, plan] of Object.entries({ active: activePlan!, empty: await explain(selected!) })) {
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
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(10_001)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchConsecutiveFailures: 0, watchLastError: null })
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

  it('serves due care with a compatible manual execution and records completion without duplicating work', async () => {
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    const manual = await requestSiteRun({ projectId, userId, source: 'WEB', scope: 'SITE', outcomeIds: [], idempotencyKey: 'compatible-manual' })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    expect(queue.add).toHaveBeenCalledTimes(1)
    expect(await prisma.runRequest.count({ where: { projectId } })).toBe(1)
    expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: manual.runId } })).toMatchObject({ source: 'WEB', context: { scheduled: { version: 1 } } })
    await fail(manual.auditId!)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt!.getTime()).toBeLessThan(Date.now() + 16 * 60_000)
  })

  async function completedSharedObservation() {
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS' } })
    const manual = await requestSiteRun({ projectId, userId, source: 'WEB', scope: 'SITE', outcomeIds: [], idempotencyKey: 'shared-manual-alert' })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: manual.auditId! } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    // Controlled stored observation exercises schedule and notification
    // projection, not fresh collection or a real provider send.
    await prisma.flag.create({ data: { auditId: manual.auditId!, checkId: 'security-headers-missing-csp', source: 'DETERMINISTIC',
      rubric: 'REACH', severity: 'IMPORTANT', confidence: 1, position: 0, problem: 'Content policy is absent',
      evidence: 'Controlled header observation.', whyItMatters: 'Restrict public script permissions.', fix: 'Configure the response policy.' } })
    const completedAt = new Date()
    await prisma.audit.update({ where: { id: manual.auditId! }, data: { status: 'COMPLETED', completedAt } })
    await persistFlagDiffSummary(original.parentId, manual.auditId!)
    return { manual, original, completedAt }
  }

  it.each([false, true])('retains monitoring classification when due care shares a manual execution (deferred: %s)', async deferred => {
    const { manual, original, completedAt } = await completedSharedObservation()
    if (!deferred) await classifyWatchResult(original.parentId, manual.auditId!)
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
