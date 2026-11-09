import { uptimeReadSite } from './__tests__/read-site'
import { rejectMonitorSetup } from './__tests__/setup-failure'
import { fixedClock, systemClock } from '@/lib/time/clock'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@prisma/client'
import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'
import { registerSiteOutcomeTools } from '@/lib/mcp/tools/sites'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { uptimeHistorySchema } from './contracts'
import { probeUptime } from './probe'
import { PublicResponseBodyError } from '@/lib/audit/http-evidence'
import * as betaPolicy from '@/lib/billing/beta-policy'

const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null, enqueue: vi.fn() }))
const databaseUrl = process.env.UPTIME_TEST_DATABASE_URL
vi.mock('@/lib/db', async () => {
  if (!process.env.UPTIME_TEST_DATABASE_URL) return { prisma: {} }
  if (!new URL(process.env.UPTIME_TEST_DATABASE_URL).pathname.includes('uptime_test')) throw new Error('Uptime integration tests require a disposable uptime_test database')
  const clientPath = process.env.UPTIME_TEST_CLIENT_PATH
  const client = clientPath ? await import(/* @vite-ignore */ clientPath) : await import('@prisma/client')
  fixture.db = new client.PrismaClient({ datasourceUrl: process.env.UPTIME_TEST_DATABASE_URL })
  return { prisma: fixture.db }
})
vi.mock('./queue', () => ({ enqueueUptimeProbe: fixture.enqueue }))
import { executeUptimeProbe, initializeUptimeMonitors, retainUptimeHistory, scheduleUptimeProbes } from './service'
import * as monitoringSetup from '@/lib/sites/application/monitoring-setup'
import { initializeDefaultMonitoring, MONITORING_SCHEDULE_UNAVAILABLE } from '@/lib/sites/application/default-monitoring'
import { setProjectWatch } from '@/lib/sites/application/monitoring-settings'
import { loadUptimeHistory, loadUptimeStatus, loadUptimeSummary } from './queries'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { UPTIME_CONFIRMATION_MS, UPTIME_INTERVAL_MS, UPTIME_RETENTION_MS, type ProbeObservation } from './domain'

const db = () => fixture.db!
const originTime = new Date('2026-10-12T12:00:00.000Z')
const online: ProbeObservation = { result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 50, finalUrl: 'https://example.com/' }
const failed: ProbeObservation = { ...online, result: 'FAILED', reason: 'response_error', statusCode: 503 }
async function mcpCall(viewer: User, name: string, args: Record<string, unknown>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = new McpServer({ name: 'uptime-evidence', version: '1.0.0' }, { capabilities: { tools: {} } })
  const client = new Client({ name: 'uptime-reader', version: '1.0.0' })
  registerSiteOutcomeTools(server, viewer)
  try {
    await server.connect(serverTransport); await client.connect(clientTransport)
    const result = await client.callTool({ name, arguments: args })
    const content = result.content as Array<{ type: string; text?: string }>
    expect(JSON.parse(content.find(item => item.type === 'text')?.text ?? '{}')).toEqual(result.structuredContent)
    return result
  } finally { await client.close(); await server.close() }
}
async function monitorFixture() {
  const user = await db().user.create({ data: { email: 'owner@uptime-test.example', role: 'admin', preferredTools: [], auditsUsed: 3 } })
  const project = await db().project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com', url: 'https://example.com/',
    watchInterval: 'WEEKLY', watchNextRunAt: new Date(originTime.getTime() + 86400_000) } })
  const monitor = await db().uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url, nextProbeAt: originTime } })
  return { user, project, monitor, job: { monitorId: monitor.id, version: 1, scheduledAt: originTime.toISOString(), attempt: 1 as const } }
}

