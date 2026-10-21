import { fixedClock, systemClock } from '@/lib/time/clock'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

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
import { executeUptimeProbe, retainUptimeHistory, scheduleUptimeProbes } from './service'
import { loadUptimeHistory, loadUptimeSummary } from './queries'
import type { ProbeObservation } from './domain'

const db = () => fixture.db!
const originTime = new Date('2026-10-12T12:00:00.000Z')
const online: ProbeObservation = { result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 50, finalUrl: 'https://example.com/' }
const failed: ProbeObservation = { ...online, result: 'FAILED', reason: 'response_error', statusCode: 503 }
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

  it('publishes a current slot for the next monitor after an earlier queue delay', async () => {
    const first = await monitorFixture()
    const secondSite = await db().project.create({ data: { userId: first.user.id, name: 'Later Site', canonicalHost: 'later.example.com',
      url: 'https://later.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: originTime } })
    const second = await db().uptimeMonitor.create({ data: { projectId: secondSite.id, targetUrl: secondSite.url, nextProbeAt: new Date(originTime.getTime() + 1) } })
    // Both rows are due at selection. Only publication of the first is delayed.
    vi.setSystemTime(new Date(originTime.getTime() + 1000))
    fixture.enqueue.mockImplementation(async job => {
      if (job.monitorId === first.monitor.id) vi.setSystemTime(new Date(originTime.getTime() + 6 * 60_000))
    })
    await scheduleUptimeProbes(systemClock, 10)
    const job = fixture.enqueue.mock.calls.find(([job]) => job.monitorId === second.id)![0]
    expect(job.scheduledAt).toBe(new Date(originTime.getTime() + 5 * 60_000).toISOString())
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: second.id } }))
      .toMatchObject({ lastDispatchAttemptAt: new Date(originTime.getTime() + 6 * 60_000) })
    await executeUptimeProbe(job, async () => online)
    expect(await db().uptimeProbe.findFirst({ where: { monitorId: second.id } }))
      .toMatchObject({ result: 'ONLINE', observedAt: new Date(originTime.getTime() + 6 * 60_000) })
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
    const setup = vi.spyOn(db().uptimeMonitor, 'upsert').mockRejectedValueOnce(new Error('Controlled Site initialization failure'))
    try {
      await scheduleUptimeProbes(fixedClock(originTime), 10)
      expect(setup.mock.calls[0][0].where.projectId).toBe(projects[0].id)
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: projects[0].id } })).toBeNull()
      const initialized = await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: projects[1].id } })
      expect(fixture.enqueue).toHaveBeenCalledTimes(2)
      for (const id of [monitor.id, initialized.id])
        expect(fixture.enqueue).toHaveBeenCalledWith(expect.objectContaining({ monitorId: id, attempt: 1 }), originTime)
    } finally { setup.mockRestore() }
    fixture.enqueue.mockClear()
    const retryAt = new Date(originTime.getTime() + 120_000)
    await scheduleUptimeProbes(fixedClock(retryAt), 10, projects[0].id)
    const retried = await db().uptimeMonitor.findUniqueOrThrow({ where: { projectId: projects[0].id } })
    expect(fixture.enqueue).toHaveBeenCalledOnce()
    expect(fixture.enqueue).toHaveBeenCalledWith(expect.objectContaining({ monitorId: retried.id, attempt: 1 }), retryAt)
    expect(await db().audit.count()).toBe(0)
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
  })

  it('advances bounded monitor initialization past repeated setup failures', async () => {
    const { user } = await monitorFixture()
    const sites = await Promise.all(['failed-initialization', 'following-initialization'].map((host, index) => db().project.create({ data: {
      userId: user.id, name: host, url: 'https://' + host + '.example.com/', canonicalHost: host + '.example.com',
      watchInterval: 'WEEKLY', watchNextRunAt: originTime, createdAt: new Date('2000-01-0' + (index + 1) + 'T00:00:00Z'),
    } })))
    const original = db().uptimeMonitor.upsert.bind(db().uptimeMonitor)
    let rejectSetup = true
    const failure = vi.spyOn(db().uptimeMonitor, 'upsert').mockImplementation(args => {
      if (rejectSetup && args.where.projectId === sites[0].id) throw new Error('Controlled persistent uptime initialization failure')
      return original(args)
    })
    try {
      await scheduleUptimeProbes(fixedClock(originTime), 1)
      await scheduleUptimeProbes(fixedClock(originTime), 1)
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: sites[0].id } })).toBeNull()
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: sites[1].id } })).not.toBeNull()
      expect(await db().project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ monitoringSetupRetryAt: new Date(originTime.getTime() + 60_000),
        watchInterval: 'WEEKLY', watchLastError: null })
      rejectSetup = false
      await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 30_000)), 1, sites[0].id)
      expect(await db().uptimeMonitor.findUnique({ where: { projectId: sites[0].id } })).toBeNull()
      await scheduleUptimeProbes(fixedClock(new Date(originTime.getTime() + 120_000)), 1, sites[0].id)
      expect(await db().uptimeMonitor.count({ where: { projectId: sites[0].id } })).toBe(1)
      expect(await db().project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ monitoringSetupRetryAt: null })
    } finally { failure.mockRestore() }
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
    expect(await db().project.findUniqueOrThrow({ where: { id: unsafe.id } })).toMatchObject({ monitoringSetupRetryAt: new Date(originTime.getTime() + 60_000) })
    expect(await db().uptimeMonitor.findUnique({ where: { projectId: following.id } })).not.toBeNull()
    expect(await db().uptimeIncident.count()).toBe(0)
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
    const original = db().uptimeMonitor.updateMany.bind(db().uptimeMonitor)
    const boundary = vi.spyOn(db().uptimeMonitor, 'updateMany').mockImplementation(async args => {
      if (args.data.lastDispatchAttemptAt) {
        if (change === 'pause') await db().project.update({ where: { id: project.id }, data: { watchInterval: null, watchNextRunAt: null } })
        if (change === 'retarget') await db().project.update({ where: { id: project.id }, data: { url: 'https://changed.example.com/' } })
        if (change === 'suspend') await db().user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'lease') await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { leaseUntil: new Date(originTime.getTime() + 30_000), leaseToken: 'concurrent-worker' } })
      }
      return original(args)
    })
    try {
      await scheduleUptimeProbes(fixedClock(originTime), 1)
      expect(fixture.enqueue).not.toHaveBeenCalled()
      expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ lastDispatchAttemptAt: null, lastCheckedAt: null })
      expect(await db().uptimeProbe.count()).toBe(0)
    } finally { boundary.mockRestore() }
  })

  it('opens one incident after confirmation and creates one recovery receipt', async () => {
    const { monitor, job } = await monitorFixture()
    await executeUptimeProbe(job, async () => failed)
    expect(await db().uptimeIncident.count()).toBe(0)
    const observe = vi.fn(async () => failed)
    await executeUptimeProbe({ ...job, attempt: 2 }, observe)
    expect(observe).not.toHaveBeenCalled()
    vi.setSystemTime(new Date(originTime.getTime() + 30_000))
    await executeUptimeProbe({ ...job, attempt: 2 }, observe)
    await executeUptimeProbe({ ...job, attempt: 2 }, observe)
    expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(1)
    expect(await db().uptimeNotification.count()).toBe(1)
    vi.setSystemTime(new Date(originTime.getTime() + 5 * 60_000))
    await executeUptimeProbe({ ...job, scheduledAt: new Date().toISOString() }, async () => online)
    const recovered = await db().uptimeIncident.findFirstOrThrow()
    expect(recovered.recoveredAt).toEqual(new Date(originTime.getTime() + 5 * 60_000))
    expect(await db().uptimeNotification.count()).toBe(2)
    const recurrenceAt = new Date(originTime.getTime() + 10 * 60_000)
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
    expect((await loadUptimeSummary(project.id))?.state).toBe('paused')
  })

  it('supersedes target generations without fabricating recovery', async () => {
    const { project, monitor, job } = await monitorFixture()
    await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, startedAt: originTime, confirmedAt: originTime, reason: 'response_error' } })
    await db().project.update({ where: { id: project.id }, data: { url: 'https://example.org/' } })
    const observe = vi.fn(async () => online)
    await executeUptimeProbe(job, observe)
    expect(observe).not.toHaveBeenCalled()
    expect((await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).version).toBe(2)
    const incident = await db().uptimeIncident.findFirstOrThrow()
    expect(incident.supersededAt).not.toBeNull()
    expect(incident.recoveredAt).toBeNull()
    expect((await loadUptimeSummary(project.id))?.segments.every(segment => segment.state === 'unknown')).toBe(true)
  })

  it('rejects queued probes for a suspended account and resumes the retained monitor after reactivation', async () => {
    const { user, monitor, job } = await monitorFixture()
    await db().user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
    expect(await loadUptimeSummary(monitor.projectId, originTime)).toMatchObject({ enabled: false, state: 'paused', nextCheckAt: null })
    expect(await loadUptimeHistory(monitor.projectId, '24h', null, originTime)).toMatchObject({ enabled: false, state: 'paused' })
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
    expect(await loadUptimeSummary(monitor.projectId, originTime)).toMatchObject({ enabled: true, state: 'online' })
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
    await scheduleUptimeProbes()
    expect((await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).nextProbeAt).toEqual(originTime)
    await scheduleUptimeProbes()
    expect(fixture.enqueue.mock.calls.at(-1)?.[0].scheduledAt).toBe(new Date().toISOString())
  })

  it('keeps paused and deleted Sites from consuming the bounded dispatch batch', async () => {
    const { user, monitor } = await monitorFixture()
    const older = new Date(originTime.getTime() - 60 * 60_000)
    for (const index of [1, 2, 3]) {
      const project = await db().project.create({ data: {
        userId: user.id, name: `Inactive ${index}`, canonicalHost: `inactive${index}.example.com`, url: `https://inactive${index}.example.com/`,
        ...(index === 3 ? { deletedAt: originTime, watchInterval: 'WEEKLY', watchNextRunAt: originTime } : {}),
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
    const { project, monitor } = await monitorFixture()
    await db().uptimeProbe.createMany({ data: Array.from({ length: 105 }, (_, index) => ({ monitorId: monitor.id, version: 1, targetUrl: project.url,
      scheduledAt: new Date(originTime.getTime() - (index + 1) * 5 * 60_000), observedAt: new Date(originTime.getTime() - (index + 1) * 5 * 60_000),
      attempt: 1, result: 'ONLINE', reason: 'response_received', durationMs: 10, confirmed: false })) })
    const first = await loadUptimeHistory(project.id)
    expect(first?.probes).toHaveLength(100)
    expect((await loadUptimeHistory(project.id, '24h', first!.nextCursor))?.probes).toHaveLength(5)
    await expect(loadUptimeHistory(project.id, '24h', 'not-a-probe')).rejects.toThrow()
    const old = new Date(originTime.getTime() - 31 * 86400_000)
    await db().uptimeProbe.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, scheduledAt: old, observedAt: old,
      attempt: 1, result: 'FAILED', reason: 'response_error', durationMs: 10, confirmed: true } })
    await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, startedAt: old, confirmedAt: old, reason: 'response_error' } })
    await retainUptimeHistory()
    expect(await db().uptimeProbe.count()).toBe(105)
    expect(await db().uptimeIncident.count()).toBe(1)
  })
})
