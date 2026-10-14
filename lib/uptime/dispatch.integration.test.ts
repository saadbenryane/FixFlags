import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { scheduleUptimeProbes, executeUptimeProbe } from './service'
import { startUptimeWorker } from './queue'
import { probeUptime } from './probe'
import { loadUptimeSummary } from './queries'

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip

run('Uptime dispatch through the installed queue and worker', () => {
  it('keeps independent Sites monitored through setup failure and retry without browser sessions or analysis credits', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const now = new Date(), identity = randomUUID()
    const user = await prisma.user.create({ data: { email: `dispatch-${identity}@uptime-test.example`, role: 'admin', preferredTools: [], auditsUsed: 3 } })
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Controlled public response</body></html>', complete: true, redirects: [] })))
    const worker = startUptimeWorker(job => executeUptimeProbe(job, observe))
    try {
      const projects = await Promise.all(['existing', 'setup-failure', 'setup-success'].map((label, index) => prisma.project.create({ data: {
        userId: user.id, name: label, canonicalHost: `${label}.example.com`, url: `https://${label}.example.com/`,
        watchInterval: 'WEEKLY', watchNextRunAt: now, createdAt: new Date(now.getTime() - 3000 + index * 1000),
      } })))
      const existing = await prisma.uptimeMonitor.create({ data: { projectId: projects[0].id, targetUrl: projects[0].url, nextProbeAt: now } })
      const setup = vi.spyOn(prisma.uptimeMonitor, 'upsert').mockRejectedValueOnce(new Error('Controlled dispatch setup failure'))
      try {
        await scheduleUptimeProbes(now)
        expect(setup.mock.calls[0][0].where.projectId).toBe(projects[1].id)
      } finally { setup.mockRestore() }
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(2)
      }, { timeout: 10_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url).sort()).toEqual([projects[0].url, projects[2].url].sort())
      expect(await prisma.uptimeMonitor.findUnique({ where: { projectId: projects[1].id } })).toBeNull()
      expect(await loadUptimeSummary(projects[0].id)).toMatchObject({ enabled: true, state: 'online' })
      expect(await loadUptimeSummary(projects[2].id)).toMatchObject({ enabled: true, state: 'online' })
      await scheduleUptimeProbes(new Date(), 10, projects[1].id)
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitor: { projectId: projects[1].id } } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(observe).toHaveBeenCalledTimes(3)
      expect(await loadUptimeSummary(projects[1].id)).toMatchObject({ enabled: true, state: 'online' })
      expect((await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: projects[0].id } })).id).toBe(existing.id)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      await worker.close()
      await prisma.user.delete({ where: { id: user.id } })
      await prisma.$disconnect()
    }
  }, 30_000)
})
