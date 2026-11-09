import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import type { ProbeObservation } from './domain'

const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null, enqueue: vi.fn() }))
const databaseUrl = process.env.UPTIME_TEST_DATABASE_URL
vi.mock('@/lib/db', async () => {
  if (!process.env.UPTIME_TEST_DATABASE_URL) return { prisma: {} }
  const database = new URL(process.env.UPTIME_TEST_DATABASE_URL)
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
    throw new Error('Use a disposable local uptime database')
  fixture.db = new (await import('@prisma/client')).PrismaClient({ datasourceUrl: database.toString() })
  return { prisma: fixture.db }
})
vi.mock('./queue', () => ({ enqueueUptimeProbe: fixture.enqueue }))
import { executeUptimeProbe, scheduleUptimeProbes } from './service'

const db = () => fixture.db!
const now = new Date('2026-11-01T12:00:01.000Z')
const scheduledAt = new Date('2026-11-01T12:00:00.000Z')
const online: ProbeObservation = { result: 'ONLINE', reason: 'response_received', statusCode: 200,
  durationMs: 50, finalUrl: 'https://example.com/' }
const ownerDomain = '@authority-uptime-test.example'

async function monitorFixture() {
  const user = await db().user.create({ data: { email: 'owner' + ownerDomain, preferredTools: [] } })
  const project = await db().project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com',
    url: online.finalUrl!, watchInterval: 'WEEKLY', watchNextRunAt: now } })
  const monitor = await db().uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url,
    state: 'offline', nextProbeAt: scheduledAt } })
  const incident = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
    startedAt: new Date(now.getTime() - 60_000), confirmedAt: now, reason: 'response_error' } })
  return { user, project, monitor, incident,
    job: { monitorId: monitor.id, version: 1, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const } }
}

async function expectUnchanged(monitorId: string, incidentId: string) {
  expect(await db().uptimeProbe.count({ where: { monitorId } })).toBe(0)
  expect(await db().uptimeNotification.count({ where: { incidentId } })).toBe(0)
  expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incidentId } })).toMatchObject({ recoveredAt: null })
  expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).toMatchObject({
    state: 'offline', lastCheckedAt: null, nextProbeAt: scheduledAt, leaseToken: null, leaseUntil: null,
  })
}

