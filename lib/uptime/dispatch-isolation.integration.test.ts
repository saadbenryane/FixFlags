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
run('independent due Uptime dispatch with the installed runtime', () => {
  it.each([false, true])('executes another Site while a due monitor is locked, then resumes its original intent (retarget: %s)', async retarget => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const user = await prisma.user.create({ data: { email: 'uptime-dispatch-' + randomUUID() + '@example.test', role: 'admin', auditsUsed: 3 } })
    let release!: () => void, locked!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const acquired = new Promise<void>(resolve => { locked = resolve })
    let runtime: ReturnType<typeof startUptimeRuntime> | undefined
    let held: Promise<unknown> | undefined
    const dispatch = service.dispatchDueUptimeProbes
    const scheduling = vi.spyOn(service, 'dispatchDueUptimeProbes').mockImplementation(() => dispatch(systemClock, 1))
    const execute = service.executeUptimeProbe
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Useful controlled page</body></html>', complete: true, redirects: [] })))
    const worker = vi.spyOn(service, 'executeUptimeProbe').mockImplementation(job => execute(job, observe))
    try {
      const now = new Date()
      const first = await prisma.project.create({ data: { userId: user.id, name: 'Contended Site',
        url: 'https://first-uptime.example.test/', canonicalHost: 'first-uptime.example.test', watchInterval: 'WEEKLY', watchNextRunAt: now } })
      const second = await prisma.project.create({ data: { userId: user.id, name: 'Independent Site',
        url: 'https://second-uptime.example.test/', canonicalHost: 'second-uptime.example.test', watchInterval: 'WEEKLY', watchNextRunAt: now } })
      const blocked = await prisma.uptimeMonitor.create({ data: { projectId: first.id,
        targetUrl: retarget ? 'https://retired-uptime.example.test/' : first.url, nextProbeAt: new Date(now.getTime() - 1000) } })
      const independent = await prisma.uptimeMonitor.create({ data: { projectId: second.id, targetUrl: second.url, nextProbeAt: now } })
      held = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM uptime_monitors WHERE id = ${blocked.id} FOR UPDATE`
        locked(); await released
      }, { timeout: 20_000 })
      await acquired
      runtime = startUptimeRuntime()
      await runtime.waitUntilReady()
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitorId: independent.id } })).toBe(1)
      }, { timeout: 8000, interval: 20 })
      expect(await loadUptimeSummary(uptimeReadSite(second))).toMatchObject({ state: 'online' })
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: blocked.id } })).toEqual(blocked)
      expect(await prisma.uptimeProbe.count({ where: { monitorId: blocked.id } })).toBe(0)
      expect(observe.mock.calls.map(([url]) => url)).toEqual([second.url])
      release(); await held
      await dispatch(systemClock, 1)
      await vi.waitFor(async () => {
        expect(await loadUptimeSummary(uptimeReadSite(first))).toMatchObject({ state: 'online' })
      }, { timeout: 2000, interval: 20 })
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: blocked.id } })).toMatchObject({
        targetUrl: first.url, version: retarget ? 2 : 1,
      })
      expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(2)
      expect(await prisma.uptimeIncident.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      release?.(); await held; await runtime?.close(); worker.mockRestore(); scheduling.mockRestore()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 25_000)
})
