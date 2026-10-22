import { randomUUID } from 'node:crypto'
import { createServer } from 'node:https'
import { Agent } from 'undici'
import { Queue } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis } from '@/lib/queue/redis'
import { probeUptime } from './probe'
import { executeUptimeProbe, scheduleUptimeProbes } from './service'
import { startUptimeWorker, uptimeJobId } from './queue'
import { loadUptimeHistory, loadUptimeSummary } from './queries'
import { UPTIME_INTERVAL_MS } from './domain'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { createTestTlsCertificates } from '@/lib/audit/__tests__/tls-certificates'
import { readMonitoringHealth } from '@/lib/health/monitoring'

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip
run('certificate failures through real TLS and the installed uptime worker', () => {
  const identity = randomUUID(), target = 'https://example.com/'
  let tls: ReturnType<typeof createTestTlsCertificates> | undefined, server: ReturnType<typeof createServer> | undefined
  let transport = '', httpRequests = 0, bodyInterrupted = false
  let trusted: Agent, untrusted: Agent, trustAvailable = true
  let worker: ReturnType<typeof startUptimeWorker> | undefined
  let userId: string | undefined, projectId: string, monitorId: string
  // Force confirmation across a regular slot boundary. Simulated observations
  // must still advance in the same order as the real worker's clock.
  let instant = new Date(Math.floor(Date.now() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS + UPTIME_INTERVAL_MS - 10_000)
  const clock = { now: () => new Date(instant) }
  let connection: ReturnType<typeof createQueueRedis> | undefined, producer: Queue | undefined
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname) ||
      !['localhost', '127.0.0.1'].includes(new URL(process.env.REDIS_URL!).hostname)) throw new Error('Use the disposable uptime execution verifier')
    tls = createTestTlsCertificates()
    server = createServer({ key: tls.key, cert: tls.certificates.expired }, (_request, response) => {
      httpRequests++; response.setHeader('content-type', 'text/html'); response.setHeader('connection', 'close')
      if (bodyInterrupted) {
        response.write('<html><body>Incomplete response')
        setTimeout(() => response.destroy(), 20); return
      }
      response.end('<html><body>Verified HTTPS fixture response</body></html>')
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
    transport = 'https://127.0.0.1:' + (server.address() as { port: number }).port
    trusted = new Agent({ connect: { ca: tls.ca, servername: 'example.com' }, pipelining: 0 })
    untrusted = new Agent({ connect: { servername: 'example.com' }, pipelining: 0 })
    const nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== 'https://example.com') throw new Error('External transport unavailable in this fixture')
      // Only socket destination and the fixture CA change. TLS verification,
      // SNI and hostname validation stay enabled against the recorded host.
      return nativeFetch(transport + url.pathname + url.search, { ...options, dispatcher: trustAvailable ? trusted : untrusted } as RequestInit)
    })
    const user = await prisma.user.create({ data: { email: 'tls-' + identity + '@uptime-test.example', auditsUsed: 3 } })
    userId = user.id
    const project = await prisma.project.create({ data: { userId, name: 'TLS uptime fixture', canonicalHost: 'example.com', url: target,
      watchInterval: 'WEEKLY', watchNextRunAt: instant } })
    projectId = project.id
    connection = createQueueRedis(); producer = new Queue('uptime-probes', { connection })
    await producer.waitUntilReady()
    worker = startUptimeWorker(job => executeUptimeProbe(job, probeUptime, clock))
  })
  afterAll(async () => {
    try { await worker?.close() }
    finally {
      await producer?.close(); await connection?.quit()
      if (userId) await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.$disconnect()
      await trusted?.close(); await untrusted?.close()
      if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())) }
      tls?.dispose()
      vi.unstubAllGlobals()
    }
  })
  async function observe(expectedCount: number, expectedResult: string, reason: string, statusCode = expectedResult === 'ONLINE' ? 200 : null) {
    await scheduleUptimeProbes(clock, 1, projectId)
    const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId } })
    monitorId = monitor.id
    const payload = { monitorId, version: monitor.version, scheduledAt: (monitor.pendingSlotAt ??
      new Date(Math.floor(instant.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)).toISOString(), attempt: monitor.pendingSlotAt ? 2 as const : 1 as const }
    const queued = await producer!.getJob(uptimeJobId(payload))
    // Advance only this controlled cadence. Promotion exercises real Redis
    // delivery without claiming sustained wall-clock monitoring proof.
    if (queued && await queued.getState() === 'delayed') await queued.promote()
    await vi.waitFor(async () => {
      expect(await prisma.uptimeProbe.count({ where: { monitorId } })).toBe(expectedCount)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).toMatchObject({ leaseToken: null })
    }, { timeout: 8000, interval: 25 })
    const rows = await prisma.uptimeProbe.findMany({ where: { monitorId }, orderBy: [{ observedAt: 'desc' }, { attempt: 'desc' }] })
    expect(rows[0]).toMatchObject({ result: expectedResult, reason, statusCode, targetUrl: target })
  }
  async function nextSlot() {
    const due = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).nextProbeAt
    instant = new Date(Math.max(instant.getTime() + 1, due.getTime()))
  }
  function useCertificate(kind: string) {
    server!.setSecureContext({ key: tls!.key, cert: tls!.certificates[kind] })
  }
  it('confirms expiry, preserves an incident through uncertainty, independently recovers and recognizes recurrence', async () => {
    await observe(1, 'FAILED', 'certificate_expired')
    expect(httpRequests).toBe(0)
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(0)
    expect(await loadUptimeSummary(projectId, clock.now())).toMatchObject({ state: 'checking', openIncidentCount: 0 })
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    await observe(2, 'FAILED', 'certificate_expired')
    const incident = await prisma.uptimeIncident.findFirstOrThrow({ where: { monitorId } })
    expect(incident).toMatchObject({ reason: 'certificate_expired', recoveredAt: null })
    expect(await prisma.uptimeNotification.findMany({ where: { incidentId: incident.id } })).toMatchObject([{ kind: 'DOWN', status: 'PENDING' }])
    useCertificate('valid'); trustAvailable = false; await nextSlot()
    await observe(3, 'UNKNOWN', 'probe_unavailable')
    expect(await loadUptimeSummary(projectId, clock.now())).toMatchObject({ state: 'unknown', openIncidentCount: 1 })
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
    expect((await readMonitoringHealth(clock.now())).inconclusiveUptimeSites).toBe(0)
    await nextSlot(); await observe(4, 'UNKNOWN', 'probe_unavailable')
    expect((await readMonitoringHealth(clock.now())).inconclusiveUptimeSites).toBe(0)
    await nextSlot(); await observe(5, 'UNKNOWN', 'probe_unavailable')
    // The confirmation crossed the slot boundary, so its conclusive evidence
    // is still inside the ten-minute window after these three unknown probes.
    expect((await readMonitoringHealth(clock.now())).inconclusiveUptimeSites).toBe(0)
    await nextSlot(); await observe(6, 'UNKNOWN', 'probe_unavailable')
    expect(await readMonitoringHealth(clock.now())).toMatchObject({ overdueUptimeProbes: 0, inconclusiveUptimeSites: 1 })
    trustAvailable = true; useCertificate('mismatch'); await nextSlot()
    await observe(7, 'FAILED', 'certificate_name_mismatch')
    expect((await readMonitoringHealth(clock.now())).inconclusiveUptimeSites).toBe(0)
    useCertificate('self-signed'); await nextSlot()
    await observe(8, 'FAILED', 'certificate_untrusted')
    expect(httpRequests).toBe(0)
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(1)
    useCertificate('valid'); bodyInterrupted = true; await nextSlot()
    await observe(9, 'UNKNOWN', 'probe_unavailable', 200)
    expect(await loadUptimeSummary(projectId, clock.now())).toMatchObject({ state: 'unknown', openIncidentCount: 1 })
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
    expect(await prisma.uptimeNotification.count({ where: { incidentId: incident.id, kind: 'RECOVERED' } })).toBe(0)
    bodyInterrupted = false; await nextSlot()
    await observe(10, 'ONLINE', 'response_received')
    expect(httpRequests).toBe(2)
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: clock.now() })
    expect(await prisma.uptimeNotification.count({ where: { incidentId: incident.id, kind: 'RECOVERED' } })).toBe(1)
    useCertificate('expired'); await nextSlot()
    await observe(11, 'FAILED', 'certificate_expired')
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    await observe(12, 'FAILED', 'certificate_expired')
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(2)
    const history = await loadUptimeHistory(projectId, '24h', null, clock.now())
    expect(history).toMatchObject({ state: 'offline', openIncidentCount: 1, probes: expect.any(Array) })
    expect(history!.probes).toHaveLength(12)
    for (const row of history!.probes) expect(UPTIME_COPY.reasons[row.reason as keyof typeof UPTIME_COPY.reasons]).toBeTruthy()
    expect(await prisma.audit.count({ where: { projectId } })).toBe(0)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ auditsUsed: 3 })
  }, 60_000)
})
