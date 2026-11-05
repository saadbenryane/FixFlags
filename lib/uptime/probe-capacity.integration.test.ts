import { uptimeReadSite } from './__tests__/read-site'
import { systemClock } from '@/lib/time/clock'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { publicHttpCapacity } from '@/lib/audit/progressive/capacity'
import { scheduleUptimeProbes, executeUptimeProbe } from './service'
import { startUptimeWorker, enqueueUptimeProbe, uptimeJobId } from './queue'
import { Queue } from 'bullmq'
import { createQueueRedis } from '@/lib/queue/redis'
import { UPTIME_INTERVAL_MS } from './domain'
import { loadUptimeSummary } from './queries'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
import { probeUptime } from './probe'
import { safeFetchDocument } from '@/lib/audit/url'

const dns = vi.hoisted(() => ({ resolve4: vi.fn(async () => ['93.184.216.34']), resolve6: vi.fn(async () => []) }))
vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(dns))
vi.mock('@/lib/billing/beta-policy', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/billing/beta-policy')>(), OPEN_BETA_ACCESS: false, hasOpenBetaAccess: () => false,
}))
const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip

run('native public HTTP probe under execution contention', () => {
  it.each(['online', 'offline'] as const)('keeps connection DNS uncertainty from changing %s incident history through the installed worker', async state => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const identity = randomUUID(), targetUrl = 'http://connection-dns.example.com/'
    const user = await prisma.user.create({ data: { email: `connection-dns-${identity}@uptime-test.example` } })
    const connection = createQueueRedis(), queue = new Queue('uptime-probes', { connection })
    // Shorten only the response window. Resolution, sockets, failure
    // classification and the installed queue consumer remain real.
    const worker = startUptimeWorker(job => executeUptimeProbe(job, target => probeUptime(target,
      (url, options) => safeFetchDocument(url, { ...options, timeoutMs: 80 }))))
    try {
      const project = await prisma.project.create({ data: { userId: user.id, name: 'Connection DNS uncertainty', url: targetUrl,
        canonicalHost: 'connection-dns.example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date() } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl, state, nextProbeAt: new Date(0) } })
      const incident = state === 'offline' ? await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version,
        targetUrl, reason: 'response_error', startedAt: new Date(Date.now() - 60_000), confirmedAt: new Date(Date.now() - 30_000) } }) : null
      if (incident) await prisma.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN' } })
      dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockImplementation(() => new Promise(() => {}))
      const now = new Date(), scheduledAt = new Date(Math.floor(now.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)
      const job = { monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const }
      await enqueueUptimeProbe(job, now)
      await vi.waitFor(async () => {
        expect(await (await queue.getJob(uptimeJobId(job)))?.getState()).toBe('completed')
      }, { timeout: 5000, interval: 25 })
      expect(await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId: monitor.id } }))
        .toMatchObject({ result: 'UNKNOWN', confirmed: false, statusCode: null })
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } }))
        .toMatchObject({ state: 'unknown', pendingFailureAt: null, confirmationDueAt: null, leaseToken: null, leaseUntil: null })
      expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(incident ? 1 : 0)
      if (incident) expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toEqual(incident)
      expect(await prisma.uptimeNotification.findMany({ where: { incident: { monitorId: monitor.id } }, select: { kind: true } }))
        .toEqual(incident ? [{ kind: 'DOWN' }] : [])
      expect(publicHttpCapacity.running).toBe(0)
    } finally {
      await worker.close(); await queue.close(); await connection.quit()
      dns.resolve4.mockReset().mockResolvedValue(['93.184.216.34']); dns.resolve6.mockReset().mockResolvedValue([])
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
  it('completes an installed probe once when its Site is physically removed during the HTTP request', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    let requests = 0, projectId: string | undefined, userId: string | undefined
    const server = createServer(async (_request, response) => {
      requests++
      try {
        await prisma.project.delete({ where: { id: projectId! } })
        response.statusCode = 503
        response.end('Controlled response after Site removal')
      } catch { response.statusCode = 500; response.end('Fixture removal failed') }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port, nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== 'https://removed.example.com') throw new Error('External service unavailable in this fixture')
      return nativeFetch(`http://127.0.0.1:${port}${url.pathname}`, options)
    })
    const connection = createQueueRedis(), queue = new Queue('uptime-probes', { connection })
    const worker = startUptimeWorker(job => executeUptimeProbe(job))
    try {
      const identity = randomUUID()
      const user = await prisma.user.create({ data: { email: `removed-${identity}@uptime-test.example` } })
      userId = user.id
      const project = await prisma.project.create({ data: { userId, name: 'Removed probe fixture', url: 'https://removed.example.com/',
        canonicalHost: 'removed.example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date() } })
      projectId = project.id
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: project.url, nextProbeAt: new Date(0) } })
      const now = new Date(), scheduledAt = new Date(Math.floor(now.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)
      const job = { monitorId: monitor.id, version: monitor.version, attempt: 1 as const, scheduledAt: scheduledAt.toISOString() }
      await enqueueUptimeProbe(job, now)
      await vi.waitFor(async () => {
        const delivered = await queue.getJob(uptimeJobId(job))
        expect(await delivered?.getState()).toBe('completed')
        expect(delivered?.attemptsMade).toBe(1)
      }, { timeout: 10_000, interval: 25 })
      expect(requests).toBe(1)
      expect(await prisma.project.count({ where: { id: projectId } })).toBe(0)
      expect(await prisma.uptimeMonitor.count({ where: { id: monitor.id } })).toBe(0)
      expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
      expect((await queue.getJobs(['delayed', 'waiting', 'active'])).some(delivery => delivery.data.monitorId === monitor.id)).toBe(false)
    } finally {
      await worker.close(); await queue.close(); await connection.quit()
      vi.unstubAllGlobals()
      server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
      if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    }
  })
  it('keeps separately included uptime active when analysis grants expire, are revoked or leave a halted analysis schedule', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    let requests = 0, changeGrant = async () => {}
    const server = createServer(async (_request, response) => {
      requests++
      try { await changeGrant(); response.setHeader('content-type', 'text/html'); response.end('<html><body>Healthy public website</body></html>') }
      catch { response.statusCode = 500; response.end('Fixture could not change its grant') }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port, nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== 'https://grant.example.com') throw new Error('External service unavailable in this fixture')
      return nativeFetch(`http://127.0.0.1:${port}${url.pathname}`, options)
    })
    const userIds: string[] = [], worker = startUptimeWorker(job => executeUptimeProbe(job))
    try {
      for (const phase of ['active', 'revoked', 'expired', 'halted-analysis', 'previously-disabled'] as const) {
        const now = new Date(), identity = randomUUID()
        const user = await prisma.user.create({ data: { email: `grant-${identity}@uptime-test.example`, auditsUsed: 3 } })
        userIds.push(user.id)
        const grant = await prisma.entitlementGrant.create({ data: { userId: user.id, operationId: identity,
          grantedBy: 'local-fixture', plan: 'TEAM', expiresAt: new Date(now.getTime() + 60 * 60_000) } })
        const project = await prisma.project.create({ data: { userId: user.id, name: 'Granted monitor', canonicalHost: 'grant.example.com', url: 'https://grant.example.com/' } })
        expect(await productTransaction(tx => ensureDefaultMonitoring(tx, project.id, user.id, now))).toBe(true)
        expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ watchInterval: 'DAILY', watchNextRunAt: now })
        if (phase === 'halted-analysis' || phase === 'previously-disabled') await prisma.project.update({ where: { id: project.id }, data: { watchNextRunAt: null,
          watchLastError: 'This schedule is not available on your plan. Choose an available monitoring schedule.' } })
        let previous: { monitorId: string; probeId: string } | null = null
        if (phase === 'previously-disabled') {
          await prisma.entitlementGrant.update({ where: { id: grant.id }, data: { revokedAt: now } })
          const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url,
            enabled: false, state: 'paused', nextProbeAt: now } })
          const before = new Date(now.getTime() - 300_000)
          const probe = await prisma.uptimeProbe.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
            scheduledAt: before, observedAt: before, attempt: 1, result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 50, finalUrl: project.url } })
          previous = { monitorId: monitor.id, probeId: probe.id }
        }
        changeGrant = async () => {
          if (phase === 'revoked' || phase === 'expired') await prisma.entitlementGrant.update({ where: { id: grant.id }, data: phase === 'revoked'
            ? { revokedAt: new Date() } : { expiresAt: new Date() } })
        }
        const before = requests
        await scheduleUptimeProbes(systemClock, 1, project.id)
        await vi.waitFor(async () => {
          expect(requests).toBe(before + 1)
          expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: project.id } })).toMatchObject({ leaseToken: null })
        }, { timeout: 10_000, interval: 25 })
        const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: project.id } })
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(previous ? 2 : 1)
        if (previous) {
          expect(monitor.id).toBe(previous.monitorId)
          expect(await prisma.uptimeProbe.findUniqueOrThrow({ where: { id: previous.probeId } }))
            .toMatchObject({ result: 'ONLINE', statusCode: 200, monitorId: monitor.id })
        }
        expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ enabled: true, state: 'online' })
        expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
        expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
        expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ plan: 'FREE', subscriptionStatus: 'NONE', auditsUsed: 3 })
      }
    } finally {
      await worker.close(); vi.unstubAllGlobals()
      server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect()
    }
  }, 40_000)

  it('records a healthy six-second response after four seconds of local capacity waiting without opening an incident', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    let requests = 0
    const server = createServer((_request, response) => {
      requests++
      setTimeout(() => { response.setHeader('content-type', 'text/html'); response.end('<html><body>Healthy public website</body></html>') }, 6000)
    })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const port = (server.address() as { port: number }).port
    const nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== 'https://capacity.example.com') throw new Error('External service unavailable in this fixture')
      return nativeFetch(`http://127.0.0.1:${port}${url.pathname}`, options)
    })
    let userId: string | undefined, worker: ReturnType<typeof startUptimeWorker> | undefined
    const releases: Array<() => void> = []
    try {
      const identity = randomUUID(), now = new Date()
      const user = await prisma.user.create({ data: { email: `capacity-${identity}@uptime-test.example`, role: 'admin', auditsUsed: 3 } })
      userId = user.id
      const project = await prisma.project.create({ data: { userId: user.id, name: 'Capacity fixture', canonicalHost: 'capacity.example.com',
        url: 'https://capacity.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: now } })
      for (let index = 0; index < publicHttpCapacity.capacity; index++) releases.push(await publicHttpCapacity.acquire())
      worker = startUptimeWorker(job => executeUptimeProbe(job))
      await scheduleUptimeProbes(systemClock, 1, project.id)
      await vi.waitFor(() => expect(publicHttpCapacity.queued).toBe(1), { timeout: 5000, interval: 20 })
      expect(requests).toBe(0)
      await new Promise(resolve => setTimeout(resolve, 4000))
      releases.forEach(release => release())
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitor: { projectId: project.id } } })).toBe(1)
      }, { timeout: 12_000, interval: 50 })
      const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: project.id } })
      const observation = await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId: monitor.id } })
      expect(observation).toMatchObject({ result: 'ONLINE', statusCode: 200, confirmed: false })
      expect(observation.durationMs).toBeGreaterThanOrEqual(6000)
      expect(observation.durationMs).toBeLessThan(8000)
      expect(monitor).toMatchObject({ state: 'online', pendingFailureAt: null, leaseToken: null, leaseUntil: null })
      expect(requests).toBe(1)
      expect(await loadUptimeSummary(uptimeReadSite(project))).toMatchObject({ enabled: true, state: 'online', openIncidentCount: 0 })
      expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ auditsUsed: 3 })
      expect(publicHttpCapacity.running).toBe(0)
    } finally {
      releases.forEach(release => release())
      await worker?.close()
      vi.unstubAllGlobals()
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
      if (userId) await prisma.user.delete({ where: { id: userId } })
      await prisma.$disconnect()
    }
  }, 30_000)
})
