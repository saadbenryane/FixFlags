import { uptimeReadSite } from './__tests__/read-site'
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { systemClock } from '@/lib/time/clock'
import * as service from './service'
import { startUptimeRuntime } from './runtime'
import { probeUptime } from './probe'
import { loadUptimeSummary } from './queries'

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip
run('independent initial Uptime setup with the installed runtime', () => {
  it('starts the next Site in a one-Site setup batch while the first is locked and probes both after release', async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const user = await prisma.user.create({ data: { email: 'uptime-setup-' + randomUUID() + '@example.test', role: 'admin', auditsUsed: 3 } })
    let release!: () => void, locked!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const owner = new Promise<void>(resolve => { locked = resolve })
    let runtime: ReturnType<typeof startUptimeRuntime> | undefined
    let held: Promise<unknown> | undefined
    const execute = service.executeUptimeProbe
    // Real SQL, queue delivery and worker execution use a controlled successful
    // HTTP observation. This does not establish public transport or live care.
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Useful controlled page</body></html>', complete: true, redirects: [] })))
    const worker = vi.spyOn(service, 'executeUptimeProbe').mockImplementation(job => execute(job, observe))
    const initialize = service.initializeUptimeMonitors
    const setup = vi.spyOn(service, 'initializeUptimeMonitors').mockImplementation(() => initialize(systemClock, 1))
    try {
      const now = new Date()
      const existing = await prisma.project.create({ data: { userId: user.id, name: 'Existing uptime',
        url: 'https://existing-uptime.example.test/', canonicalHost: 'existing-uptime.example.test', watchInterval: 'WEEKLY', watchNextRunAt: now } })
      const initial = await prisma.project.create({ data: { userId: user.id, name: 'Initial uptime',
        url: 'https://initial-uptime.example.test/', canonicalHost: 'initial-uptime.example.test', watchInterval: 'WEEKLY',
        watchNextRunAt: now, createdAt: new Date(1) } })
      const independent = await prisma.project.create({ data: { userId: user.id, name: 'Independent uptime',
        url: 'https://independent-uptime.example.test/', canonicalHost: 'independent-uptime.example.test', watchInterval: 'WEEKLY',
        watchNextRunAt: now, createdAt: new Date(2) } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: existing.id, targetUrl: existing.url, nextProbeAt: now } })
      held = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM projects WHERE id = ${initial.id} FOR UPDATE`
        locked()
        await released
      }, { timeout: 15_000 })
      await Promise.race([owner, held])
      runtime = startUptimeRuntime()
      await runtime.waitUntilReady()
      await vi.waitFor(async () => {
        expect(await prisma.uptimeMonitor.count({ where: { projectId: independent.id } })).toBe(1)
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      }, { timeout: 3000, interval: 20 })
      await service.dispatchDueUptimeProbes(systemClock, 1, independent.id)
      await vi.waitFor(async () => {
        expect(await loadUptimeSummary(uptimeReadSite(independent))).toMatchObject({ state: 'online' })
      }, { timeout: 2000, interval: 20 })
      expect(await loadUptimeSummary(uptimeReadSite(existing))).toMatchObject({ state: 'online' })
      expect(await prisma.uptimeMonitor.count({ where: { projectId: initial.id } })).toBe(0)
      expect(observe.mock.calls.map(([url]) => url).sort()).toEqual([existing.url, independent.url].sort())
      release(); await held
      setup.mockRestore()
      await service.scheduleUptimeProbes(systemClock, 1, initial.id)
      await vi.waitFor(async () => {
        expect(await loadUptimeSummary(uptimeReadSite(initial))).toMatchObject({ state: 'online' })
      }, { timeout: 2000, interval: 20 })
      expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(3)
      expect(await prisma.uptimeIncident.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      release?.(); await held; await runtime?.close(); setup.mockRestore(); worker.mockRestore()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 15_000)
})