describe.skipIf(!databaseUrl)('Uptime observation commit authority', () => {
  beforeEach(async () => {
    fixture.enqueue.mockReset()
    await db().user.deleteMany({ where: { email: { endsWith: ownerDomain } } })
  })
  afterAll(async () => {
    try { await fixture.db?.user.deleteMany({ where: { email: { endsWith: ownerDomain } } }) }
    finally { await fixture.db?.$disconnect() }
  })

  it.each(['monitor', 'site', 'account'] as const)('settles a late observation without publishing or retrying after physical %s removal', async removed => {
    const { user, project, monitor, incident, job } = await monitorFixture()
    const observe = vi.fn(async () => {
      if (removed === 'monitor') await db().uptimeMonitor.delete({ where: { id: monitor.id } })
      else if (removed === 'site') await db().project.delete({ where: { id: project.id } })
      else await db().user.delete({ where: { id: user.id } })
      return online
    })
    await expect(executeUptimeProbe(job, observe, { now: () => new Date(now) })).resolves.toBeUndefined()
    await expect(executeUptimeProbe(job, observe, { now: () => new Date(now) })).resolves.toBeUndefined()
    expect(observe).toHaveBeenCalledOnce()
    expect(await db().uptimeMonitor.count({ where: { id: monitor.id } })).toBe(0)
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
    expect(await db().uptimeNotification.count({ where: { incidentId: incident.id } })).toBe(0)
    expect(fixture.enqueue).not.toHaveBeenCalled()
  })

  it('skips a monitor being deleted without waiting for its row lock', async () => {
    const { monitor, job } = await monitorFixture()
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { enabled: false, state: 'paused' } })
    const writer = new Client({ connectionString: databaseUrl })
    await writer.connect()
    let completion: Promise<void> | undefined
    const observe = vi.fn(async () => online)
    try {
      await writer.query('BEGIN')
      await writer.query('DELETE FROM uptime_monitors WHERE id = $1', [monitor.id])
      const probe = executeUptimeProbe(job, observe, { now: () => new Date(now) })
      completion = probe
      let settled = false
      void probe.then(() => { settled = true }, () => { settled = true })
      await vi.waitFor(() => expect(settled).toBe(true))
      await expect(probe).resolves.toBeUndefined()
      expect(observe).not.toHaveBeenCalled()
      expect(fixture.enqueue).not.toHaveBeenCalled()
      await writer.query('COMMIT')
      expect(await db().uptimeMonitor.count({ where: { id: monitor.id } })).toBe(0)
    } finally {
      await writer.query('ROLLBACK')
      await writer.end()
      await completion
    }
  })

  it('retains the incident and due slot when ownership changes during the public request', async () => {
    const { project, monitor, incident, job } = await monitorFixture()
    const nextOwner = await db().user.create({ data: { email: 'next' + ownerDomain, preferredTools: [] } })
    await executeUptimeProbe(job, async () => {
      await db().project.update({ where: { id: project.id }, data: { userId: nextOwner.id } })
      return online
    }, { now: () => new Date(now) })
    await expectUnchanged(monitor.id, incident.id)
    // A fresh admission by the new owner can observe recovery on the same monitor.
    await executeUptimeProbe(job, async () => online, { now: () => new Date(now) })
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: now })
  })

  it('yields a busy monitor before probing and retries its unchanged slot after the lock clears', async () => {
    const { project, monitor, incident, job } = await monitorFixture()
    const writer = new Client({ connectionString: databaseUrl })
    await writer.connect()
    const clock = { now: () => new Date(now) }
    const observe = vi.fn(async () => online)
    let probe: Promise<void> | undefined
    try {
      await writer.query('BEGIN')
      await writer.query('SELECT id FROM uptime_monitors WHERE id = $1 FOR UPDATE', [monitor.id])
      probe = executeUptimeProbe(job, observe, clock)
      let settled = false
      void probe.then(() => { settled = true }, () => { settled = true })
      await vi.waitFor(() => expect(settled).toBe(true))
      await expect(probe).resolves.toBeUndefined()
      expect(observe).not.toHaveBeenCalled()
      await expectUnchanged(monitor.id, incident.id)
      await expect(scheduleUptimeProbes(clock, 1, project.id)).resolves.toEqual({ published: 0, failed: 0 })

      await writer.query('COMMIT')
      await expect(scheduleUptimeProbes(clock, 1, project.id)).resolves.toEqual({ published: 1, failed: 0 })
      expect(fixture.enqueue).toHaveBeenCalledWith(job, now)
      await executeUptimeProbe(job, observe, clock)
      expect(observe).toHaveBeenCalledOnce()
      expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: now })
      expect(await db().uptimeNotification.count({ where: { incidentId: incident.id, kind: 'RECOVERED' } })).toBe(1)
    } finally {
      await writer.query('ROLLBACK')
      await writer.end()
      await probe
    }
  })

  it('refuses recovery after its observation lease expires and leaves the original slot retryable', async () => {
    const { project, monitor, incident, job } = await monitorFixture()
    let time = now
    const clock = { now: () => new Date(time) }
    await executeUptimeProbe(job, async () => {
      time = new Date(now.getTime() + 30_000)
      return online
    }, clock)
    await expectUnchanged(monitor.id, incident.id)
    await scheduleUptimeProbes(clock, 1, project.id)
    expect(fixture.enqueue).toHaveBeenCalledWith(job, time)
    await executeUptimeProbe(job, async () => online, clock)
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: time })
  })

  it('keeps a rolled-back recovery retryable when releasing its lease also fails', async () => {
    const { project, monitor, incident, job } = await monitorFixture()
    const outage = await db().uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN' } })
    let time = now
    const clock = { now: () => new Date(time) }
    const commitError = new Error('Controlled observation rollback')
    const transaction = db().$transaction.bind(db())
    const rollback = vi.spyOn(db(), '$transaction').mockImplementationOnce(callback => transaction(async tx => {
      await callback(tx)
      throw commitError
    }))
    const release = vi.spyOn(db().uptimeMonitor, 'updateMany').mockRejectedValueOnce(new Error('Controlled lease release failure'))
    try {
      await expect(executeUptimeProbe(job, async () => online, clock)).rejects.toBe(commitError)
      expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
      expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
      expect(await db().uptimeNotification.findMany({ where: { incidentId: incident.id } })).toEqual([outage])
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        state: 'offline', nextProbeAt: scheduledAt, lastCheckedAt: null, leaseUntil: new Date(now.getTime() + 30_000),
      })
      await expect(scheduleUptimeProbes(clock, 1, project.id)).resolves.toEqual({ published: 0, failed: 0 })
    } finally { rollback.mockRestore(); release.mockRestore() }

    time = new Date(now.getTime() + 31_000)
    await expect(scheduleUptimeProbes(clock, 1, project.id)).resolves.toEqual({ published: 1, failed: 0 })
    expect(fixture.enqueue).toHaveBeenCalledExactlyOnceWith(job, time)
    await executeUptimeProbe(job, async () => online, clock)
    expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: time })
    expect(await db().uptimeNotification.findMany({ where: { incidentId: incident.id }, orderBy: { kind: 'asc' } })).toEqual([
      expect.objectContaining({ id: outage.id, kind: 'DOWN', status: 'SKIPPED' }),
      expect.objectContaining({ kind: 'RECOVERED', status: 'PENDING' }),
    ])
  })

  it.each(['transfer', 'suspend'] as const)('waits for an in-flight %s before deciding whether recovery is authorized', async change => {
    const { user, project, monitor, incident, job } = await monitorFixture()
    const nextOwner = await db().user.create({ data: { email: 'next' + ownerDomain, preferredTools: [] } })
    const writer = new Client({ connectionString: databaseUrl })
    await writer.connect()
    let probe: Promise<void> | undefined
    try {
      await writer.query('BEGIN')
      const observe = vi.fn(async () => {
        if (change === 'transfer') await writer.query('UPDATE projects SET "userId" = $1 WHERE id = $2', [nextOwner.id, project.id])
        else await writer.query('UPDATE users SET "lifecycleStatus" = $1 WHERE id = $2', ['SUSPENDED', user.id])
        return online
      })
      probe = executeUptimeProbe(job, observe, { now: () => new Date(now) })
      // Observe an actual PostgreSQL wait, without assuming that a timer proves locking.
      await vi.waitFor(async () => {
        expect(observe).toHaveBeenCalledOnce()
        const waiting = await db().$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE 'SELECT id FROM % FOR SHARE'
        `
        expect(Number(waiting[0].count)).toBe(1)
      })
      expect(await db().uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
      await writer.query('COMMIT')
      await probe
      await expectUnchanged(monitor.id, incident.id)
    } finally {
      await writer.query('ROLLBACK')
      await writer.end()
      await probe
    }
  })

  it('rechecks lease time after waiting for the monitor lock', async () => {
    const { monitor, incident, job } = await monitorFixture()
    const writer = new Client({ connectionString: databaseUrl })
    await writer.connect()
    let time = now
    let probe: Promise<void> | undefined
    try {
      await writer.query('BEGIN')
      probe = executeUptimeProbe(job, async () => {
        await writer.query('SELECT id FROM uptime_monitors WHERE id = $1 FOR UPDATE', [monitor.id])
        return online
      }, { now: () => new Date(time) })
      await vi.waitFor(async () => {
        const waiting = await db().$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE 'SELECT id FROM uptime_monitors % FOR UPDATE'
        `
        expect(Number(waiting[0].count)).toBe(1)
      })
      time = new Date(now.getTime() + 30_000)
      await writer.query('COMMIT')
      await probe
      await expectUnchanged(monitor.id, incident.id)
    } finally {
      await writer.query('ROLLBACK')
      await writer.end()
      await probe
    }
  })
})
