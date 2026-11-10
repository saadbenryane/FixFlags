import { uptimeReadSite } from '@/lib/uptime/__tests__/read-site'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteHome } from '../queries'
import { siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { loadSiteSummaries } from '../list-sites'
import { loadOperations } from '@/lib/admin/operations'
import { loadSiteOperations } from '@/lib/admin/site-operations'
import { readMonitoringHealth } from '@/lib/health/monitoring'
import { fixedClock } from '@/lib/time/clock'
import { executeUptimeProbe, scheduleUptimeProbes } from '@/lib/uptime/service'
import { loadUptimeSummary } from '@/lib/uptime/queries'
import { UPTIME_CONFIRMATION_MS, UPTIME_INTERVAL_MS, uptimeSlotStart } from '@/lib/uptime/domain'
import { setProjectWatch } from '../monitoring-settings'

const uptimeQueue = vi.hoisted(() => ({ enqueue: vi.fn(async () => {}) }))
vi.mock('@/lib/uptime/queue', () => ({ enqueueUptimeProbe: uptimeQueue.enqueue }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site Watch delivery projection with migrated PostgreSQL', () => {
  let userId: string, projectId: string
  const url = 'https://example.com/'
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  beforeEach(async () => {
    uptimeQueue.enqueue.mockClear()
    userId = 'watch-view-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', preferredTools: [] } })
    projectId = (await prisma.project.create({ data: { userId, name: 'Watch projection fixture', url, canonicalHost: 'example.com' } })).id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })
  afterAll(() => prisma.$disconnect())

  it('exposes unsettled account summaries consistently in operational health and operator queues', async () => {
    const now = new Date(), old = new Date(now.getTime() - 3600_000), future = new Date(now.getTime() + 3600_000)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin', emailVerified: true } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: future } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.notificationPreference.create({ data: { userId, cadence: 'WEEKLY', nextSendAt: future } })
    // Stored receipt states isolate the operational read contract. They do not
    // represent actual provider sends or real inbox acceptance.
    const samples = [
      { status: 'FAILED' as const, nextAttemptAt: future, leaseUntil: null, attention: true },
      { status: 'PENDING' as const, nextAttemptAt: old, leaseUntil: null, attention: true },
      { status: 'SENDING' as const, nextAttemptAt: old, leaseUntil: old, attention: true },
      { status: 'SENDING' as const, nextAttemptAt: old, leaseUntil: null, attention: true },
      { status: 'PENDING' as const, nextAttemptAt: new Date(now.getTime() - 60_000), leaseUntil: null, attention: false },
      { status: 'PENDING' as const, nextAttemptAt: future, leaseUntil: null, attention: false },
      { status: 'SENDING' as const, nextAttemptAt: old, leaseUntil: future, attention: false },
      { status: 'SENT' as const, nextAttemptAt: old, leaseUntil: null, attention: false },
      { status: 'SKIPPED' as const, nextAttemptAt: old, leaseUntil: null, attention: false },
    ].map(sample => ({ ...sample, id: randomUUID() }))
    await prisma.notificationDigest.createMany({ data: samples.map((sample, index) => ({
      id: sample.id, status: sample.status, nextAttemptAt: sample.nextAttemptAt, leaseUntil: sample.leaseUntil,
      userId, revision: 0, scheduledAt: new Date(old.getTime() - index * 1000),
    })) })
    const expected = samples.filter(sample => sample.attention).map(sample => sample.id).sort()
    const original = await prisma.notificationDigest.findMany({ where: { userId }, orderBy: { id: 'asc' } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, unsettledSummaries: expected.length })
    const operations = await loadOperations(actor, { queue: 'watch-alerts' })
    expect(operations.total).toBe(expected.length)
    expect(operations.rows.map(row => row.id).sort()).toEqual(expected)
    expect(operations.rows.every(row => row.userId === userId && row.siteId === null && row.action === null)).toBe(true)
    expect((await loadSiteOperations(now)).find(item => item.label === 'Monitoring notifications needing attention')?.value).toBe(expected.length)
    expect(await prisma.notificationDigest.findMany({ where: { userId }, orderBy: { id: 'asc' } })).toEqual(original)
    const watchIds = Array.from({ length: operations.pagination.take - 1 }, () => randomUUID())
    await prisma.audit.createMany({ data: watchIds.map(id => ({ id, userId, projectId, url,
      status: 'COMPLETED', recheckTrigger: 'WATCH', watchNotificationStatus: 'FAILED', createdAt: old, completedAt: old, improvementProjectedAt: old })) })
    const first = await loadOperations(actor, { queue: 'watch-alerts' }), second = await loadOperations(actor, { queue: 'watch-alerts', page: '2' })
    expect(first.total).toBe(watchIds.length + expected.length)
    const combined = [...first.rows, ...second.rows]
    expect(combined.map(row => row.id).sort()).toEqual([...watchIds, ...expected].sort())
    expect(combined.filter(row => row.userId).every(row => row.userId === userId && row.siteId === null)).toBe(true)
    expect(combined.filter(row => !row.userId).every(row => row.siteId === projectId && row.action === 'WATCH_NOTIFICATION_RETRY')).toBe(true)
    for (const id of expected) await prisma.notificationDigest.update({ where: { id }, data: { status: 'SENT', sentAt: now, providerId: randomUUID() } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, unsettledSummaries: 0, undeliveredWatchAlerts: watchIds.length })
    expect((await loadOperations(actor, { queue: 'watch-alerts' })).total).toBe(watchIds.length)
    await prisma.audit.updateMany({ where: { id: { in: watchIds } }, data: { watchNotificationStatus: 'NOT_APPLICABLE' } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, unsettledSummaries: 0 })
    await prisma.notificationDigest.update({ where: { id: expected[0] }, data: { status: 'FAILED' } })
    await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, unsettledSummaries: 0 })
  })

  it.each(['missing', 'overdue', 'inconclusive'] as const)('excludes an explicitly paused Site from %s uptime obligations without losing its evidence', async state => {
    const now = new Date(), old = new Date(now.getTime() - 3 * UPTIME_INTERVAL_MS)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(now.getTime() + 86400_000), createdAt: old } })
    const monitor = state === 'missing' ? null : await prisma.uptimeMonitor.create({ data: {
      projectId, targetUrl: url, state: 'unknown', lastCheckedAt: now,
      nextProbeAt: state === 'overdue' ? old : new Date(now.getTime() + 5 * 60_000),
    } })
    if (monitor) await prisma.uptimeProbe.createMany({ data: [old, now].map(observedAt => ({
      monitorId: monitor.id, version: 1, targetUrl: url, scheduledAt: observedAt, observedAt, attempt: 1,
      result: 'UNKNOWN', reason: 'probe_unavailable', statusCode: null, durationMs: 5,
    })) })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false,
      overdueUptimeProbes: state === 'inconclusive' ? 0 : 1,
      inconclusiveUptimeSites: state === 'inconclusive' ? 1 : 0,
    })
    expect(await setProjectWatch({ projectId, userId, action: 'pause' }, { clock: fixedClock(now) })).toMatchObject({ ok: true })
    const retained = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const retainedMonitor = await prisma.uptimeMonitor.findUnique({ where: { projectId } })
    expect(retained).toMatchObject({ watchInterval: 'WEEKLY', watchPausedAt: now })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueSchedules: 0, overdueUptimeProbes: 0, inconclusiveUptimeSites: 0 })
    expect((await loadOperations(actor, { queue: 'uptime' })).total).toBe(0)
    expect((await loadSiteOperations(now)).find(item => item.label === 'Uptime monitoring gaps')?.value).toBe(0)
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), now)).toMatchObject({ enabled: false, state: 'paused' })
    await scheduleUptimeProbes(fixedClock(now), 1, projectId)
    expect(uptimeQueue.enqueue).not.toHaveBeenCalled()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(retained)
    expect(await prisma.uptimeMonitor.findUnique({ where: { projectId } })).toEqual(retainedMonitor)
    expect(await prisma.uptimeProbe.count({ where: { monitor: { projectId } } })).toBe(monitor ? 2 : 0)
  })

  it('detects sustained inconclusive uptime without calling it an outage or an overdue execution', async () => {
    const now = new Date(), before = new Date(now.getTime() - 3 * UPTIME_INTERVAL_MS)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, state: 'unknown',
      lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 5 * 60_000) } })
    await prisma.uptimeProbe.createMany({ data: [before, new Date(now.getTime() - UPTIME_INTERVAL_MS), now].map(observedAt => ({
      monitorId: monitor.id, version: 1, targetUrl: url, scheduledAt: observedAt, observedAt, attempt: 1,
      result: 'UNKNOWN', reason: 'probe_unavailable', statusCode: null, durationMs: 5,
    })) })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueUptimeProbes: 0, inconclusiveUptimeSites: 1 })
    const operations = await loadOperations(actor, { queue: 'uptime' })
    expect(operations.total).toBe(1)
    expect(operations.rows).toMatchObject([{ siteId: projectId, state: 'Observation remains inconclusive', action: 'SITE_RECONCILE' }])
    expect((await loadSiteOperations(now)).find(item => item.label === 'Uptime monitoring gaps')?.value).toBe(1)
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), now)).toMatchObject({ state: 'unknown', openIncidentCount: 0 })
    expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
    expect(await prisma.uptimeNotification.count({ where: { incident: { monitorId: monitor.id } } })).toBe(0)
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toEqual(monitor)
    for (const result of ['FAILED', 'ONLINE'] as const) {
      const observedAt = new Date(now.getTime() - 60_000)
      const conclusive = await prisma.uptimeProbe.create({ data: { monitorId: monitor.id, version: 1, targetUrl: url,
        scheduledAt: observedAt, observedAt, attempt: 1, result, reason: result === 'ONLINE' ? 'response_received' : 'response_error',
        statusCode: result === 'ONLINE' ? 200 : 503, durationMs: 5 } })
      expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, inconclusiveUptimeSites: 0 })
      expect((await loadOperations(actor, { queue: 'uptime' })).total).toBe(0)
      await prisma.uptimeProbe.delete({ where: { id: conclusive.id } })
    }
    await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { nextProbeAt: before } })
    expect(await readMonitoringHealth(now)).toMatchObject({ overdueUptimeProbes: 1, inconclusiveUptimeSites: 0 })
    expect((await loadOperations(actor, { queue: 'uptime' })).total).toBe(1)
  })

  it('surfaces an overdue confirmation before the routine probe is overdue and clears it after replay', async () => {
    const now = new Date()
    const dueAt = new Date(now.getTime() - 65_000)
    const firstAt = new Date(dueAt.getTime() - UPTIME_CONFIRMATION_MS)
    const scheduledAt = new Date(uptimeSlotStart(firstAt.getTime()))
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, nextProbeAt: scheduledAt } })
    const job = { monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const }
    const confirmation = { ...job, attempt: 2 as const }
    uptimeQueue.enqueue.mockRejectedValueOnce(new Error('Controlled confirmation delivery failure'))
    await executeUptimeProbe(job, async () => ({ result: 'FAILED', reason: 'response_error',
      statusCode: 503, durationMs: 5, finalUrl: url }), fixedClock(firstAt))
    expect(uptimeQueue.enqueue).toHaveBeenCalledExactlyOnceWith(confirmation, dueAt)
    expect(await readMonitoringHealth(new Date(dueAt.getTime() + 30_000))).toMatchObject({ ok: true, overdueUptimeProbes: 0 })

    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueUptimeProbes: 1, inconclusiveUptimeSites: 0 })
    const operations = await loadOperations(actor, { queue: 'uptime' })
    expect(operations.total).toBe(1)
    expect(operations.rows).toMatchObject([{ siteId: projectId, at: dueAt, action: 'SITE_RECONCILE' }])
    expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)

    await scheduleUptimeProbes(fixedClock(now), 1, projectId)
    expect(uptimeQueue.enqueue).toHaveBeenNthCalledWith(2, confirmation, dueAt)
    await executeUptimeProbe(confirmation, async () => ({ result: 'ONLINE', reason: 'response_received',
      statusCode: 200, durationMs: 5, finalUrl: url }), fixedClock(now))
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueUptimeProbes: 0, inconclusiveUptimeSites: 0 })
    expect((await loadOperations(actor, { queue: 'uptime' })).total).toBe(0)
    expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), now)).toMatchObject({ state: 'online', openIncidentCount: 0 })
  })

  it('requires sustained current-target evidence and refuses old-generation or future conclusive probes', async () => {
    const now = new Date(), old = new Date(now.getTime() - 3 * UPTIME_INTERVAL_MS)
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, version: 2, state: 'unknown',
      lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 5 * 60_000) } })
    const probe = (observedAt: Date, version = 2, targetUrl = url, result = 'UNKNOWN') => prisma.uptimeProbe.create({ data: {
      monitorId: monitor.id, version, targetUrl, observedAt, scheduledAt: observedAt, attempt: 1, result,
      reason: 'probe_unavailable', statusCode: null, durationMs: 5,
    } })
    await probe(now)
    await probe(old, 1)
    await probe(new Date(old.getTime() + 1), 2, 'https://old.example.com/')
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, inconclusiveUptimeSites: 0 })
    await probe(new Date(old.getTime() + 2))
    await probe(new Date(now.getTime() - 60_000), 1, url, 'ONLINE')
    await probe(new Date(now.getTime() - 60_000), 2, 'https://old.example.com/', 'ONLINE')
    await probe(new Date(now.getTime() + 60_000), 2, url, 'ONLINE')
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueUptimeProbes: 0, inconclusiveUptimeSites: 1 })
    for (const change of ['disabled', 'removed', 'suspended', 'care-off'] as const) {
      if (change === 'disabled') await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: false } })
      if (change === 'removed') await prisma.project.update({ where: { id: projectId }, data: { deletedAt: now } })
      if (change === 'suspended') await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
      if (change === 'care-off') await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: null } })
      expect((await readMonitoringHealth(now)).inconclusiveUptimeSites).toBe(0)
      await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: true } })
      await prisma.project.update({ where: { id: projectId }, data: { deletedAt: null, watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
      await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'ACTIVE' } })
    }
  })

  it('accounts for committed Sites without a monitor and recovers setup through existing uptime admission', async () => {
    const now = new Date()
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    // Normal initial setup has the same grace as monitoring lateness.
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueUptimeProbes: 0 })
    const saved = await prisma.project.update({ where: { id: projectId }, data: { createdAt: new Date(now.getTime() - 6 * 60_000) } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueSchedules: 0, overdueUptimeProbes: 1 })
    const operations = await loadOperations(actor, { queue: 'uptime' })
    expect(operations.total).toBe(1)
    expect(operations.rows).toMatchObject([{ siteId: projectId, action: 'SITE_RECONCILE', targetId: projectId }])
    expect((await loadSiteOperations(now)).find(item => item.label === 'Uptime monitoring gaps')?.value).toBe(operations.total)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(saved)
    expect(await prisma.uptimeMonitor.count({ where: { projectId } })).toBe(0)
    await scheduleUptimeProbes(fixedClock(now), 1, projectId)
    expect(uptimeQueue.enqueue).toHaveBeenCalledOnce()
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId } })).toMatchObject({ enabled: true, targetUrl: url })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueUptimeProbes: 0 })
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), now)).toMatchObject({ state: 'unknown', lastCheckedAt: null })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(saved)
    expect(await prisma.audit.count({ where: { projectId } })).toBe(0)
  })

  it('does not treat a private retained target as an overdue uptime probe', async () => {
    const now = new Date()
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.project.update({ where: { id: projectId }, data: { url: 'https://watched-stale.local/', watchInterval: 'DAILY',
      watchNextRunAt: new Date(now.getTime() + 86400_000), createdAt: new Date(now.getTime() - 6 * 60_000) } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueSchedules: 0, overdueUptimeProbes: 0, inconclusiveUptimeSites: 0 })
    expect((await loadOperations(actor, { queue: 'uptime' })).total).toBe(0)
    await prisma.project.update({ where: { id: projectId }, data: { url } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueUptimeProbes: 1, inconclusiveUptimeSites: 0 })
    expect((await loadOperations(actor, { queue: 'uptime' })).rows).toMatchObject([{ siteId: projectId, action: 'SITE_RECONCILE', targetId: projectId }])
    expect(await prisma.uptimeMonitor.count({ where: { projectId } })).toBe(0)
  })

  it('detects an overdue inactive monitor for committed care and recovers through ordinary uptime admission', async () => {
    const now = new Date(), overdue = new Date(now.getTime() - UPTIME_INTERVAL_MS - 60_000)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY',
      watchNextRunAt: null, createdAt: overdue } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, enabled: false,
      state: 'paused', nextProbeAt: overdue } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, overdueSchedules: 0, overdueUptimeProbes: 1, inconclusiveUptimeSites: 0 })
    expect((await loadOperations(actor, { queue: 'uptime' })).rows).toMatchObject([{ siteId: projectId, action: 'SITE_RECONCILE' }])
    expect((await loadSiteOperations(now)).find(item => item.label === 'Uptime monitoring gaps')?.value).toBe(1)
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), now)).toMatchObject({ enabled: true, state: 'unknown' })
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toEqual(monitor)

    await scheduleUptimeProbes(fixedClock(now), 1, projectId)
    expect(uptimeQueue.enqueue).toHaveBeenCalledOnce()
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ enabled: true, state: 'unknown' })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(0)
    expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
    expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
  })

  it('keeps a recently due inactive monitor in grace and excludes obsolete activation after care is turned off', async () => {
    const now = new Date(), overdue = new Date(now.getTime() - UPTIME_INTERVAL_MS - 60_000)
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: null, createdAt: overdue } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, enabled: false,
      state: 'paused', nextProbeAt: new Date(now.getTime() - 60_000) } })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(0)
    await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: true, state: 'online', nextProbeAt: overdue } })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(1)
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true, overdueUptimeProbes: 0, inconclusiveUptimeSites: 0 })
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), now)).toMatchObject({ enabled: false, state: 'paused' })
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ enabled: true, nextProbeAt: overdue })
  })

  it('excludes removed Sites, inactive owners and disabled care from missing-monitor obligations', async () => {
    const now = new Date()
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(now.getTime() + 86400_000), createdAt: new Date(now.getTime() - 6 * 60_000) } })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(1)
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: now } })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(0)
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: null } })
    await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(0)
    await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'ACTIVE' } })
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: null } })
    expect((await readMonitoringHealth(now)).overdueUptimeProbes).toBe(0)
    expect(await prisma.uptimeMonitor.count({ where: { projectId } })).toBe(0)
  })

  it('agrees with operator overdue work and recovers its monitoring state without rewriting the schedule on read', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(Date.now() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: new Date() }
    const scheduled = await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(Date.now() - UPTIME_INTERVAL_MS - 60_000), watchLastError: null, watchConsecutiveFailures: 0 } })
    expect((await loadOperations(actor, { queue: 'schedules' })).rows.map(row => row.id)).toContain(projectId)
    const home = await loadSiteHome(projectId)
    expect(home?.watch.state).toBe('delayed')
    expect(home?.presentation.monitoring.state).toBe('delayed')
    expect((await loadSiteSummaries(userId))[0]?.presentation.monitoring.state).toBe('delayed')
    expect(await readMonitoringHealth()).toMatchObject({ ok: false, overdueSchedules: 1 })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(scheduled)
    await prisma.project.update({ where: { id: projectId }, data: { watchNextRunAt: new Date(Date.now() + 86400_000) } })
    expect((await loadOperations(actor, { queue: 'schedules' })).rows.map(row => row.id)).not.toContain(projectId)
    expect((await loadSiteHome(projectId))?.watch.state).toBe('watching')
    expect((await loadSiteSummaries(userId))[0]?.presentation.monitoring.state).toBe('weekly')
    await prisma.project.update({ where: { id: projectId }, data: { watchNextRunAt: null } })
    // A halted analysis clock does not record the owner's intent to pause.
    expect((await loadSiteHome(projectId))?.watch.state).toBe('delayed')
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: scheduled.watchNextRunAt } })
    expect((await loadSiteHome(projectId))?.watch.state).toBe('off')
    const operations = await loadOperations(actor, { queue: 'schedules' })
    expect(operations.rows.map(row => row.id)).not.toContain(projectId)
    expect((await loadSiteOperations()).find(item => item.label === 'Overdue monitoring schedules')?.value).toBe(operations.total)
    expect(await readMonitoringHealth()).toMatchObject({ ok: true, overdueSchedules: 0, overdueUptimeProbes: 0 })
    // A halted broad analysis clock keeps its cadence and independent uptime care.
    // Fully off care was checked above and has no probe obligation.
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: null } })
    await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, enabled: true, nextProbeAt: scheduled.watchNextRunAt! } })
    const uptime = await loadOperations(actor, { queue: 'uptime' })
    expect(uptime.rows.map(row => row.siteId)).toContain(projectId)
    expect((await loadSiteOperations()).find(item => item.label === 'Uptime monitoring gaps')?.value).toBe(uptime.total)
    expect(await readMonitoringHealth()).toMatchObject({ ok: false, overdueSchedules: 0, overdueUptimeProbes: uptime.total })
    await prisma.uptimeMonitor.updateMany({ where: { projectId }, data: { nextProbeAt: new Date(Date.now() + 60_000) } })
    expect(await readMonitoringHealth()).toMatchObject({ ok: true, overdueUptimeProbes: 0 })
    for (const data of [{ deletedAt: new Date() }, { deletedAt: null }]) {
      await prisma.project.update({ where: { id: projectId }, data })
      await prisma.uptimeMonitor.updateMany({ where: { projectId }, data: { nextProbeAt: scheduled.watchNextRunAt! } })
      expect((await readMonitoringHealth()).overdueUptimeProbes).toBe(data.deletedAt ? 0 : 1)
    }
    await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
    expect(await readMonitoringHealth()).toMatchObject({ ok: true, overdueUptimeProbes: 0 })
  })

  it('retains failed uptime delivery as an operational gap after broad monitoring is paused', async () => {
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, enabled: false,
      nextProbeAt: new Date(Date.now() + 60_000) } })
    const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: url,
      startedAt: new Date(), confirmedAt: new Date(), reason: 'Controlled failure' } })
    const notification = await prisma.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN',
      status: 'FAILED', attempts: 8 } })
    expect(await readMonitoringHealth()).toMatchObject({ ok: false, overdueSchedules: 0, overdueUptimeProbes: 0, undeliveredUptimeAlerts: 1 })
    await prisma.uptimeNotification.update({ where: { id: notification.id }, data: { status: 'SENT' } })
    expect(await readMonitoringHealth()).toMatchObject({ ok: true, undeliveredUptimeAlerts: 0 })
  })

  it('keeps non-Watch records out of the Watch retry queue without rewriting their history', async () => {
    const now = new Date(), old = new Date(now.getTime() - 6 * 60_000)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    const retained = []
    for (const recheckTrigger of [null, 'MANUAL'] as const) {
      for (const watchNotificationStatus of ['PENDING', 'FAILED', 'SENDING'] as const) {
        retained.push(await prisma.audit.create({ data: { url, userId, projectId, recheckTrigger, watchNotificationStatus,
          status: 'COMPLETED', createdAt: old, completedAt: old, improvementProjectedAt: old } }))
      }
    }
    const watch = await prisma.audit.create({ data: { url, userId, projectId, recheckTrigger: 'WATCH',
      watchNotificationStatus: 'PENDING', status: 'COMPLETED', createdAt: old, completedAt: old, improvementProjectedAt: old } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, undeliveredWatchAlerts: 1 })
    const operations = await loadOperations(actor, { queue: 'watch-alerts' })
    expect(operations.total).toBe(1)
    expect(operations.rows).toMatchObject([{ id: watch.id, action: null }])
    expect((await loadSiteOperations(now)).find(item => item.label === 'Monitoring notifications needing attention')?.value).toBe(1)
    for (const record of retained) expect(await prisma.audit.findUniqueOrThrow({ where: { id: record.id } })).toEqual(record)
  })

  it('detects overdue Watch acceptance without rewriting its receipt or calling a live claim failed', async () => {
    const now = new Date(), old = new Date(now.getTime() - 6 * 60_000)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    const alert = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      createdAt: old, completedAt: now, improvementProjectedAt: now, watchNotificationStatus: 'PENDING' } })
    await prisma.audit.create({ data: { url, userId, projectId, status: 'QUEUED', recheckTrigger: 'WATCH',
      createdAt: old, watchNotificationStatus: 'PENDING' } })
    await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      createdAt: old, completedAt: old, watchNotificationStatus: 'PENDING' } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true })
    const overdue = await prisma.audit.update({ where: { id: alert.id }, data: { completedAt: old } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, undeliveredWatchAlerts: 1, undeliveredUptimeAlerts: 0 })
    const operations = await loadOperations(actor, { queue: 'watch-alerts' })
    expect(operations.total).toBe(1)
    expect(operations.rows).toMatchObject([{ id: alert.id, state: 'Awaiting delivery', action: null }])
    expect((await loadSiteOperations(now)).find(item => item.label === 'Monitoring notifications needing attention')?.value).toBe(operations.total)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: alert.id } })).toEqual(overdue)
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationStatus: 'SENDING',
      watchNotificationLeaseUntil: new Date(now.getTime() + 60_000) } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true })
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationLeaseUntil: new Date(now.getTime() - 1) } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false })
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationLeaseUntil: null, completedAt: null } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false })
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationStatus: 'SENT' } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true })
  })

  it('detects overdue uptime acceptance without reporting fresh pending work or live senders as gaps', async () => {
    const now = new Date(), old = new Date(now.getTime() - 6 * 60_000)
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })
    const sessionId = randomUUID()
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const actor = { id: userId, sessionId, role: 'admin', email: userId + '@example.test', authenticatedAt: now }
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, enabled: false, nextProbeAt: now, version: 2 } })
    const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version, targetUrl: url,
      startedAt: old, confirmedAt: old, reason: 'Controlled failure' } })
    const alert = await prisma.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN', createdAt: old,
      status: 'PENDING', nextAttemptAt: now } })
    const obsolete = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version - 1,
      targetUrl: 'https://previous.example/', startedAt: old, confirmedAt: old, recoveredAt: old, reason: 'Retained prior target',
      notifications: { create: { kind: 'RECOVERED', status: 'FAILED', attempts: 8, nextAttemptAt: old } } }, include: { notifications: true } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true })
    const overdue = await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { nextAttemptAt: old } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false, undeliveredUptimeAlerts: 1, undeliveredWatchAlerts: 0 })
    const operations = await loadOperations(actor, { queue: 'uptime-alerts' })
    expect(operations.total).toBe(1)
    expect(operations.rows).toMatchObject([{ id: alert.id, state: 'Awaiting delivery', action: 'UPTIME_NOTIFICATION_RETRY' }])
    expect((await loadSiteOperations(now)).find(item => item.label === 'Uptime notifications needing attention')?.value).toBe(operations.total)
    expect(await prisma.uptimeNotification.findUniqueOrThrow({ where: { id: alert.id } })).toEqual(overdue)
    expect(await prisma.uptimeNotification.findUniqueOrThrow({ where: { id: obsolete.notifications[0].id } })).toEqual(obsolete.notifications[0])
    await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { status: 'SENDING', leaseUntil: new Date(now.getTime() + 60_000) } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true })
    await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { leaseUntil: new Date(now.getTime() - 1) } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false })
    await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { leaseUntil: null } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: false })
    await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { status: 'SENT' } })
    expect(await readMonitoringHealth(now)).toMatchObject({ ok: true })
  })

  it('does not expose owned or unscoped Watch alerts to a provisional Site', async () => {
    const foreignAlert = await prisma.audit.create({ data: { url, userId, status: 'COMPLETED',
      recheckTrigger: 'WATCH', completedAt: new Date(), watchNotificationStatus: 'FAILED',
      watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
    const anonymous = await prisma.audit.create({ data: { url, status: 'COMPLETED', completedAt: new Date() } })
    const provisional = await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(),
      canonicalHost: 'example.com', url, primaryAuditId: anonymous.id } })
    try {
      await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED',
        recheckTrigger: 'WATCH', completedAt: new Date(), watchNotificationStatus: 'FAILED',
        watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
      expect(await readMonitoringHealth()).toMatchObject({ ok: false, undeliveredWatchAlerts: 1 })
      const home = await loadSiteHome(`p_${provisional.id}`)
      expect(home).not.toBeNull()
      expect(home?.watch.alert).toMatchObject({ state: 'none', status: null, attempts: 0, at: null })
    } finally {
      await prisma.provisionalSite.delete({ where: { id: provisional.id } })
      await prisma.audit.deleteMany({ where: { id: { in: [anonymous.id, foreignAlert.id] } } })
    }
  })

  it('does not let delivery activity on an older alert hide a newer undelivered alert', async () => {
    const older = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      completedAt: new Date('2026-09-01T12:00:00Z'), updatedAt: new Date('2026-10-10T12:00:00Z'),
      watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationAttemptCeiling: 5 } })
    const latest = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      completedAt: new Date('2026-09-02T12:00:00Z'), updatedAt: new Date('2026-10-09T12:00:00Z'),
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'undelivered', status: 'FAILED', attempts: 5,
      at: latest.completedAt!.toISOString() })
    await prisma.audit.update({ where: { id: older.id }, data: { watchNotificationAttempts: 3 } })
    await prisma.audit.update({ where: { id: latest.id }, data: { watchNotificationAttempts: 6 } })
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'undelivered', status: 'FAILED', attempts: 6,
      at: latest.completedAt!.toISOString() })
    await prisma.audit.update({ where: { id: latest.id }, data: { watchNotificationStatus: 'SENT' } })
    expect(await readMonitoringHealth()).toMatchObject({ ok: true, undeliveredWatchAlerts: 0 })
    const accepted = await loadSiteHome(projectId)
    expect(accepted?.watch.alert.state).toBe('accepted')
    expect(siteWatchAlertNotice(accepted!.watch.alert)).toBeNull()
  })

  it('leaves the finding date unknown when the alert has no completed check timestamp', async () => {
    await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      completedAt: null, updatedAt: new Date('2026-10-10T12:00:00Z'),
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'undelivered', at: null })
  })

  it('shows a terminal provider failure for the exact accepted Watch alert', async () => {
    const providerId = randomUUID(), completedAt = new Date()
    const alert = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      completedAt, watchNotificationStatus: 'SENT', watchNotificationAttempts: 1, watchNotificationProviderId: providerId } })
    const load = (ownerEvidence = true) => loadSiteHome(projectId, { ownerEvidence })
    expect((await load())?.watch.alert).toMatchObject({ state: 'accepted', status: 'SENT', attempts: 1 })
    await prisma.emailDelivery.create({ data: { providerId, userId, recipientHash: 'fixture', sourceId: 'different-audit',
      channel: 'watch', acceptedAt: completedAt, firstAttemptAt: completedAt, failedAt: completedAt } })
    expect((await load())?.watch.alert.state).toBe('accepted')
    await prisma.emailDelivery.update({ where: { providerId }, data: { sourceId: alert.id, channel: 'summary' } })
    expect((await load())?.watch.alert.state).toBe('accepted')
    await prisma.emailDelivery.update({ where: { providerId }, data: { channel: 'watch' } })
    expect((await load())?.watch.alert.state).toBe('undelivered')
    const deliveredAt = new Date(completedAt.getTime() + 1)
    await prisma.emailDelivery.update({ where: { providerId }, data: { deliveredAt } })
    expect((await load())?.watch.alert.state).toBe('accepted')
    await prisma.emailDelivery.update({ where: { providerId }, data: { bouncedAt: deliveredAt } })
    const home = await load()
    expect(home?.watch.alert).toMatchObject({ state: 'undelivered', status: 'SENT', attempts: 1, at: completedAt.toISOString() })
    expect(siteWatchAlertNotice(home!.watch.alert)?.actionHref).toBe('/settings')
    expect((await load(false))?.watch.alert.state).toBe('accepted')
    const otherOwner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    try {
      await prisma.project.update({ where: { id: projectId }, data: { userId: otherOwner.id } })
      expect((await load())?.watch.alert.state).toBe('accepted')
    } finally {
      await prisma.project.update({ where: { id: projectId }, data: { userId } })
      await prisma.user.delete({ where: { id: otherOwner.id } })
    }
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: alert.id } }))
      .toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 1 })
  })

  it('uses the projected saved attempt ceiling in the customer notice', async () => {
    const alert = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH', completedAt: new Date(),
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 6, watchNotificationAttemptCeiling: 10 } })
    const home = await loadSiteHome(projectId)
    expect(home?.watch.alert.state).toBe('delivering')
    expect(siteWatchAlertNotice(home!.watch.alert)).toBeNull()
    const leaseUntil = new Date(Date.now() + 60_000)
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationAttempts: 10,
      watchNotificationStatus: 'SENDING', watchNotificationLeaseUntil: leaseUntil } })
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'delivering', leaseUntil: leaseUntil.toISOString() })
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationLeaseUntil: new Date(0) } })
    const exhausted = await loadSiteHome(projectId)
    expect(exhausted?.watch.alert.state).toBe('undelivered')
    expect(siteWatchAlertNotice(exhausted!.watch.alert)).not.toBeNull()
  })
})
