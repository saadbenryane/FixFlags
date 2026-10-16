import { systemClock } from '@/lib/time/clock'
import { randomUUID } from 'node:crypto'
import { Queue } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { scheduleUptimeProbes, executeUptimeProbe } from './service'
import { startUptimeWorker } from './queue'
import * as uptimeQueue from './queue'
import { probeUptime } from './probe'
import { loadUptimeSummary } from './queries'
import { createQueueRedis } from '@/lib/queue/redis'
import { UPTIME_INTERVAL_MS } from './domain'

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip

run('Uptime dispatch through the installed queue and worker', () => {
  it.each(['failed', 'completed'] as const)('recovers a retained %s job while its probe remains due', async terminalState => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const now = new Date(), identity = randomUUID()
    const scheduledAt = new Date(Math.floor(now.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)
    const user = await prisma.user.create({ data: { email: `retained-${identity}@uptime-test.example`, role: 'admin', preferredTools: [], auditsUsed: 3 } })
    const connection = createQueueRedis(), producer = new Queue('uptime-probes', { connection })
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Controlled public response</body></html>', complete: true, redirects: [] })))
    let interrupted = terminalState === 'failed'
    const worker = startUptimeWorker(async job => {
      if (interrupted) throw new Error('Controlled exhausted worker interruption')
      await executeUptimeProbe(job, observe)
    })
    try {
      const site = await prisma.project.create({ data: { userId: user.id, name: 'Retained', canonicalHost: 'retained.example.com',
        url: 'https://retained.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: now } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url, nextProbeAt: scheduledAt,
        ...(terminalState === 'completed' ? { leaseUntil: new Date(now.getTime() + 30_000), leaseToken: 'abandoned-worker' } : {}),
      } })
      const payload = { monitorId: monitor.id, version: 1, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const }
      const retained = await producer.add('probe', payload, { jobId: uptimeQueue.uptimeJobId(payload), attempts: 1, removeOnComplete: false, removeOnFail: false })
      await vi.waitFor(async () => { expect(await retained.getState()).toBe(terminalState) }, { timeout: 5000, interval: 25 })
      expect(observe).not.toHaveBeenCalled()
      expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
      interrupted = false
      await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { leaseUntil: null, leaseToken: null } })
      await scheduleUptimeProbes(systemClock, 1, site.id)
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      }, { timeout: 2000, interval: 25 })
      await scheduleUptimeProbes(systemClock, 1, site.id)
      expect(await retained.getState()).toBe('completed')
      expect(observe).toHaveBeenCalledOnce()
      expect(await loadUptimeSummary(site.id)).toMatchObject({ state: 'online' })
      expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      await worker.close(); await producer.close(); await connection.quit()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 15_000)
  it('executes a later due Site through the real worker while an earlier queue publication keeps failing', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const now = new Date(), identity = randomUUID()
    const user = await prisma.user.create({ data: { email: `fair-${identity}@uptime-test.example`, role: 'admin', preferredTools: [], auditsUsed: 3 } })
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Controlled public response</body></html>', complete: true, redirects: [] })))
    const worker = startUptimeWorker(job => executeUptimeProbe(job, observe))
    const original = uptimeQueue.enqueueUptimeProbe
    let failingMonitor: string | null = null
    const publish = vi.spyOn(uptimeQueue, 'enqueueUptimeProbe').mockImplementation(async (job, dueAt) => {
      if (job.monitorId === failingMonitor) throw new Error('Controlled persistent publication failure')
      return original(job, dueAt)
    })
    try {
      const projects = await Promise.all(['earlier', 'later'].map(host => prisma.project.create({ data: {
        userId: user.id, name: host, canonicalHost: `${host}.example.com`, url: `https://${host}.example.com/`,
        watchInterval: 'WEEKLY', watchNextRunAt: now,
      } })))
      const monitors = await Promise.all(projects.map((site, index) => prisma.uptimeMonitor.create({ data: {
        projectId: site.id, targetUrl: site.url, nextProbeAt: new Date(now.getTime() - 60_000 + index * 1000),
      } })))
      failingMonitor = monitors[0].id
      await scheduleUptimeProbes(systemClock, 1)
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(systemClock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitors[1].id } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url)).toEqual([projects[1].url])
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitors[0].id } })).toMatchObject({
        nextProbeAt: monitors[0].nextProbeAt, lastCheckedAt: null, lastScheduledAt: null,
      })
      failingMonitor = null
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(systemClock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitors[0].id } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(await loadUptimeSummary(projects[0].id)).toMatchObject({ state: 'online' })
      expect(await loadUptimeSummary(projects[1].id)).toMatchObject({ state: 'online' })
      expect(await prisma.uptimeIncident.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      publish.mockRestore(); await worker.close(); await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 30_000)
  it('monitors later Sites past a full failing setup batch and retries the retained Sites when due', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const identity = randomUUID(), now = new Date()
    const user = await prisma.user.create({ data: { email: `bounded-${identity}@uptime-test.example`, role: 'admin', preferredTools: [], auditsUsed: 3 } })
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Controlled public response</body></html>', complete: true, redirects: [] })))
    const worker = startUptimeWorker(job => executeUptimeProbe(job, observe))
    let rejectSetup = true
    const original = prisma.uptimeMonitor.upsert.bind(prisma.uptimeMonitor)
    const setup = vi.spyOn(prisma.uptimeMonitor, 'upsert').mockImplementation(args => {
      if (rejectSetup && failing.has(args.where.projectId!)) throw new Error('Controlled bounded setup failure')
      return original(args)
    })
    const failing = new Set<string>()
    try {
      const projects = await Promise.all(['first-failure', 'second-failure', 'following'].map((host, index) => prisma.project.create({ data: {
        userId: user.id, name: host, canonicalHost: `${host}.example.com`, url: `https://${host}.example.com/`,
        watchInterval: 'WEEKLY', watchNextRunAt: now, createdAt: new Date('2000-01-0' + (index + 1) + 'T00:00:00Z'),
      } })))
      failing.add(projects[0].id); failing.add(projects[1].id)
      for (let batch = 0; batch < 3; batch++) await scheduleUptimeProbes(systemClock, 1)
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(systemClock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitor: { projectId: projects[2].id } } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url)).toEqual([projects[2].url])
      expect(await loadUptimeSummary(projects[2].id)).toMatchObject({ enabled: true, state: 'online' })
      rejectSetup = false
      // Make the persisted retry due without waiting a minute in the fixture.
      await prisma.project.updateMany({ where: { id: { in: [...failing] } }, data: { monitoringSetupRetryAt: new Date(Date.now() - 1) } })
      for (let batch = 0; batch < 2; batch++) await scheduleUptimeProbes(systemClock, 1)
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(systemClock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(3)
      }, { timeout: 10_000, interval: 50 })
      expect(await prisma.uptimeMonitor.count({ where: { project: { userId: user.id } } })).toBe(3)
      expect(await prisma.project.count({ where: { userId: user.id, monitoringSetupRetryAt: { not: null } } })).toBe(0)
      expect(await prisma.uptimeIncident.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      setup.mockRestore(); await worker.close(); await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 30_000)
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
        await scheduleUptimeProbes(systemClock)
        expect(setup.mock.calls[0][0].where.projectId).toBe(projects[1].id)
      } finally { setup.mockRestore() }
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(2)
      }, { timeout: 10_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url).sort()).toEqual([projects[0].url, projects[2].url].sort())
      expect(await prisma.uptimeMonitor.findUnique({ where: { projectId: projects[1].id } })).toBeNull()
      expect(await loadUptimeSummary(projects[0].id)).toMatchObject({ enabled: true, state: 'online' })
      expect(await loadUptimeSummary(projects[2].id)).toMatchObject({ enabled: true, state: 'online' })
      expect((await prisma.project.findUniqueOrThrow({ where: { id: projects[1].id } })).monitoringSetupRetryAt).toBeInstanceOf(Date)
      await prisma.project.update({ where: { id: projects[1].id }, data: { monitoringSetupRetryAt: new Date(Date.now() - 1) } })
      await scheduleUptimeProbes(systemClock, 10, projects[1].id)
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
