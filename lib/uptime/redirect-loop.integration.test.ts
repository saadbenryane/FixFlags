import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { Queue } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis } from '@/lib/queue/redis'
import { probeUptime } from './probe'
import { executeUptimeProbe, scheduleUptimeProbes } from './service'
import { startUptimeWorker, uptimeJobId } from './queue'
import { loadUptimeHistory, loadUptimeSummary } from './queries'
import { UPTIME_INTERVAL_MS } from './domain'

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip
run('redirect evidence through public HTTP and the installed uptime worker', () => {
  const target = 'http://example.com/'
  let phase = 'loop', userId: string, projectId: string, monitorId: string
  let worker: ReturnType<typeof startUptimeWorker> | undefined, producer: Queue | undefined
  let connection: ReturnType<typeof createQueueRedis> | undefined
  let instant = new Date(Math.floor(Date.now() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS + UPTIME_INTERVAL_MS - 10_000)
  const clock = { now: () => new Date(instant) }
  const server = createServer((request, response) => {
    const path = new URL(request.url!, target)
    if (phase === 'repaired') { response.setHeader('content-type', 'text/html'); response.end('<html><body>Service available</body></html>'); return }
    if (phase === 'cookie' && path.pathname === '/') response.setHeader('set-cookie', 'visitor=allowed; Path=/')
    response.writeHead(302, { location: phase === 'chain' ? '/chain/' + (Number(path.pathname.split('/').at(-1)) + 1 || 1)
      : path.pathname === '/again' ? '/' : '/again' })
    response.end()
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== new URL(target).origin) throw new Error('External transport unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    userId = 'redirect-uptime-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsUsed: 3 } })
    const site = await prisma.project.create({ data: { userId, name: 'Redirect uptime fixture', canonicalHost: 'example.com', url: target,
      watchInterval: 'WEEKLY', watchNextRunAt: instant } })
    projectId = site.id
    connection = createQueueRedis(); producer = new Queue('uptime-probes', { connection })
    await producer.waitUntilReady()
    worker = startUptimeWorker(job => executeUptimeProbe(job, probeUptime, clock))
  })
  afterAll(async () => {
    await worker?.close(); await producer?.close(); await connection?.quit()
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals()
  })
  async function observe(count: number, result: string, reason: string) {
    await scheduleUptimeProbes(clock, 1, projectId)
    const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId } })
    monitorId = monitor.id
    const payload = { monitorId, version: monitor.version, scheduledAt: (monitor.pendingSlotAt ??
      new Date(Math.floor(instant.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)).toISOString(), attempt: monitor.pendingSlotAt ? 2 as const : 1 as const }
    const queued = await producer!.getJob(uptimeJobId(payload))
    // Promote only the controlled fixture's due job; this is not wall-clock proof.
    if (queued && await queued.getState() === 'delayed') await queued.promote()
    await vi.waitFor(async () => {
      expect(await prisma.uptimeProbe.count({ where: { monitorId } })).toBe(count)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).toMatchObject({ leaseToken: null })
    }, { timeout: 8000, interval: 25 })
    expect(await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId }, orderBy: [{ observedAt: 'desc' }, { attempt: 'desc' }] }))
      .toMatchObject({ result, reason, statusCode: result === 'ONLINE' ? 200 : 302, targetUrl: target })
  }
  async function advance() {
    const due = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).nextProbeAt
    instant = new Date(Math.max(instant.getTime() + 1, due.getTime()))
  }
  it('confirms loops, retains the incident across inconclusive redirects, independently recovers and detects recurrence', async () => {
    await observe(1, 'FAILED', 'redirect_loop')
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(0)
    const original = await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId } })
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    await observe(2, 'FAILED', 'redirect_loop')
    const incident = await prisma.uptimeIncident.findFirstOrThrow({ where: { monitorId } })
    expect(incident).toMatchObject({ reason: 'redirect_loop', recoveredAt: null })
    expect(await loadUptimeSummary(projectId, clock.now())).toMatchObject({ state: 'offline', openIncidentCount: 1 })
    phase = 'chain'; await advance(); await observe(3, 'UNKNOWN', 'redirect_unresolved')
    phase = 'cookie'; await advance(); await observe(4, 'UNKNOWN', 'redirect_unresolved')
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
    expect(await prisma.uptimeNotification.count({ where: { incidentId: incident.id, kind: 'RECOVERED' } })).toBe(0)
    phase = 'repaired'; await advance(); await observe(5, 'ONLINE', 'response_received')
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: instant })
    expect(await prisma.uptimeNotification.findMany({ where: { incidentId: incident.id }, orderBy: { createdAt: 'asc' } }))
      .toMatchObject([{ kind: 'DOWN', status: 'PENDING' }, { kind: 'RECOVERED', status: 'PENDING' }])
    phase = 'loop'; await advance(); await observe(6, 'FAILED', 'redirect_loop')
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    await observe(7, 'FAILED', 'redirect_loop')
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(2)
    expect(await loadUptimeSummary(projectId, clock.now())).toMatchObject({ state: 'offline', openIncidentCount: 1 })
    expect((await loadUptimeHistory(projectId, '24h', null, clock.now()))!.probes).toHaveLength(7)
    expect(await prisma.uptimeProbe.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ auditsUsed: 3 })
  }, 30_000)
})
