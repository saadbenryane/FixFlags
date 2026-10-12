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
    fixture.enqueue.mockClear()
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
  })
  afterAll(async () => { vi.useRealTimers(); await fixture.db?.$disconnect() })

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
    expect((await db().uptimeIncident.findFirstOrThrow()).recoveredAt).not.toBeNull()
    expect(await db().uptimeNotification.count()).toBe(2)
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