describe.skipIf(!databaseUrl)('Uptime persistence and scheduling', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(originTime)
    fixture.enqueue.mockReset()
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
  })
  afterAll(async () => {
    vi.useRealTimers()
    try { await fixture.db?.user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } }) }
    finally { await fixture.db?.$disconnect() }
  })

  it('honors Pause monitoring for uptime while retaining the cadence for resume', async () => {
    const { project, user, job, monitor } = await monitorFixture()
    expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'pause' })).toMatchObject({ ok: true })
    expect(await db().project.findUniqueOrThrow({ where: { id: project.id } }))
      .toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: null, watchPausedAt: originTime })
    vi.setSystemTime(new Date(originTime.getTime() + 1000))
    expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'pause' })).toMatchObject({ ok: true })
    expect((await db().project.findUniqueOrThrow({ where: { id: project.id } })).watchPausedAt).toEqual(originTime)
    expect(await loadSiteHome(project.id, { ownerEvidence: true })).toMatchObject({ watch: { state: 'paused' },
      presentation: { monitoring: { state: 'paused' } }, uptime: { enabled: false, state: 'paused' } })
    expect((await loadSiteSummaries(user.id))[0].presentation.monitoring.state).toBe('paused')
    await scheduleUptimeProbes(systemClock, 10)
    expect(fixture.enqueue).not.toHaveBeenCalled()
    const observe = vi.fn(async () => online)
    await executeUptimeProbe(job, observe)
    expect(observe).not.toHaveBeenCalled()
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
    expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'resume' })).toMatchObject({ ok: true })
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      enabled: true, state: 'unknown', version: monitor.version, nextProbeAt: originTime, lastCheckedAt: null,
    })
    expect(fixture.enqueue).not.toHaveBeenCalled()
    await scheduleUptimeProbes(systemClock, 10)
    expect(fixture.enqueue).toHaveBeenCalledOnce()
    await executeUptimeProbe(fixture.enqueue.mock.calls[0][0], observe)
    expect(observe).toHaveBeenCalledOnce()
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ state: 'online' })
    expect(await loadSiteHome(project.id, { ownerEvidence: true })).toMatchObject({ watch: { state: 'watching' },
      presentation: { monitoring: { state: 'weekly' } }, uptime: { enabled: true, state: 'online' } })
    expect((await loadSiteSummaries(user.id))[0].presentation.monitoring.state).toBe('weekly')
  })

  it('keeps the next unused slot when a retained probe arrives after pause and resume', async () => {
    const { project, user, monitor, job } = await monitorFixture()
    const observe = vi.fn(async () => online)
    await executeUptimeProbe(job, observe)
    expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'pause' })).toMatchObject({ ok: true })
    expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'resume' })).toMatchObject({ ok: true })

    const next = new Date(originTime.getTime() + UPTIME_INTERVAL_MS)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      version: 1, enabled: true, lastScheduledAt: originTime, nextProbeAt: next,
    })
    await executeUptimeProbe(job, observe)
    await expect(scheduleUptimeProbes(fixedClock(originTime), 1, project.id)).resolves.toEqual({ published: 0, failed: 0 })
    expect(fixture.enqueue).not.toHaveBeenCalled()
    expect(observe).toHaveBeenCalledOnce()

    const nextClock = fixedClock(next)
    await expect(scheduleUptimeProbes(nextClock, 1, project.id)).resolves.toEqual({ published: 1, failed: 0 })
    await executeUptimeProbe(fixture.enqueue.mock.calls[0][0], observe, nextClock)
    expect(observe).toHaveBeenCalledTimes(2)
    expect(await db().uptimeProbe.findMany({ where: { monitorId: monitor.id }, orderBy: { scheduledAt: 'asc' } }))
      .toMatchObject([{ scheduledAt: originTime }, { scheduledAt: next }])
  })

  it('provisions uptime in the first explicit schedule save and keeps it on repeat saves', async () => {
    const { project, user, monitor } = await monitorFixture()
    await db().uptimeMonitor.delete({ where: { id: monitor.id } })
    await db().project.update({ where: { id: project.id }, data: { watchInterval: null, watchNextRunAt: null,
      uptimeSetupRetryAt: new Date(originTime.getTime() + 60_000) } })
    const input = { projectId: project.id, userId: user.id, interval: 'weekly' as const }
    expect(await setProjectWatch(input)).toMatchObject({ ok: true })
    const saved = await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: project.id } })
    expect(saved).toMatchObject({ enabled: true, targetUrl: project.url, nextProbeAt: originTime, lastCheckedAt: null })
    expect(await db().project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ watchNextRunAt: originTime, uptimeSetupRetryAt: null })
    expect(await setProjectWatch(input, { clock: fixedClock(new Date(originTime.getTime() + UPTIME_INTERVAL_MS)) })).toMatchObject({ ok: true })
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved)
    expect(fixture.enqueue).not.toHaveBeenCalled()
  })

  it('projects a limited analysis clock separately from active uptime in Site home and list', async () => {
    const { project, user, job } = await monitorFixture()
    await db().project.update({ where: { id: project.id }, data: { watchNextRunAt: null,
      watchLastError: 'This month’s Site check allowance is used.' } })
    await executeUptimeProbe(job, async () => online)
    expect(await loadSiteHome(project.id, { ownerEvidence: true })).toMatchObject({ watch: { state: 'quota' },
      presentation: { monitoring: { state: 'quota_blocked' } }, uptime: { enabled: true, state: 'online' } })
    expect((await loadSiteSummaries(user.id))[0].presentation.monitoring.state).toBe('quota_blocked')
  })

  it('starts default uptime even when restoring the saved analysis cadence is deferred', async () => {
    const user = await db().user.create({ data: { email: 'free@uptime-test.example', preferredTools: [] } })
    const project = await db().project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com',
      url: 'https://example.com/', watchInterval: 'DAILY', watchLastError: MONITORING_SCHEDULE_UNAVAILABLE } })
    const clock = fixedClock(originTime)
    const beta = vi.spyOn(betaPolicy, 'hasOpenBetaAccess').mockReturnValue(false)
    try { await initializeDefaultMonitoring(1, clock) }
    finally { beta.mockRestore() }
    expect(await db().project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
      watchInterval: 'DAILY', watchNextRunAt: null, monitoringSetupRetryAt: new Date(originTime.getTime() + 60_000),
    })

    await scheduleUptimeProbes(clock, 1, project.id)
    const monitor = await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: project.id } })
    const job = { monitorId: monitor.id, version: monitor.version, scheduledAt: originTime.toISOString(), attempt: 1 as const }
    expect(fixture.enqueue).toHaveBeenCalledExactlyOnceWith(job, originTime)
    await executeUptimeProbe(job, async () => online, clock)
    expect(await loadUptimeSummary(uptimeReadSite(project), originTime)).toMatchObject({ enabled: true, state: 'online' })
    expect(await db().project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
      watchNextRunAt: null, monitoringSetupRetryAt: new Date(originTime.getTime() + 60_000),
    })
  })

  it('keeps incident history when monitoring is paused and resumed during an observation', async () => {
    const { project, user, job, monitor } = await monitorFixture()
    const incident = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version,
      targetUrl: project.url, startedAt: originTime, confirmedAt: originTime, reason: 'response_error' } })
    const observe = vi.fn(async () => {
      expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'pause' })).toMatchObject({ ok: true })
      expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ enabled: false, state: 'paused' })
      expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'resume' })).toMatchObject({ ok: true })
      return online
    })
    await executeUptimeProbe(job, observe)
    expect(observe).toHaveBeenCalledOnce()
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
    expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ enabled: true, state: 'unknown', incidentOpen: true })
    expect(await db().uptimeNotification.count({ where: { incidentId: incident.id } })).toBe(0)
    await scheduleUptimeProbes(systemClock, 10)
    await executeUptimeProbe(fixture.enqueue.mock.calls[0][0], async () => online)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: originTime })
    expect(await db().uptimeNotification.findMany({ where: { incidentId: incident.id } }))
      .toEqual([expect.objectContaining({ kind: 'RECOVERED' })])
  })

  it('migrates known explicit pauses without converting plan limits or a missing analysis clock into a pause', async () => {
    const sql = await readFile(new URL('../../prisma/migrations/20261026190000_project_monitoring_pause/migration.sql', import.meta.url), 'utf8')
    await db().$transaction(async tx => {
      await tx.$executeRaw`CREATE TEMP TABLE projects (id text, "updatedAt" timestamp NOT NULL,
        "watchNextRunAt" timestamp, "watchLastError" text) ON COMMIT DROP`
      await tx.$executeRaw`INSERT INTO projects VALUES ('paused', ${originTime}, NULL, 'Paused. This Site is not on a check schedule.'),
        ('legacy-paused', ${originTime}, NULL, 'Paused.'), ('halted', ${originTime}, NULL, NULL),
        ('quota', ${originTime}, NULL, 'Watch paused because this month’s Site check allowance is used.'),
        ('resumed', ${originTime}, ${originTime}, 'Paused.')`
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement)
      expect(await tx.$queryRaw`SELECT id, "watchPausedAt" FROM projects ORDER BY id`).toEqual([
        { id: 'halted', watchPausedAt: null }, { id: 'legacy-paused', watchPausedAt: originTime },
        { id: 'paused', watchPausedAt: originTime }, { id: 'quota', watchPausedAt: null }, { id: 'resumed', watchPausedAt: null },
      ])
    })
  })

  it('publishes the current slot after a dispatch claim crosses the slot boundary', async () => {
    const { monitor, project } = await monitorFixture()
    const selectedAt = new Date(originTime.getTime() + 4 * 60_000 + 59_000)
    const publishedAt = new Date(originTime.getTime() + 5 * 60_000 + 1000)
    vi.setSystemTime(selectedAt)
    const original = db().$executeRaw.bind(db())
    const boundary = vi.spyOn(db(), '$executeRaw').mockImplementationOnce(async (query, ...values) => {
      const claimed = await original(query, ...values)
      vi.setSystemTime(publishedAt)
      return claimed
    })
    try {
      await scheduleUptimeProbes(systemClock, 1, project.id)
      const job = { monitorId: monitor.id, version: 1, scheduledAt: new Date(originTime.getTime() + 5 * 60_000).toISOString(), attempt: 1 as const }
      expect(fixture.enqueue).toHaveBeenCalledExactlyOnceWith(job, publishedAt)
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } }))
        .toMatchObject({ lastDispatchAttemptAt: selectedAt })
      await executeUptimeProbe(job, async () => online)
      expect(await db().uptimeProbe.findFirst({ where: { monitorId: monitor.id } }))
        .toMatchObject({ result: 'ONLINE', observedAt: publishedAt })
    } finally { boundary.mockRestore() }
  })

  it.each(['ONLINE', 'FAILED'] as const)('keeps the next slot due when a late %s probe crosses its boundary', async result => {
    const { project, monitor, job } = await monitorFixture()
    const nextSlot = new Date(originTime.getTime() + 5 * 60_000)
    const completedAt = new Date(nextSlot.getTime() + 2_000)
    const nextJob = { ...job, scheduledAt: nextSlot.toISOString() }
    vi.setSystemTime(new Date(nextSlot.getTime() - 2_000))
    await executeUptimeProbe(job, async () => {
      vi.setSystemTime(completedAt)
      return result === 'FAILED' ? failed : online
    })
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      lastScheduledAt: originTime, lastCheckedAt: completedAt, nextProbeAt: nextSlot,
    })

    if (result === 'FAILED') {
      const confirmAt = new Date(completedAt.getTime() + 30_000)
      const confirmation = { ...job, attempt: 2 as const }
      expect(fixture.enqueue).toHaveBeenCalledExactlyOnceWith(confirmation, confirmAt)
      fixture.enqueue.mockClear()
      await scheduleUptimeProbes(systemClock, 1, project.id)
      expect(fixture.enqueue).not.toHaveBeenCalled()
      const prematureProbe = vi.fn(async () => online)
      await executeUptimeProbe(nextJob, prematureProbe)
      expect(prematureProbe).not.toHaveBeenCalled()
      vi.setSystemTime(confirmAt)
      await executeUptimeProbe(confirmation, async () => failed)
      expect(await db().uptimeIncident.findFirst({ where: { monitorId: monitor.id } }))
        .toMatchObject({ confirmedAt: confirmAt, recoveredAt: null })
    }

    await scheduleUptimeProbes(systemClock, 1, project.id)
    expect(fixture.enqueue).toHaveBeenCalledExactlyOnceWith(nextJob, new Date())
    await executeUptimeProbe(nextJob, async () => online)
    expect(await db().uptimeProbe.findFirst({ where: { monitorId: monitor.id, scheduledAt: nextSlot } }))
      .toMatchObject({ result: 'ONLINE' })
    expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id, recoveredAt: null } })).toBe(0)
  })

  it.each(['before dispatch', 'during the response'] as const)('releases the next regular slot when confirmation expires %s', async scenario => {
    const { project, monitor, job } = await monitorFixture()
    const expiresAt = new Date(originTime.getTime() + UPTIME_INTERVAL_MS)
    const nextJob = { ...job, scheduledAt: expiresAt.toISOString() }
    await executeUptimeProbe(job, async () => failed)
    const site = uptimeReadSite(project)
    expect(await loadUptimeStatus(site, new Date(expiresAt.getTime() - 1))).toMatchObject({
      state: 'checking', nextCheckAt: new Date(originTime.getTime() + UPTIME_CONFIRMATION_MS).toISOString(),
    })
    fixture.enqueue.mockClear()

    if (scenario === 'during the response') {
      vi.setSystemTime(new Date(expiresAt.getTime() - 1_000))
      await executeUptimeProbe({ ...job, attempt: 2 }, async () => {
        vi.setSystemTime(expiresAt)
        return failed
      })
      expect(await db().uptimeProbe.findFirstOrThrow({ where: { monitorId: monitor.id, attempt: 2 } })).toMatchObject({
        result: 'FAILED', confirmed: false, scheduledAt: originTime, observedAt: expiresAt,
      })
    } else vi.setSystemTime(expiresAt)
    const status = { state: 'unknown', lastCheckedAt: (scenario === 'before dispatch' ? originTime : expiresAt).toISOString(),
      nextCheckAt: expiresAt.toISOString(), incidentOpen: false }
    expect(await loadUptimeStatus(site, expiresAt)).toMatchObject(status)
    expect(await loadUptimeSummary(site, expiresAt)).toMatchObject(status)
    expect(await loadUptimeHistory(site, '24h', null, expiresAt)).toMatchObject({ ...status,
      probes: expect.arrayContaining([expect.objectContaining({ attempt: 1, result: 'FAILED', confirmed: false })]) })
    expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
    await scheduleUptimeProbes(systemClock, 1, project.id)
    expect(fixture.enqueue).toHaveBeenCalledExactlyOnceWith(nextJob, expiresAt)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      nextProbeAt: expiresAt, pendingFailureAt: null, pendingSlotAt: null, confirmationDueAt: null, state: 'unknown',
    })

    await executeUptimeProbe(nextJob, async () => failed)
    const confirmedAt = new Date(expiresAt.getTime() + UPTIME_CONFIRMATION_MS)
    vi.setSystemTime(confirmedAt)
    await executeUptimeProbe({ ...nextJob, attempt: 2 }, async () => failed)
    const incidents = await db().uptimeIncident.findMany({ where: { monitorId: monitor.id }, include: { notifications: true } })
    expect(incidents).toEqual([expect.objectContaining({ startedAt: expiresAt, confirmedAt,
      notifications: [expect.objectContaining({ kind: 'DOWN', status: 'PENDING' })] })])
  })

  it.each([60_000, 6 * 60_000])('refreshes probe admission after a %s ms authority read', async delay => {
    const fixture = await monitorFixture(), read = db().project.findUnique.bind(db().project)
    const lookup = vi.spyOn(db().project, 'findUnique').mockImplementation(async input => {
      const value = await read(input)
      vi.setSystemTime(new Date(originTime.getTime() + delay))
      return value
    })
    const observe = vi.fn(async () => {
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: fixture.monitor.id } }))
        .toMatchObject({ leaseUntil: new Date(originTime.getTime() + delay + 30_000) })
      return online
    })
    try {
      await executeUptimeProbe(fixture.job, observe)
      expect(observe).toHaveBeenCalledTimes(delay < 5 * 60_000 ? 1 : 0)
      expect(await db().uptimeProbe.count({ where: { monitorId: fixture.monitor.id } })).toBe(delay < 5 * 60_000 ? 1 : 0)
    } finally { lookup.mockRestore() }
  })

  it('claims overlapping jobs once and does not create an analysis or consume credits', async () => {
    const { job, user } = await monitorFixture()
    const observe = vi.fn(async () => online)
    await Promise.all([executeUptimeProbe(job, observe), executeUptimeProbe(job, observe)])
    await executeUptimeProbe(job, observe)
    expect(observe).toHaveBeenCalledOnce()
    expect(await db().uptimeProbe.count()).toBe(1)
    expect(await db().audit.count()).toBe(0)
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
  })

  it('dispatches existing and newly initialized monitors after another Site fails setup, then retries that Site', async () => {
    const { user, monitor } = await monitorFixture()
    const projects = []
    for (const [index, host] of ['setup-failure.example.com', 'setup-success.example.com'].entries()) {
      projects.push(await db().project.create({ data: { userId: user.id, name: host, canonicalHost: host, url: `https://${host}/`,
        watchInterval: 'WEEKLY', watchNextRunAt: originTime, createdAt: new Date(originTime.getTime() - 2000 + index * 1000) } }))
    }
    const allowSetup = await rejectMonitorSetup(db(), [projects[0].id])
    try {
      await scheduleUptimeProbes(fixedClock(originTime), 10)
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: projects[0].id } })).toBeNull()
      const initialized = await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: projects[1].id } })
      expect(fixture.enqueue).toHaveBeenCalledTimes(2)
      for (const id of [monitor.id, initialized.id])
        expect(fixture.enqueue).toHaveBeenCalledWith(expect.objectContaining({ monitorId: id, attempt: 1 }), originTime)
    } finally { await allowSetup() }
    fixture.enqueue.mockClear()
    const retryAt = new Date(originTime.getTime() + 120_000)
    await scheduleUptimeProbes(fixedClock(retryAt), 10, projects[0].id)
    const retried = await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: projects[0].id } })
    expect(fixture.enqueue).toHaveBeenCalledOnce()
    expect(fixture.enqueue).toHaveBeenCalledWith(expect.objectContaining({ monitorId: retried.id, attempt: 1 }), retryAt)
    expect(await db().audit.count()).toBe(0)
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
  })

  it.each(['pause', 'target'] as const)('rechecks a changed %s before creating a selected Site monitor', async change => {
    const { user } = await monitorFixture()
    const site = await db().project.create({ data: { userId: user.id, name: 'Selected setup', canonicalHost: 'selected.example.com',
      url: 'https://selected.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: originTime } })
    const replacement = 'https://replacement.example.com/'
    const select = monitoringSetup.selectMonitoringSetupSites
    const boundary = vi.spyOn(monitoringSetup, 'selectMonitoringSetupSites').mockImplementationOnce(async (...args) => {
      const rows = await select(...args)
      expect(rows.map(row => row.id)).toEqual([site.id])
      await db().project.update({ where: { id: site.id }, data: change === 'pause' ? { watchPausedAt: originTime } : { url: replacement } })
      return rows
    })
    try {
      await initializeUptimeMonitors(fixedClock(originTime), 1, site.id)
      expect(await db().uptimeMonitor.count({ where: { projectId: site.id } })).toBe(0)
      expect(await db().project.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({ uptimeSetupRetryAt: null })
    } finally { boundary.mockRestore() }
    if (change === 'pause') await db().project.update({ where: { id: site.id }, data: { watchPausedAt: null } })
    await initializeUptimeMonitors(fixedClock(originTime), 1, site.id)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: site.id } }))
      .toMatchObject({ targetUrl: change === 'target' ? replacement : site.url, nextProbeAt: originTime })
  })

  it.each(['uptime', 'watch'] as const)('initializes independent %s setup while a selected transaction is still open', async kind => {
    const firstOwner = await db().user.create({ data: { email: `${kind}-first@uptime-test.example`, role: 'admin' } })
    const secondOwner = kind === 'uptime' ? firstOwner : await db().user.create({ data: { email: `${kind}-second@uptime-test.example`, role: 'admin' } })
    const [slow, ready] = await Promise.all([firstOwner, secondOwner].map((owner, index) => {
      const host = `${kind}-setup-${index}.example.com`
      return db().project.create({ data: { userId: owner.id, name: host, canonicalHost: host, url: `https://${host}/`,
        createdAt: new Date(index + 1), ...(kind === 'uptime' ? { watchInterval: 'WEEKLY', watchNextRunAt: originTime } : {}) } })
    }))
    let entered!: () => void, release!: () => void
    const active = new Promise<void>(resolve => { entered = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const select = monitoringSetup.selectMonitoringSetupSites
    const boundary = vi.spyOn(monitoringSetup, 'selectMonitoringSetupSites').mockImplementation(async (...args) => {
      const rows = await select(...args)
      if (args[5]?.id === slow.id && rows.length) {
        entered()
        await gate
      }
      return rows
    })
    const clock = fixedClock(originTime)
    const pending = kind === 'uptime' ? initializeUptimeMonitors(clock, 2) : initializeDefaultMonitoring(2, clock)
    const setup = async (id: string) => kind === 'uptime'
      ? db().uptimeMonitor.count({ where: { projectId: id } })
      : db().project.count({ where: { id, watchInterval: { not: null }, watchNextRunAt: originTime } })
    try {
      await Promise.race([active, pending.then(() => { throw new Error('Setup did not reach the controlled transaction') })])
      await vi.waitFor(async () => expect(await setup(ready.id)).toBe(1), { timeout: 2000, interval: 20 })
      expect(await setup(slow.id)).toBe(0)
      release()
      await pending
      expect(await setup(slow.id)).toBe(1)
    } finally { release(); await pending; boundary.mockRestore() }
  })

  it('advances bounded monitor initialization past repeated setup failures', async () => {
    const { user } = await monitorFixture()
    const sites = await Promise.all(['failed-initialization', 'following-initialization'].map((host, index) => db().project.create({ data: {
      userId: user.id, name: host, url: 'https://' + host + '.example.com/', canonicalHost: host + '.example.com',
      watchInterval: 'WEEKLY', watchNextRunAt: originTime, createdAt: new Date('2000-01-0' + (index + 1) + 'T00:00:00Z'),
    } })))
    const allowSetup = await rejectMonitorSetup(db(), [sites[0].id])
    try {
      await scheduleUptimeProbes(fixedClock(originTime), 1)
      await scheduleUptimeProbes(fixedClock(originTime), 1)
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: sites[0].id } })).toBeNull()
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: sites[1].id } })).not.toBeNull()
      expect(await db().project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ uptimeSetupRetryAt: new Date(originTime.getTime() + 60_000),
        watchInterval: 'WEEKLY', watchLastError: null })
      await allowSetup()
      await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 30_000)), 1, sites[0].id)
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: sites[0].id } })).toBeNull()
      await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 120_000)), 1, sites[0].id)
      expect(await db().uptimeMonitor.count({ where: { projectId: sites[0].id } })).toBe(1)
      expect(await db().project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ uptimeSetupRetryAt: null })
    } finally { await allowSetup() }
  })
  it('does not let an unsafe legacy target occupy every initialization batch', async () => {
    const { user } = await monitorFixture()
    const unsafe = await db().project.create({ data: { userId: user.id, name: 'Unsafe retained target', url: 'http://127.0.0.1/',
      canonicalHost: '127.0.0.1', watchInterval: 'WEEKLY', watchNextRunAt: originTime, createdAt: new Date('2000-01-01') } })
    const following = await db().project.create({ data: { userId: user.id, name: 'Public following target', url: 'https://following.example.com/',
      canonicalHost: 'following.example.com', watchInterval: 'WEEKLY', watchNextRunAt: originTime, createdAt: new Date('2000-01-02') } })
    await scheduleUptimeProbes(fixedClock(originTime), 1)
    await scheduleUptimeProbes(fixedClock(originTime), 1)
    expect(await db().uptimeMonitor.findUnique({ where: { projectId: unsafe.id } })).toBeNull()
    expect(await db().project.findUniqueOrThrow({ where: { id: unsafe.id } })).toMatchObject({
      uptimeSetupRetryAt: new Date(originTime.getTime() + monitoringSetup.MONITORING_SETUP_UNAVAILABLE_RETRY_MS),
    })
    expect(await db().uptimeMonitor.findUnique({ where: { projectId: following.id } })).not.toBeNull()
    expect(await db().uptimeIncident.count()).toBe(0)
  })
  it('admits a retained target once its saved URL is public', async () => {
    const { user } = await monitorFixture()
    const retained = await db().project.create({ data: { userId: user.id, name: 'Retained private target', url: 'https://watched-stale.local/',
      canonicalHost: 'watched-stale.local', watchInterval: 'WEEKLY', watchNextRunAt: originTime, createdAt: new Date('2000-01-01') } })
    await scheduleUptimeProbes(fixedClock(originTime), 1, retained.id)
    expect(await db().uptimeMonitor.findUnique({ where: { projectId: retained.id } })).toBeNull()
    await db().project.update({ where: { id: retained.id }, data: { url: 'https://retained.example.com/', canonicalHost: 'retained.example.com' } })
    await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 60_000)), 1, retained.id)
    expect(await db().uptimeMonitor.findUnique({ where: { projectId: retained.id } })).toBeNull()
    const retryAt = new Date(originTime.getTime() + monitoringSetup.MONITORING_SETUP_UNAVAILABLE_RETRY_MS)
    await scheduleUptimeProbes(fixedClock(retryAt), 1, retained.id)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: retained.id } })).toMatchObject({ enabled: true, targetUrl: 'https://retained.example.com/' })
    expect(await db().project.findUniqueOrThrow({ where: { id: retained.id } })).toMatchObject({ uptimeSetupRetryAt: null })
  })
  it.each([true, false])('gives later due monitors a turn while an earlier dispatch remains pending (failure: %s)', async (rejectDispatch) => {
    const { user, monitor } = await monitorFixture()
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { nextProbeAt: new Date(originTime.getTime() - 60_000) } })
    const following = await db().project.create({ data: { userId: user.id, name: 'Following', canonicalHost: 'following.example.com',
      url: 'https://following.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: originTime } })
    const later = await db().uptimeMonitor.create({ data: { projectId: following.id, targetUrl: following.url, nextProbeAt: originTime } })
    fixture.enqueue.mockImplementation(async (job) => {
      if (rejectDispatch && job.monitorId === monitor.id) throw new Error('Controlled persistent enqueue failure')
    })
    await scheduleUptimeProbes(fixedClock(originTime), 1)
    await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 1000)), 1)
    expect(fixture.enqueue.mock.calls.map(([job]) => job.monitorId)).toEqual([monitor.id, later.id])
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      nextProbeAt: new Date(originTime.getTime() - 60_000), lastCheckedAt: null, lastScheduledAt: null,
      lastDispatchAttemptAt: originTime,
    })
    expect(await db().uptimeProbe.count()).toBe(0)
    expect(await db().uptimeIncident.count()).toBe(0)
    await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 2000)), 1)
    expect(fixture.enqueue.mock.calls.at(-1)?.[0].monitorId).toBe(monitor.id)
  })

  it('dispatches a due confirmation in its fair turn using the original failure slot', async () => {
    const { user, monitor } = await monitorFixture()
    const site = await db().project.create({ data: { userId: user.id, name: 'Confirmation', canonicalHost: 'confirm.example.com',
      url: 'https://confirm.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: originTime } })
    const pendingSlotAt = new Date(originTime.getTime() - 30_000)
    const confirmation = await db().uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url,
      nextProbeAt: new Date(originTime.getTime() + 300_000), pendingSlotAt, pendingFailureAt: pendingSlotAt, confirmationDueAt: originTime } })
    fixture.enqueue.mockRejectedValueOnce(new Error('Controlled earlier dispatch failure'))
    await scheduleUptimeProbes(fixedClock(originTime), 1)
    await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 1000)), 1)
    expect(fixture.enqueue.mock.calls.map(([job]) => job.monitorId)).toEqual([monitor.id, confirmation.id])
    expect(fixture.enqueue).toHaveBeenLastCalledWith({ monitorId: confirmation.id, version: 1, scheduledAt: pendingSlotAt.toISOString(), attempt: 2 }, originTime)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: confirmation.id } })).toMatchObject({
      pendingSlotAt, pendingFailureAt: pendingSlotAt, confirmationDueAt: originTime, lastCheckedAt: null,
    })
    expect(await db().uptimeIncident.count()).toBe(0)
  })

  it.each(['pause', 'retarget', 'suspend', 'lease'] as const)('refuses publication when %s changes after selection', async change => {
    const { user, project, monitor } = await monitorFixture()
    const original = db().$executeRaw.bind(db())
    const boundary = vi.spyOn(db(), '$executeRaw').mockImplementation(async (query, ...values) => {
      if (Array.isArray(query) && String(query[0]).includes('UPDATE uptime_monitors m')) {
        if (change === 'pause') await db().project.update({ where: { id: project.id }, data: { watchInterval: null, watchNextRunAt: null } })
        if (change === 'retarget') await db().project.update({ where: { id: project.id }, data: { url: 'https://changed.example.com/' } })
        if (change === 'suspend') await db().user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'lease') await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { leaseUntil: new Date(originTime.getTime() + 30_000), leaseToken: 'concurrent-worker' } })
      }
      return original(query, ...values)
    })
    try {
      await scheduleUptimeProbes(fixedClock(originTime), 1)
      expect(fixture.enqueue).not.toHaveBeenCalled()
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ lastDispatchAttemptAt: null, lastCheckedAt: null })
      expect(await db().uptimeProbe.count()).toBe(0)
    } finally { boundary.mockRestore() }
  })

  it('admits only one dispatch when two publishers select an unchanged attempt timestamp', async () => {
    const { project, monitor } = await monitorFixture()
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { lastDispatchAttemptAt: originTime } })
    const original = db().$executeRaw.bind(db())
    let selected = 0, release!: () => void, committed!: () => void
    const bothSelected = new Promise<void>(resolve => { release = resolve })
    const firstCommitted = new Promise<void>(resolve => { committed = resolve })
    const boundary = vi.spyOn(db(), '$executeRaw').mockImplementation(async (query, ...values) => {
      if (Array.isArray(query) && String(query[0]).includes('UPDATE uptime_monitors m')) {
        if (++selected === 1) {
          await bothSelected
          try { return await original(query, ...values) }
          finally { committed() }
        }
        release()
        await firstCommitted
      }
      return original(query, ...values)
    })
    const sweeps = [scheduleUptimeProbes(fixedClock(originTime), 1, project.id)]
    try {
      // Start the second sweep after the first selection released its lock,
      // while the first dispatch write is still held at the fixture boundary.
      await vi.waitFor(() => expect(selected).toBe(1))
      sweeps.push(scheduleUptimeProbes(fixedClock(originTime), 1, project.id))
      await vi.waitFor(() => expect(selected).toBe(2))
      const results = await Promise.all(sweeps)
      expect(results.map(result => result.published).sort()).toEqual([0, 1])
      expect(fixture.enqueue).toHaveBeenCalledOnce()
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } }))
        .toMatchObject({ lastDispatchAttemptAt: new Date(originTime.getTime() + 1) })
    } finally {
      release(); committed()
      await Promise.allSettled(sweeps)
      boundary.mockRestore()
    }
  }, 10_000)

  it('opens one incident after confirmation and creates one recovery receipt', async () => {
    const { monitor, job, project, user } = await monitorFixture()
    async function expectCurrentHealth(state: 'flags' | 'could_not_verify', label = 'Offline') {
      const home = (await loadSiteHome(project.id, { ownerEvidence: true }))!
      const sites = await loadSiteSummaries(user.id)
      expect(home.presentation.result.state).toBe(state)
      expect(sites[0].presentation.result).toEqual(home.presentation.result)
      if (state === 'flags') expect(home.presentation.result.label).toBe(label)
      expect(home.flags).toHaveLength(0)
      const listed = await mcpCall(user, MCP_TOOLS.listSites.name, {})
      expect(listed.structuredContent).toMatchObject({ sites: [expect.objectContaining({ siteId: project.id,
        uptime: expect.objectContaining({ state: home.uptime!.state, lastCheckedAt: home.uptime!.lastCheckedAt,
          incidentOpen: home.uptime!.incidentOpen }) })] })
      const detailed = await mcpCall(user, MCP_TOOLS.listOutcomes.name, { siteId: project.id, uptimeWindow: '24h' })
      expect(detailed.structuredContent).toMatchObject({ outcomes: [], uptime: {
        ...await loadUptimeHistory(uptimeReadSite(project)), scope: UPTIME_COPY.scope, limitation: UPTIME_COPY.limitation,
      } })
    }
    await executeUptimeProbe(job, async () => failed)
    expect(await db().uptimeIncident.count()).toBe(0)
    await expectCurrentHealth('could_not_verify')
    const observe = vi.fn(async () => failed)
    await executeUptimeProbe({ ...job, attempt: 2 }, observe)
    expect(observe).not.toHaveBeenCalled()
    vi.setSystemTime(new Date(originTime.getTime() + 30_000))
    await executeUptimeProbe({ ...job, attempt: 2 }, observe)
    await executeUptimeProbe({ ...job, attempt: 2 }, observe)
    expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(1)
    expect(await db().uptimeNotification.count()).toBe(1)
    await expectCurrentHealth('flags')
    const rejectedCursor = await mcpCall(user, MCP_TOOLS.listOutcomes.name, { siteId: project.id, uptimeWindow: '24h', uptimeCursor: 'foreign-probe' })
    expect(rejectedCursor).toMatchObject({ isError: true, structuredContent: { error: { code: 'INVALID_UPTIME_CURSOR', action: 'restart_uptime_history' } } })
    const restart = (rejectedCursor.structuredContent as { next: { tool: string; arguments: Record<string, unknown> } }).next
    const restarted = await mcpCall(user, restart.tool, restart.arguments)
    expect(restarted.isError).not.toBe(true)
    expect(restarted.structuredContent).toMatchObject({ uptime: { state: 'offline', openIncidentCount: 1 } })
    const otherOwner = await mcpCall({ ...user, id: 'other-owner' }, MCP_TOOLS.listOutcomes.name, { siteId: project.id, uptimeWindow: '24h' })
    expect(otherOwner.isError).toBe(true)
    const originalIncident = await db().uptimeIncident.findFirstOrThrow()
    const originalNotification = await db().uptimeNotification.findFirstOrThrow()
    vi.setSystemTime(new Date(originTime.getTime() + 5 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => ({ ...online, result: 'UNKNOWN', reason: 'access_blocked' }))
    expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ state: 'unknown', openIncidentCount: 1 })
    await expectCurrentHealth('flags', 'Needs attention')
    // Internal monitor state cannot revoke the active Site's unresolved duty.
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: false } })
    await expectCurrentHealth('flags', 'Needs attention')
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: true } })
    vi.setSystemTime(new Date(originTime.getTime() + 16 * 60_000))
    await expectCurrentHealth('flags', 'Needs attention')
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: originalIncident.id } })).toEqual(originalIncident)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: originalNotification.id } })).toEqual(originalNotification)
    expect(await db().uptimeNotification.count()).toBe(1)
    vi.setSystemTime(new Date(originTime.getTime() + 20 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => online)
    const recovered = await db().uptimeIncident.findFirstOrThrow()
    expect(recovered.recoveredAt).toEqual(new Date(originTime.getTime() + 20 * 60_000))
    expect(await db().uptimeNotification.count()).toBe(2)
    // HTTP recovery cannot establish the unrelated public analysis capabilities.
    await expectCurrentHealth('could_not_verify')
    const recurrenceAt = new Date(originTime.getTime() + 25 * 60_000)
    vi.setSystemTime(recurrenceAt)
    await executeUptimeProbe({ ...job, scheduledAt: recurrenceAt.toISOString() }, async () => failed)
    expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(1)
    const confirmRecurrence = vi.fn(async () => failed)
    await executeUptimeProbe({ ...job, scheduledAt: recurrenceAt.toISOString(), attempt: 2 }, confirmRecurrence)
    expect(confirmRecurrence).not.toHaveBeenCalled()
    vi.setSystemTime(new Date(recurrenceAt.getTime() + 30_000))
    await executeUptimeProbe({ ...job, scheduledAt: recurrenceAt.toISOString(), attempt: 2 }, confirmRecurrence)
    const incidents = await db().uptimeIncident.findMany({ where: { monitorId: monitor.id }, orderBy: { startedAt: 'asc' } })
    expect(incidents.map(incident => incident.recoveredAt)).toEqual([recovered.recoveredAt, null])
    expect(incidents[1].id).not.toBe(incidents[0].id)
    const notifications = await db().uptimeNotification.findMany()
    expect(notifications).toHaveLength(3)
    expect(notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ incidentId: incidents[0].id, kind: 'DOWN' }),
      expect.objectContaining({ incidentId: incidents[0].id, kind: 'RECOVERED' }),
      expect.objectContaining({ incidentId: incidents[1].id, kind: 'DOWN' }),
    ]))
    await expectCurrentHealth('flags')
    expect(await db().audit.count()).toBe(0)
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
  })

  it('preserves incident continuity when HTTP response content is interrupted', async () => {
    const { job, monitor } = await monitorFixture()
    const interrupted = () => probeUptime(online.finalUrl!, async () => {
      throw new PublicResponseBodyError({ statusCode: 200, finalUrl: online.finalUrl!, body: '<main>Partial',
        headers: {}, redirects: [] }, new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }))
    })
    const interruptedFailure = () => probeUptime(online.finalUrl!, async () => {
      throw new PublicResponseBodyError({ statusCode: 503, finalUrl: online.finalUrl!, body: '<main>Service unavailable',
        headers: { 'content-type': 'text/html' }, redirects: [] }, new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }))
    })
    await executeUptimeProbe(job, interrupted)
    vi.setSystemTime(new Date(originTime.getTime() + 5 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, interrupted)
    expect(await db().uptimeIncident.count()).toBe(0)
    expect(await db().uptimeNotification.count()).toBe(0)
    expect(await db().uptimeProbe.findMany({ where: { monitorId: monitor.id } })).toEqual([
      expect.objectContaining({ result: 'UNKNOWN', statusCode: 200, finalUrl: online.finalUrl }),
      expect.objectContaining({ result: 'UNKNOWN', statusCode: 200, finalUrl: online.finalUrl }),
    ])
    vi.setSystemTime(new Date(originTime.getTime() + 10 * 60_000))
    const failedJob = { ...job, scheduledAt: new Date().toISOString() }
    await executeUptimeProbe(failedJob, interruptedFailure)
    vi.setSystemTime(new Date(Date.now() + 30_000))
    await executeUptimeProbe({ ...failedJob, attempt: 2 }, interruptedFailure)
    const incident = await db().uptimeIncident.findFirstOrThrow()
    expect(await db().uptimeNotification.count()).toBe(1)
    vi.setSystemTime(new Date(originTime.getTime() + 15 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, interrupted)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toEqual(incident)
    expect(await db().uptimeNotification.count()).toBe(1)
    vi.setSystemTime(new Date(originTime.getTime() + 20 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => online)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } }))
      .toMatchObject({ recoveredAt: new Date() })
    expect(await db().uptimeIncident.count()).toBe(1)
    expect(await db().uptimeNotification.count({ where: { kind: 'RECOVERED' } })).toBe(1)
    const recoveredAt = new Date()
    vi.setSystemTime(new Date(originTime.getTime() + 25 * 60_000))
    const recurringJob = { ...job, scheduledAt: new Date().toISOString() }
    await executeUptimeProbe(recurringJob, interruptedFailure)
    vi.setSystemTime(new Date(Date.now() + 30_000))
    await executeUptimeProbe({ ...recurringJob, attempt: 2 }, interruptedFailure)
    const recurring = await db().uptimeIncident.findFirstOrThrow({ where: { monitorId: monitor.id, recoveredAt: null } })
    expect(recurring.id).not.toBe(incident.id)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt })
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id, result: 'FAILED', statusCode: 503, reason: 'response_error' } })).toBe(4)
    expect(await db().uptimeNotification.count({ where: { kind: 'DOWN' } })).toBe(2)
    expect(await db().uptimeNotification.count({ where: { kind: 'RECOVERED' } })).toBe(1)
  })

  it('retains an incident across inconclusive observations', async () => {
    const { job } = await monitorFixture()
    await executeUptimeProbe(job, async () => failed)
    vi.setSystemTime(new Date(originTime.getTime() + 30_000))
    await executeUptimeProbe({ ...job, attempt: 2 }, async () => failed)
    vi.setSystemTime(new Date(originTime.getTime() + 5 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => ({ ...online, result: 'UNKNOWN', reason: 'access_blocked' }))
    expect((await db().uptimeIncident.findFirstOrThrow()).recoveredAt).toBeNull()
    expect(await db().uptimeNotification.count()).toBe(1)
  })

  it.each(['connection_failed', 'response_timeout'])('keeps the confirming origin for %s across later probes and recovery', async reason => {
    const { job, project, monitor } = await monitorFixture()
    const origin = 'https://edge.example.com:8443'
    const failure = { ...failed, reason, statusCode: null }
    await executeUptimeProbe(job, async () => ({ ...failure, finalUrl: 'https://first.example.com' }))
    vi.setSystemTime(new Date(originTime.getTime() + UPTIME_CONFIRMATION_MS))
    await executeUptimeProbe({ ...job, attempt: 2 }, async () => ({ ...failure, finalUrl: origin + '/private?token=secret' }))
    const incident = await db().uptimeIncident.findFirstOrThrow({ where: { monitorId: monitor.id } })
    expect(incident).toMatchObject({ targetUrl: project.url, reason, failureOrigin: origin })
    vi.setSystemTime(new Date(originTime.getTime() + UPTIME_INTERVAL_MS))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => ({ ...failure, finalUrl: 'https://later.example.com' }))
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toEqual(incident)
    vi.setSystemTime(new Date(originTime.getTime() + 2 * UPTIME_INTERVAL_MS))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => online)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } }))
      .toMatchObject({ failureOrigin: origin, recoveredAt: new Date() })
  })

  it('stops queued work and discards in-flight evidence when monitoring is paused', async () => {
    const { project, job } = await monitorFixture()
    const observe = vi.fn(async () => online)
    await db().project.update({ where: { id: project.id }, data: { watchInterval: null, watchNextRunAt: null } })
    await executeUptimeProbe(job, observe)
    expect(observe).not.toHaveBeenCalled()
    await db().project.update({ where: { id: project.id }, data: { watchInterval: 'WEEKLY', watchNextRunAt: originTime } })
    await executeUptimeProbe(job, async () => {
      await db().project.update({ where: { id: project.id }, data: { watchInterval: null, watchNextRunAt: null } })
      return online
    })
    expect(await db().uptimeProbe.count()).toBe(0)
    expect((await loadUptimeSummary(uptimeReadSite(project)))?.state).toBe('paused')
  })

  it('supersedes target generations without fabricating recovery', async () => {
    const { project, monitor, job } = await monitorFixture()
    await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, startedAt: originTime, confirmedAt: originTime, reason: 'response_error' } })
    await db().project.update({ where: { id: project.id }, data: { url: 'https://example.org/' } })
    expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ state: 'unknown', incidentOpen: false, openIncidentCount: 1 })
    expect((await loadSiteHome(project.id, { ownerEvidence: true }))!.presentation.result.state).toBe('could_not_verify')
    const observe = vi.fn(async () => online)
    await executeUptimeProbe(job, observe)
    expect(observe).not.toHaveBeenCalled()
    expect((await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).version).toBe(2)
    const incident = await db().uptimeIncident.findFirstOrThrow()
    expect(incident.supersededAt).not.toBeNull()
    expect(incident.recoveredAt).toBeNull()
    expect((await loadUptimeSummary(uptimeReadSite(project)))?.segments.every(segment => segment.state === 'unknown')).toBe(true)
    expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ state: 'unknown', incidentOpen: false, openIncidentCount: 0 })
  })

  it('rejects queued probes for a suspended account and resumes the retained monitor after reactivation', async () => {
    const { user, project, monitor, job } = await monitorFixture()
    await db().user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
    await expect(loadUptimeSummary(uptimeReadSite(project), originTime)).rejects.toMatchObject({ status: 404 })
    await expect(loadUptimeHistory(uptimeReadSite(project), '24h', null, originTime)).rejects.toMatchObject({ status: 404 })
    const observe = vi.fn(async () => online)
    await executeUptimeProbe(job, observe)
    await scheduleUptimeProbes(fixedClock(originTime), 1)
    expect(observe).not.toHaveBeenCalled()
    expect(fixture.enqueue).not.toHaveBeenCalled()
    expect(await db().uptimeProbe.count()).toBe(0)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      id: monitor.id, enabled: false, state: 'paused' })
    await db().user.update({ where: { id: user.id }, data: { lifecycleStatus: 'ACTIVE' } })
    await executeUptimeProbe(job, observe)
    expect(observe).toHaveBeenCalledOnce()
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      id: monitor.id, enabled: true, state: 'online' })
    expect(await loadUptimeSummary(uptimeReadSite(project), originTime)).toMatchObject({ enabled: true, state: 'online' })
  })

  it('discards an in-flight observation after account suspension without inventing recovery', async () => {
    const { user, monitor, project, job } = await monitorFixture()
    const incident = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
      startedAt: originTime, confirmedAt: originTime, reason: 'response_error' } })
    const observe = vi.fn(async () => {
      await db().user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
      return online
    })
    await executeUptimeProbe(job, observe)
    expect(observe).toHaveBeenCalledOnce()
    expect(await db().uptimeProbe.count()).toBe(0)
    expect(await db().uptimeNotification.count()).toBe(0)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
      leaseToken: null, leaseUntil: null, lastCheckedAt: null })
  })

  it('skips missed slots and retains durable dispatch intent after queue failures', async () => {
    const { job, monitor } = await monitorFixture()
    vi.setSystemTime(new Date(originTime.getTime() + 60 * 60_000))
    const observe = vi.fn(async () => online)
    await executeUptimeProbe(job, observe)
    expect(observe).not.toHaveBeenCalled()
    fixture.enqueue.mockRejectedValueOnce(new Error('Redis unavailable'))
    await expect(scheduleUptimeProbes()).resolves.toEqual({ published: 0, failed: 1 })
    expect((await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).nextProbeAt).toEqual(originTime)
    await expect(scheduleUptimeProbes()).resolves.toEqual({ published: 1, failed: 0 })
    expect(fixture.enqueue.mock.calls.at(-1)?.[0].scheduledAt).toBe(new Date().toISOString())
  })

  it('keeps paused and deleted Sites from consuming the bounded dispatch batch', async () => {
    const { user, monitor } = await monitorFixture()
    const older = new Date(originTime.getTime() - 60 * 60_000)
    for (const index of [1, 2, 3]) {
      const project = await db().project.create({ data: {
        userId: user.id, name: `Inactive ${index}`, canonicalHost: `inactive${index}.example.com`, url: `https://inactive${index}.example.com/`,
        ...(index === 3 ? { deletedAt: originTime, watchInterval: 'WEEKLY', watchNextRunAt: originTime }
          : index === 2 ? { watchInterval: 'WEEKLY', watchPausedAt: originTime } : {}),
      } })
      await db().uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url, nextProbeAt: older } })
    }
    await scheduleUptimeProbes(fixedClock(originTime), 3)
    expect(fixture.enqueue).toHaveBeenCalledOnce()
    expect(fixture.enqueue).toHaveBeenCalledWith(expect.objectContaining({ monitorId: monitor.id, attempt: 1 }), originTime)
  })

  it('resumes a previously disabled monitor when its Site schedule is restarted', async () => {
    const { project, monitor } = await monitorFixture()
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: false, state: 'paused' } })
    await db().project.update({ where: { id: project.id }, data: { watchNextRunAt: originTime } })
    await scheduleUptimeProbes(fixedClock(originTime))
    expect(fixture.enqueue).toHaveBeenCalledWith(expect.objectContaining({ monitorId: monitor.id, version: 1, attempt: 1 }), originTime)
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ enabled: true, state: 'unknown' })
  })

  it('bounds and scopes history pagination and retains unresolved incidents during cleanup', async () => {
    const { project, monitor, user } = await monitorFixture()
    const watched = await db().siteOutcome.create({ data: { projectId: project.id, name: 'The page loads', slug: 'page-loads', kind: 'AVAILABILITY',
      bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', required: true, config: { startUrl: project.url } } } } })
    await db().uptimeProbe.createMany({ data: Array.from({ length: 105 }, (_, index) => ({ monitorId: monitor.id, version: 1, targetUrl: project.url,
      scheduledAt: new Date(originTime.getTime() - (index + 1) * 5 * 60_000), observedAt: new Date(originTime.getTime() - (index + 1) * 5 * 60_000),
      attempt: 1, result: 'ONLINE', reason: 'response_received', durationMs: 10, confirmed: false })) })
    const first = await loadUptimeHistory(uptimeReadSite(project))
    expect(first?.probes).toHaveLength(100)
    expect((await loadUptimeHistory(uptimeReadSite(project), '24h', first!.nextCursor))?.probes).toHaveLength(5)
    await expect(loadUptimeHistory(uptimeReadSite(project), '7d', first!.nextCursor)).rejects.toThrow('Invalid uptime cursor')
    await expect(loadUptimeHistory(uptimeReadSite(project), '24h', first!.probes.at(-1)!.id)).rejects.toThrow('Invalid uptime cursor')
    const tampered = first!.nextCursor!.slice(0, -1) + (first!.nextCursor!.endsWith('A') ? 'B' : 'A')
    await expect(loadUptimeHistory(uptimeReadSite(project), '24h', tampered)).rejects.toThrow('Invalid uptime cursor')
    const expiredAt = new Date(Date.parse(first!.probes.at(-1)!.observedAt) + 86400_001)
    await expect(loadUptimeHistory(uptimeReadSite(project), '24h', first!.nextCursor, expiredAt)).rejects.toThrow('Invalid uptime cursor')
    const evidence = await mcpCall(user, MCP_TOOLS.listOutcomes.name, { siteId: project.id, uptimeWindow: '24h' })
    expect(evidence.structuredContent?.outcomes).toEqual([expect.objectContaining({ outcomeId: watched.id,
      state: 'COULD_NOT_VERIFY', freshness: expect.objectContaining({ status: 'UNVERIFIED' }) })])
    const firstPage = uptimeHistorySchema.parse(evidence.structuredContent?.uptime)
    expect(firstPage).toEqual(first)
    expect(await mcpCall(user, MCP_TOOLS.listOutcomes.name, {
      siteId: project.id, uptimeWindow: '7d', uptimeCursor: firstPage.nextCursor,
    })).toMatchObject({ isError: true, structuredContent: { error: { code: 'INVALID_UPTIME_CURSOR' },
      next: { arguments: { siteId: project.id, uptimeWindow: '7d' } } } })
    const nextPage = uptimeHistorySchema.parse((await mcpCall(user, MCP_TOOLS.listOutcomes.name, {
      siteId: project.id, uptimeWindow: '24h', uptimeCursor: firstPage.nextCursor,
    })).structuredContent?.uptime)
    expect(nextPage.probes).toHaveLength(5)
    expect(new Set([...firstPage.probes, ...nextPage.probes].map(probe => probe.id)).size).toBe(105)
    const other = await db().project.create({ data: { userId: user.id, url: 'https://other.example.com/', canonicalHost: 'other.example.com', name: 'Other' } })
    await db().uptimeMonitor.create({ data: { projectId: other.id, targetUrl: other.url } })
    expect(await mcpCall(user, MCP_TOOLS.listOutcomes.name, { siteId: other.id, uptimeWindow: '24h', uptimeCursor: firstPage.nextCursor }))
      .toMatchObject({ isError: true, structuredContent: { error: { code: 'INVALID_UPTIME_CURSOR' } } })
    await expect(loadUptimeHistory(uptimeReadSite(project), '24h', 'not-a-probe')).rejects.toThrow()
    const old = new Date(originTime.getTime() - 31 * 86400_000)
    await db().uptimeProbe.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, scheduledAt: old, observedAt: old,
      attempt: 1, result: 'FAILED', reason: 'response_error', durationMs: 10, confirmed: true } })
    await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, startedAt: old, confirmedAt: old, reason: 'response_error' } })
    await retainUptimeHistory()
    expect(await db().uptimeProbe.count()).toBe(105)
    expect(await db().uptimeIncident.count()).toBe(1)
    const retained = uptimeHistorySchema.parse((await mcpCall(user, MCP_TOOLS.listOutcomes.name, { siteId: project.id, uptimeWindow: '24h' })).structuredContent?.uptime)
    expect(retained.incidents).toEqual([expect.objectContaining({ startedAt: old.toISOString(), recoveredAt: null })])
  })

  it('expires probe history in bounded batches while a locked expired row remains due', async () => {
    const { project, monitor } = await monitorFixture()
    const cutoff = new Date(originTime.getTime() - UPTIME_RETENTION_MS)
    const probe = (id: string, observedAt: Date) => ({
      id, monitorId: monitor.id, version: monitor.version, targetUrl: project.url,
      scheduledAt: observedAt, observedAt, attempt: 1, result: 'ONLINE', reason: 'response_received', durationMs: 10,
    })
    const expired = Array.from({ length: 5002 }, (_, index) =>
      probe('retention-old-' + index, new Date(cutoff.getTime() - 5002 + index)))
    await db().uptimeProbe.createMany({ data: [...expired, probe('retention-cutoff', cutoff)] })
    let release!: () => void, acquired!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { acquired = resolve })
    const transaction = db().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM uptime_probes WHERE id = ${expired[0].id} FOR UPDATE`
      acquired()
      await released
    }, { timeout: 20_000 })
    try {
      await Promise.race([locked, transaction])
      expect(await retainUptimeHistory(originTime)).toBe(true)
      expect(await db().uptimeProbe.findMany({ orderBy: { observedAt: 'asc' }, select: { id: true } }))
        .toEqual([{ id: expired[0].id }, { id: expired.at(-1)!.id }, { id: 'retention-cutoff' }])
      expect(await retainUptimeHistory(originTime)).toBe(true)
      expect(await db().uptimeProbe.count()).toBe(2)
    } finally { release(); await transaction }
    expect(await retainUptimeHistory(originTime)).toBe(false)
    expect(await db().uptimeProbe.findMany({ select: { id: true } })).toEqual([{ id: 'retention-cutoff' }])
  }, 25_000)

  it('shares scheduled slot coverage across summary and history without collapsing retained rows', async () => {
    const { project, monitor } = await monitorFixture()
    await db().uptimeProbe.createMany({ data: [-25, -20, -15, -10, -5, -1].map(minutes => {
      const at = new Date(originTime.getTime() + minutes * 60_000)
      return { monitorId: monitor.id, version: monitor.version, targetUrl: project.url,
        scheduledAt: at, observedAt: at, attempt: 1, result: 'ONLINE', reason: 'response_received', durationMs: 10, confirmed: false }
    }) })
    const site = uptimeReadSite(project)
    const summary = await loadUptimeSummary(site, originTime)
    const history = await loadUptimeHistory(site, '24h', null, originTime)
    expect(history!.probes).toHaveLength(6)
    expect(history!.segments).toEqual(summary!.segments)
    expect(history!.segments.at(-1)).toMatchObject({ state: 'unknown', checked: 5, expected: 6 })
  })
})
