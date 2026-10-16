import { systemClock } from '@/lib/time/clock'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { publicHttpCapacity } from '@/lib/audit/progressive/capacity'
import { scheduleUptimeProbes, executeUptimeProbe } from './service'
import { startUptimeWorker } from './queue'
import { loadUptimeSummary } from './queries'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'

vi.mock('node:dns/promises', () => ({ resolve4: vi.fn(async () => ['93.184.216.34']), resolve6: vi.fn(async () => []) }))
vi.mock('@/lib/billing/beta-policy', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/billing/beta-policy')>(), OPEN_BETA_ACCESS: false, hasOpenBetaAccess: () => false,
}))
const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip

run('native public HTTP probe under execution contention', () => {
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
        expect(await loadUptimeSummary(project.id)).toMatchObject({ enabled: true, state: 'online' })
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
      expect(await loadUptimeSummary(project.id)).toMatchObject({ enabled: true, state: 'online', openIncidentCount: 0 })
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
