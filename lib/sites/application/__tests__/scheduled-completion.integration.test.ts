import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import * as transactions from '@/lib/billing/product-transaction'
import { requestScheduledSiteRun } from '../scheduled-runs'
import { requestSiteRun } from '../run-requests'
import { ensureDefaultMonitoring } from '../default-monitoring'
import { commitScheduledRun, reconcileScheduledCompletions } from '../scheduled-completion'
import { markOutcomeRunsCouldNotVerify } from '../run-reconciliation'
import { dispatchAudit } from '@/lib/audit/dispatch'
import { Prisma } from '@prisma/client'
import { interruptedAnalysisWorkSql, interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'
import { readMonitoringHealth } from '@/lib/health/monitoring'
import { loadOperations } from '@/lib/admin/operations'
import { loadSiteOperations } from '@/lib/admin/site-operations'
import { setSiteOutcomeEnabled } from '../outcome-commands'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { executeUptimeProbe } from '@/lib/uptime/service'

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: 'queued' })) }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => queue }))
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
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const site = await prisma.project.create({ data: { userId, name: 'Scheduled completion', url: 'https://example.com/',
      canonicalHost: 'example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() - 60_000),
      accountChecksEnabled: false, notificationLevel: 'OFF' } })
    projectId = site.id
    queue.add.mockReset().mockResolvedValue({ id: 'queued' })
  })
  afterEach(async () => {
    vi.useRealTimers(); vi.restoreAllMocks()
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

  it('detects overdue initial automatic setup during retry backoff and clears only the fulfilled setup gap', async () => {
    const now = new Date(), createdAt = new Date(now.getTime() - 600_000), retryAt = new Date(now.getTime() + 60_000)
    const sessionId = randomUUID()
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    const saved = await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null,
      watchNextRunAt: null, createdAt, monitoringSetupRetryAt: retryAt } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueSchedules: 1, interruptedSchedules: 0 })
    expect(await loadOperations(actor, { queue: 'schedules' })).toMatchObject({ total: 1,
      rows: [{ siteId: projectId, state: 'Awaiting automatic setup', at: createdAt, action: null }] })
    expect((await loadSiteOperations(now)).find(item => item.label === 'Monitoring schedules needing attention')?.value).toBe(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(saved)
    expect(await prisma.audit.count({ where: { projectId } })).toBe(0)
    // Backoff remains execution policy. It cannot make unmet care healthy.
    expect(await processDueProjectWatches(1)).toEqual({ processed: 0, enqueued: 0, errors: 0 })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueSchedules: 1 })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(retryAt.getTime() + 1000)
      expect(await processDueProjectWatches(1)).toEqual({ processed: 1, enqueued: 1, errors: 0 })
      // Actual setup and queued work are not a completed uptime observation.
      expect(await readMonitoringHealth()).toMatchObject({ ok: false, overdueSchedules: 0, overdueUptimeProbes: 1 })
      expect(await loadOperations(actor, { queue: 'schedules' })).toMatchObject({ total: 0, rows: [] })
    } finally { vi.useRealTimers() }
    expect(await prisma.runRequest.findFirstOrThrow({ where: { projectId } })).toMatchObject({ status: 'QUEUED', executionSpec: { scope: 'SITE' } })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchLastRunAt: null, monitoringSetupRetryAt: null })
    expect(queue.add).toHaveBeenCalledTimes(1)
  })

  it.each(['young', 'paused', 'attempted', 'observed', 'removed', 'suspended', 'deleting'] as const)(
    'excludes %s Sites from the overdue unadmitted monitoring cohort', async change => {
      const now = new Date()
      await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: null,
        createdAt: new Date(now.getTime() - (change === 'young' ? 60_000 : 600_000)),
        ...(change === 'paused' ? { watchLastError: 'Paused.' } : {}),
        ...(change === 'attempted' ? { watchLastAttemptAt: now } : {}),
        ...(change === 'observed' ? { watchLastRunAt: now } : {}),
        ...(change === 'removed' ? { deletedAt: now } : {}) } })
      if (change === 'suspended' || change === 'deleting') await prisma.user.update({ where: { id: userId },
        data: { lifecycleStatus: change === 'suspended' ? 'SUSPENDED' : 'DELETING' } })
      const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueSchedules: 0, interruptedSchedules: 0 })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(saved)
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
      await prisma.auditVerifierExecution.create({ data: { auditId: admitted.auditId!, targetKey: 'task:browser', source: 'EXECUTION',
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

  it.each(['FAILED', 'EXHAUSTED'] as const)('retains %s monitoring as an operational gap throughout retry backoff', async failure => {
    const now = new Date(), sessionId = randomUUID()
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: 'https://example.com/', state: 'online',
      lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000) } })
    const source = await admit()
    if (failure === 'FAILED') await fail(source.auditId!)
    else {
      await prisma.auditVerifierExecution.create({ data: { auditId: source.auditId!, targetKey: 'task:browser', source: 'EXECUTION',
        workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', workErrorCode: 'RECOVERY_EXHAUSTED' } })
      await prisma.audit.update({ where: { id: source.auditId! }, data: { status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
      await prisma.runRequest.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    }
    await reconcileScheduledCompletions()
    const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId! } })
    expect(saved.watchConsecutiveFailures).toBe(1)
    expect(saved.watchNextRunAt!.getTime()).toBeGreaterThan(Date.now())
    expect(await readMonitoringHealth()).toMatchObject({ ok: false, overdueSchedules: 0, interruptedSchedules: 1 })
    const operations = await loadOperations(actor, { queue: 'schedules' })
    expect(operations).toMatchObject({ total: 1, rows: [{ siteId: projectId, state: 'Scheduled check interrupted', action: null }] })
    expect((await loadSiteOperations()).find(item => item.label === 'Monitoring schedules needing attention')?.value).toBe(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(saved)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)

    // The existing retry scheduler owns recovery. A fresh admission still does
    // not establish completed monitoring or a successful website observation.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(saved.watchNextRunAt!.getTime() + 1000)
    await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { lastCheckedAt: new Date(), nextProbeAt: new Date(Date.now() + 300_000) } })
    expect(await processDueProjectWatches(1, { onlyProjectId: projectId })).toMatchObject({ enqueued: 1, errors: 0 })
    expect(await readMonitoringHealth()).toMatchObject({ ok: false, overdueSchedules: 0, interruptedSchedules: 1 })
    const retry = await prisma.runRequest.findFirstOrThrow({ where: { projectId, id: { not: source.id } } })
    await prisma.audit.update({ where: { id: retry.auditId! }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await prisma.runRequest.update({ where: { id: retry.id }, data: { status: 'COMPLETED', completedAt: new Date(), leaseUntil: null } })
    expect(await reconcileScheduledCompletions()).toBe(1)
    const health = await readMonitoringHealth()
    // Completed partial observations still await classification. A failed
    // execution's admission marker never becomes a notification obligation.
    expect(health).toMatchObject({ ok: failure === 'FAILED', overdueSchedules: 0, interruptedSchedules: 0,
      undeliveredWatchAlerts: failure === 'EXHAUSTED' ? 1 : 0 })
    expect(await loadOperations(actor, { queue: 'schedules' })).toMatchObject({ total: 0, rows: [] })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
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
    await prisma.auditVerifierExecution.create({ data: { auditId: request.auditId!, targetKey: 'task:p0:' + kind, source: 'EXECUTION',
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
    { workKind: 'browser', workState: 'BLOCKED', status: 'FAILED', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'COMPLETED', status: 'COMPLETED', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'NOT_APPLICABLE', targetKey: 'task:browser', interrupted: false },
    { workKind: 'browser', workState: 'EXHAUSTED', status: 'FAILED', targetKey: 'module:browser', interrupted: false },
  ] as const)('preserves interruption meaning across SQL selection and conditional settlement: %j', async ({ interrupted, ...task }) => {
    const request = await admit(2)
    const due = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).watchNextRunAt
    await prisma.auditVerifierExecution.create({ data: { ...task, auditId: request.auditId!, source: 'EXECUTION' } })
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
    if (!admitted.runId) throw new Error('Expected an admitted scheduled execution')
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
