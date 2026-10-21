import { fixedClock } from '@/lib/time/clock'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null, enqueue: vi.fn() }))
const databaseUrl = process.env.UPTIME_TEST_DATABASE_URL
vi.mock('@/lib/db', async () => {
  if (!process.env.UPTIME_TEST_DATABASE_URL) return { prisma: {} }
  const database = new URL(process.env.UPTIME_TEST_DATABASE_URL)
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
    throw new Error('Use the disposable uptime execution verifier')
  fixture.db = new (await import('@prisma/client')).PrismaClient({ datasourceUrl: database.toString() })
  return { prisma: fixture.db }
})
vi.mock('./queue', () => ({ enqueueUptimeProbe: fixture.enqueue }))
import { executeUptimeProbe, scheduleUptimeProbes } from './service'
import { loadUptimeSummary } from './queries'
import { UPTIME_INTERVAL_MS, type ProbeObservation } from './domain'

const db = () => fixture.db!
const now = new Date('2026-10-12T12:05:01.000Z')
const scheduledAt = new Date('2026-10-12T12:05:00.000Z')
const clock = fixedClock(now)
const online: ProbeObservation = { result: 'ONLINE', reason: 'response_received', statusCode: 200,
  durationMs: 50, finalUrl: 'https://example.com/' }

async function pendingFixture() {
  const user = await db().user.create({ data: { email: 'owner@reconciliation-uptime-test.example', preferredTools: [] } })
  const project = await db().project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com',
    url: online.finalUrl!, watchInterval: 'WEEKLY', watchNextRunAt: now } })
  const pendingAt = new Date(now.getTime() - UPTIME_INTERVAL_MS - 1000)
  const monitor = await db().uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url,
    state: 'checking', nextProbeAt: scheduledAt, pendingFailureAt: pendingAt, pendingSlotAt: pendingAt,
    confirmationDueAt: new Date(pendingAt.getTime() + 30_000) } })
  return { user, project, monitor, job: { monitorId: monitor.id, version: 1, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const } }
}

describe.skipIf(!databaseUrl)('Uptime reconciliation with concurrent observations', () => {
  beforeEach(async () => {
    fixture.enqueue.mockReset()
    await db().user.deleteMany({ where: { email: { endsWith: '@reconciliation-uptime-test.example' } } })
  })
  afterAll(async () => {
    try { await fixture.db?.user.deleteMany({ where: { email: { endsWith: '@reconciliation-uptime-test.example' } } }) }
    finally { await fixture.db?.$disconnect() }
  })

  it.each(['ONLINE', 'FAILED'] as const)('retains a fresh %s observation when a selected confirmation expires', async result => {
    const { project, monitor, job } = await pendingFixture()
    const select = db().uptimeMonitor.findMany.bind(db().uptimeMonitor)
    const boundary = vi.spyOn(db().uptimeMonitor, 'findMany').mockImplementationOnce(async args => {
      const selected = await select(args)
      await executeUptimeProbe(job, async () => ({ ...online, result, statusCode: result === 'FAILED' ? 503 : 200 }), clock)
      return selected
    })
    try {
      await scheduleUptimeProbes(clock, 1, project.id)
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        state: result === 'ONLINE' ? 'online' : 'checking', lastCheckedAt: now, lastScheduledAt: scheduledAt,
        nextProbeAt: new Date('2026-10-12T12:10:00.000Z'),
        pendingFailureAt: result === 'FAILED' ? now : null,
        confirmationDueAt: result === 'FAILED' ? new Date(now.getTime() + 30_000) : null,
      })
      expect(await loadUptimeSummary(project.id, now)).toMatchObject({ state: result === 'ONLINE' ? 'online' : 'checking' })
      expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
      // Only the worker's new failure can publish a confirmation, never the stale scheduler.
      expect(fixture.enqueue).toHaveBeenCalledTimes(result === 'FAILED' ? 1 : 0)
    } finally { boundary.mockRestore() }
  })

  it('retains an active observation lease while reconciling an expired selected confirmation', async () => {
    const { project, monitor, job } = await pendingFixture()
    let complete!: (observation: ProbeObservation) => void
    const response = new Promise<ProbeObservation>(resolve => { complete = resolve })
    const observe = vi.fn(() => response)
    let worker: Promise<void> | undefined
    const select = db().uptimeMonitor.findMany.bind(db().uptimeMonitor)
    const boundary = vi.spyOn(db().uptimeMonitor, 'findMany').mockImplementationOnce(async args => {
      const selected = await select(args)
      worker = executeUptimeProbe(job, observe, clock)
      await vi.waitFor(() => expect(observe).toHaveBeenCalledOnce())
      return selected
    })
    try {
      await scheduleUptimeProbes(clock, 1, project.id)
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        leaseUntil: new Date(now.getTime() + 30_000), leaseToken: expect.any(String),
      })
      expect(fixture.enqueue).not.toHaveBeenCalled()
      complete(online)
      await worker
      expect(await loadUptimeSummary(project.id, now)).toMatchObject({ state: 'online', lastCheckedAt: now.toISOString() })
      expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
    } finally { boundary.mockRestore(); complete(online); await worker }
  })

  it('reconciles the current Site target rather than the selected Site snapshot', async () => {
    const { project, monitor } = await pendingFixture()
    const incident = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
      startedAt: scheduledAt, confirmedAt: scheduledAt, reason: 'response_error' } })
    const select = db().uptimeMonitor.findMany.bind(db().uptimeMonitor)
    const boundary = vi.spyOn(db().uptimeMonitor, 'findMany').mockImplementationOnce(async args => {
      const selected = await select(args)
      await db().project.update({ where: { id: project.id }, data: { url: 'https://example.org/' } })
      return selected
    })
    try {
      await scheduleUptimeProbes(clock, 1, project.id)
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        targetUrl: 'https://example.org/', version: 2, state: 'unknown', pendingFailureAt: null,
      })
      expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } }))
        .toMatchObject({ supersededAt: now, recoveredAt: null })
      expect(fixture.enqueue).not.toHaveBeenCalled()
    } finally { boundary.mockRestore() }
  })
})
