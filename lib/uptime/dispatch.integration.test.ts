import { uptimeReadSite } from './__tests__/read-site'
import { rejectMonitorSetup } from './__tests__/setup-failure'
import { fixedClock, systemClock } from '@/lib/time/clock'
import { randomUUID } from 'node:crypto'
import { Job, Queue } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { scheduleUptimeProbes, executeUptimeProbe } from './service'
import { startUptimeWorker } from './queue'
import * as uptimeQueue from './queue'
import { probeUptime } from './probe'
import { loadUptimeSummary } from './queries'
import { createQueueRedis } from '@/lib/queue/redis'
import { UPTIME_CONFIRMATION_MS, UPTIME_INTERVAL_MS, uptimeSlotStart, type ProbeObservation } from './domain'
import { performAdminExternalAction } from '@/lib/admin/external-actions'

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip

run('Uptime dispatch through the installed queue and worker', () => {
  it('acknowledges a committed probe when standalone lease cleanup is unavailable', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const now = new Date(), clock = fixedClock(now)
    const scheduledAt = new Date(Math.floor(now.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)
    const user = await prisma.user.create({ data: { email: `committed-${randomUUID()}@uptime-test.example` } })
    const connection = createQueueRedis(), producer = new Queue('uptime-probes', { connection })
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Controlled public response</body></html>', complete: true, redirects: [] })))
    const release = vi.spyOn(prisma.uptimeMonitor, 'updateMany').mockRejectedValueOnce(new Error('Controlled standalone lease release failure'))
    const worker = startUptimeWorker(job => executeUptimeProbe(job, observe, clock))
    try {
      const site = await prisma.project.create({ data: { userId: user.id, name: 'Committed', canonicalHost: 'committed.example.com',
        url: 'https://committed.example.com/', watchInterval: 'WEEKLY' } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url, nextProbeAt: scheduledAt } })
      const payload = { monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const }
      const delivery = await producer.add('probe', payload, { jobId: uptimeQueue.uptimeJobId(payload), attempts: 1 })
      await vi.waitFor(async () => { expect(await delivery.getState()).toMatch(/^(failed|completed)$/) }, { timeout: 5_000, interval: 25 })
      expect(observe).toHaveBeenCalledOnce()
      expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        state: 'online', lastCheckedAt: now, lastScheduledAt: scheduledAt, nextProbeAt: new Date(scheduledAt.getTime() + UPTIME_INTERVAL_MS),
        leaseToken: null, leaseUntil: null,
      })
      expect(await delivery.getState()).toBe('completed')
      expect(release).not.toHaveBeenCalled()
      await expect(scheduleUptimeProbes(clock, 1, site.id)).resolves.toEqual({ published: 0, failed: 0 })
      // An older resumed monitor may already have rewound the due clock.
      await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { nextProbeAt: scheduledAt } })
      await expect(scheduleUptimeProbes(clock, 1, site.id)).resolves.toEqual({ published: 0, failed: 0 })
      expect(await delivery.getState()).toBe('completed')
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        state: 'online', lastCheckedAt: now, nextProbeAt: new Date(scheduledAt.getTime() + UPTIME_INTERVAL_MS),
      })
    } finally {
      release.mockRestore()
      await worker.close(); await producer.close(); await connection.quit()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  })

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
        url: 'https://retained.example.com/', watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86_400_000) } })
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
      if (terminalState === 'completed') {
        const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
        const operation = await prisma.adminOperation.create({ data: { actorId: user.id, actorSessionId: session.id, actorAuthenticatedAt: new Date(),
          action: 'SITE_RECONCILE', targetType: 'SITE', targetId: site.id, ownerId: user.id, reason: 'Controlled local dispatch',
          input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(Date.now() + 60_000),
          status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(Date.now() + 60_000) } })
        try { await expect(performAdminExternalAction(operation, {})).resolves.toMatchObject({ state: 'RECONCILED' }) }
        finally { await prisma.adminOperation.delete({ where: { id: operation.id } }) }
      } else await scheduleUptimeProbes(systemClock, 1, site.id)
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      }, { timeout: 2000, interval: 25 })
      await scheduleUptimeProbes(systemClock, 1, site.id)
      expect(await retained.getState()).toBe('completed')
      expect(observe).toHaveBeenCalledOnce()
      expect(await loadUptimeSummary(uptimeReadSite(site))).toMatchObject({ state: 'online' })
      expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      await worker.close(); await producer.close(); await connection.quit()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 15_000)
  it('resumes a due confirmation using the first observation time after a restart', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const slot = uptimeSlotStart(Date.now()) - 3 * UPTIME_INTERVAL_MS
    const admittedAt = new Date(slot + UPTIME_INTERVAL_MS - 1000)
    const failedAt = new Date(slot + UPTIME_INTERVAL_MS + 2000)
    const restartedAt = new Date(slot + 2 * UPTIME_INTERVAL_MS + 1000)
    let currentTime = admittedAt
    const clock = { now: () => currentTime }
    const user = await prisma.user.create({ data: { email: `confirmation-restart-${randomUUID()}@uptime-test.example` } })
    const site = await prisma.project.create({ data: { userId: user.id, name: 'Confirmation restart', canonicalHost: 'example.com',
      url: 'https://example.com/', watchInterval: 'WEEKLY' } })
    const scheduledAt = new Date(slot)
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url, nextProbeAt: scheduledAt } })
    const job = { monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const }
    const failure: ProbeObservation = { result: 'FAILED', reason: 'response_error', statusCode: 503, durationMs: 3000, finalUrl: site.url }
    const confirm = vi.fn(async () => failure)
    const recover = vi.fn(async (): Promise<ProbeObservation> => ({ ...failure, result: 'ONLINE', reason: 'response_received', statusCode: 200 }))
    let worker: ReturnType<typeof startUptimeWorker> | undefined
    const enqueue = vi.spyOn(uptimeQueue, 'enqueueUptimeProbe').mockRejectedValueOnce(new Error('Controlled interruption after first probe'))
    try {
      await executeUptimeProbe(job, async () => { currentTime = failedAt; return failure }, clock)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        lastScheduledAt: scheduledAt, pendingFailureAt: failedAt, pendingSlotAt: scheduledAt,
        confirmationDueAt: new Date(failedAt.getTime() + UPTIME_CONFIRMATION_MS),
      })
      expect(await prisma.uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(0)
      currentTime = restartedAt
      worker = startUptimeWorker(job => executeUptimeProbe(job, job.attempt === 2 ? confirm : recover, clock))
      await worker.waitUntilReady()
      await expect(scheduleUptimeProbes(clock, 1, site.id)).resolves.toEqual({ published: 1, failed: 0 })
      await vi.waitFor(async () => expect(await prisma.uptimeIncident.findFirst({ where: { monitorId: monitor.id } }))
        .toMatchObject({ startedAt: failedAt, confirmedAt: restartedAt, recoveredAt: null }), { timeout: 3000, interval: 25 })
      expect(confirm).toHaveBeenCalledOnce()
      expect(await prisma.uptimeProbe.findMany({ where: { monitorId: monitor.id }, orderBy: { attempt: 'asc' } })).toMatchObject([
        { scheduledAt, observedAt: failedAt, attempt: 1, confirmed: false },
        { scheduledAt, observedAt: restartedAt, attempt: 2, confirmed: true },
      ])
      await executeUptimeProbe({ ...job, attempt: 2 }, confirm, clock)
      expect(confirm).toHaveBeenCalledOnce()
      currentTime = new Date(restartedAt.getTime() + 1000)
      await expect(scheduleUptimeProbes(clock, 1, site.id)).resolves.toEqual({ published: 1, failed: 0 })
      await vi.waitFor(async () => expect(await prisma.uptimeIncident.findMany({ where: { monitorId: monitor.id } }))
        .toMatchObject([{ startedAt: failedAt, confirmedAt: restartedAt, recoveredAt: currentTime }]), { timeout: 3000, interval: 25 })
      expect(recover).toHaveBeenCalledOnce()
    } finally {
      enqueue.mockRestore()
      await worker?.close()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  })

  it('confirms an outage before a queued cohort can occupy every probe lane', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const scheduledAt = new Date(uptimeSlotStart(Date.now()) + UPTIME_INTERVAL_MS)
    const failedAt = new Date(scheduledAt.getTime() + 1000)
    const confirmationAt = new Date(failedAt.getTime() + UPTIME_CONFIRMATION_MS)
    const user = await prisma.user.create({ data: { email: `confirmation-backlog-${randomUUID()}@uptime-test.example` } })
    const connection = createQueueRedis(), broker = new Queue('uptime-probes', { connection })
    let releaseRoutine!: () => void
    const holdRoutine = new Promise<void>(resolve => { releaseRoutine = resolve })
    let worker: ReturnType<typeof startUptimeWorker> | undefined
    async function createProbe(host: string) {
      const site = await prisma.project.create({ data: { userId: user.id, name: host, canonicalHost: host,
        url: `https://${host}/`, watchInterval: 'WEEKLY' } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url, nextProbeAt: scheduledAt } })
      return { site, job: { monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const } }
    }
    try {
      const outage = await createProbe('outage.example.com')
      const failure: ProbeObservation = { result: 'FAILED', reason: 'response_error', statusCode: 503, durationMs: 50, finalUrl: outage.site.url }
      const routine = await Promise.all(Array.from({ length: 4 }, (_, index) => createProbe(`routine-${index}.example.com`)))
      for (const { job } of routine) await uptimeQueue.enqueueUptimeProbe(job, new Date())
      await executeUptimeProbe(outage.job, async () => failure, fixedClock(failedAt))
      const confirmation = await broker.getJob(uptimeQueue.uptimeJobId({ ...outage.job, attempt: 2 }))
      // BullMQ uses wall time for delay. The observation clock keeps the slots deterministic.
      expect(await confirmation?.getState()).toBe('delayed')
      await confirmation!.promote()
      worker = startUptimeWorker(job => executeUptimeProbe(job, async url => {
        if (job.attempt === 2) return failure
        await holdRoutine
        return { result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 50, finalUrl: url }
      }, fixedClock(confirmationAt)))
      await worker.waitUntilReady()
      const incidentWhere = { monitorId: outage.job.monitorId }
      await vi.waitFor(async () => expect(await prisma.uptimeIncident.findFirst({ where: incidentWhere }))
        .toMatchObject({ startedAt: failedAt, confirmedAt: confirmationAt, recoveredAt: null }), { timeout: 3000, interval: 25 })
      expect(await prisma.uptimeNotification.count({ where: { incident: incidentWhere, kind: 'DOWN' } })).toBe(1)
      expect(await prisma.uptimeProbe.findMany({ where: incidentWhere, orderBy: { attempt: 'asc' } })).toMatchObject([
        { scheduledAt, attempt: 1, confirmed: false }, { scheduledAt, attempt: 2, confirmed: true },
      ])
      releaseRoutine()
      const routineIds = routine.map(({ job }) => job.monitorId)
      await vi.waitFor(async () => expect(await prisma.uptimeProbe.count({
        where: { monitorId: { in: routineIds }, result: 'ONLINE', scheduledAt },
      })).toBe(routine.length), { timeout: 3000, interval: 25 })
    } finally {
      releaseRoutine()
      await worker?.close(); await broker.close(); await connection.quit()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 15_000)

  it('converges on one probe when two schedulers race to replay a retained job', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const now = new Date(), scheduledAt = new Date(Math.floor(now.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)
    const user = await prisma.user.create({ data: { email: `replay-race-${randomUUID()}@uptime-test.example` } })
    const connection = createQueueRedis(), broker = new Queue('uptime-probes', { connection })
    const observe = vi.fn(async (url: string) => ({
      result: 'ONLINE' as const, reason: 'response_received', statusCode: 200, durationMs: 20, finalUrl: url,
    }))
    let canObserve = false
    const worker = startUptimeWorker(async job => {
      if (canObserve) await executeUptimeProbe(job, observe, fixedClock(now))
    })
    const getState = Job.prototype.getState
    let release!: () => void, reads = 0, retainedId: string | undefined
    const blocked = new Promise<void>(resolve => { release = resolve })
    const state = vi.spyOn(Job.prototype, 'getState').mockImplementation(async function (this: Job) {
      const current = await getState.call(this)
      if (retainedId && this.id === retainedId && current === 'completed' && reads < 2) {
        reads++
        await blocked
      }
      return current
    })
    const publications: Array<ReturnType<typeof scheduleUptimeProbes>> = []
    try {
      const site = await prisma.project.create({ data: { userId: user.id, name: 'Replay race', canonicalHost: 'replay-race.example.com',
        url: 'https://replay-race.example.com/', watchInterval: 'WEEKLY' } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url, nextProbeAt: scheduledAt } })
      const payload = { monitorId: monitor.id, version: monitor.version, scheduledAt: scheduledAt.toISOString(), attempt: 1 as const }
      const retained = await broker.add('probe', payload, { jobId: uptimeQueue.uptimeJobId(payload), removeOnComplete: false })
      await vi.waitFor(async () => expect(await retained.getState()).toBe('completed'), { timeout: 5000 })
      await broker.pause()
      retainedId = retained.id
      canObserve = true
      publications.push(scheduleUptimeProbes(fixedClock(now), 1, site.id))
      await vi.waitFor(() => expect(reads).toBe(1), { timeout: 5000 })
      publications.push(scheduleUptimeProbes(fixedClock(new Date(now.getTime() + 1)), 1, site.id))
      await vi.waitFor(() => expect(reads).toBe(2), { timeout: 5000 })
      release()
      await expect(Promise.all(publications)).resolves.toEqual([{ published: 1, failed: 0 }, { published: 1, failed: 0 }])
      expect(await retained.getState()).toBe('waiting')
      await broker.resume()
      await vi.waitFor(async () => expect(await retained.getState()).toBe('completed'), { timeout: 5000 })
      expect(observe).toHaveBeenCalledOnce()
      expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(1)
      expect(await scheduleUptimeProbes(fixedClock(now), 1, site.id)).toEqual({ published: 0, failed: 0 })
    } finally {
      release()
      await Promise.allSettled(publications)
      state.mockRestore()
      await broker.resume()
      await worker.close(); await broker.close(); await connection.quit()
      await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
    }
  }, 20_000)
  it('executes a later due Site through the real worker while an earlier publication is stalled', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const now = new Date(), identity = randomUUID()
    const clock = fixedClock(now)
    const user = await prisma.user.create({ data: { email: `fair-${identity}@uptime-test.example`, role: 'admin', preferredTools: [], auditsUsed: 3 } })
    const observe = vi.fn((url: string) => probeUptime(url, async () => ({ statusCode: 200, finalUrl: url,
      headers: { 'content-type': 'text/html' }, body: '<html><body>Controlled public response</body></html>', complete: true, redirects: [] })))
    const worker = startUptimeWorker(job => executeUptimeProbe(job, observe, clock))
    const original = uptimeQueue.enqueueUptimeProbe
    let failingMonitor: string | null = null
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    let sweep: ReturnType<typeof scheduleUptimeProbes> | undefined
    const publish = vi.spyOn(uptimeQueue, 'enqueueUptimeProbe').mockImplementation(async (job, dueAt) => {
      if (job.monitorId === failingMonitor) {
        await blocked
        throw new Error('Controlled stalled publication failure')
      }
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
      sweep = scheduleUptimeProbes(clock, 2)
      await vi.waitFor(async () => {
        expect(publish.mock.calls.some(([job]) => job.monitorId === failingMonitor)).toBe(true)
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitors[1].id } })).toBe(1)
      }, { timeout: 5_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url)).toEqual([projects[1].url])
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitors[0].id } })).toMatchObject({
        nextProbeAt: monitors[0].nextProbeAt, lastCheckedAt: null, lastScheduledAt: null,
      })
      release()
      await expect(sweep).resolves.toEqual({ published: 1, failed: 1 })
      failingMonitor = null
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(clock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitorId: monitors[0].id } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(await loadUptimeSummary(uptimeReadSite(projects[0]))).toMatchObject({ state: 'online' })
      expect(await loadUptimeSummary(uptimeReadSite(projects[1]))).toMatchObject({ state: 'online' })
      expect(await prisma.uptimeIncident.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      release()
      try { await sweep }
      finally { publish.mockRestore(); await worker.close(); await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect() }
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
    let allowSetup: Awaited<ReturnType<typeof rejectMonitorSetup>> | undefined
    const failing = new Set<string>()
    try {
      const projects = await Promise.all(['first-failure', 'second-failure', 'following'].map((host, index) => prisma.project.create({ data: {
        userId: user.id, name: host, canonicalHost: `${host}.example.com`, url: `https://${host}.example.com/`,
        watchInterval: 'WEEKLY', watchNextRunAt: now, createdAt: new Date('2000-01-0' + (index + 1) + 'T00:00:00Z'),
      } })))
      failing.add(projects[0].id); failing.add(projects[1].id)
      allowSetup = await rejectMonitorSetup(prisma, [...failing])
      for (let batch = 0; batch < 3; batch++) await scheduleUptimeProbes(systemClock, 1)
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(systemClock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitor: { projectId: projects[2].id } } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url)).toEqual([projects[2].url])
      expect(await loadUptimeSummary(uptimeReadSite(projects[2]))).toMatchObject({ enabled: true, state: 'online' })
      await allowSetup()
      allowSetup = undefined
      // Make the persisted retry due without waiting a minute in the fixture.
      await prisma.project.updateMany({ where: { id: { in: [...failing] } }, data: { uptimeSetupRetryAt: new Date(Date.now() - 1) } })
      for (let batch = 0; batch < 2; batch++) await scheduleUptimeProbes(systemClock, 1)
      await vi.waitFor(async () => {
        await scheduleUptimeProbes(systemClock, 1)
        expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(3)
      }, { timeout: 10_000, interval: 50 })
      expect(await prisma.uptimeMonitor.count({ where: { project: { userId: user.id } } })).toBe(3)
      expect(await prisma.project.count({ where: { userId: user.id, uptimeSetupRetryAt: { not: null } } })).toBe(0)
      expect(await prisma.uptimeIncident.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(0)
      expect(await prisma.audit.count({ where: { userId: user.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(3)
    } finally {
      await allowSetup?.(); await worker.close(); await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect()
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
      const allowSetup = await rejectMonitorSetup(prisma, [projects[1].id])
      try {
        await scheduleUptimeProbes(systemClock)
      } finally { await allowSetup() }
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitor: { project: { userId: user.id } } } })).toBe(2)
      }, { timeout: 10_000, interval: 50 })
      expect(observe.mock.calls.map(([url]) => url).sort()).toEqual([projects[0].url, projects[2].url].sort())
      expect(await prisma.uptimeMonitor.findUnique({ where: { projectId: projects[1].id } })).toBeNull()
      expect(await loadUptimeSummary(uptimeReadSite(projects[0]))).toMatchObject({ enabled: true, state: 'online' })
      expect(await loadUptimeSummary(uptimeReadSite(projects[2]))).toMatchObject({ enabled: true, state: 'online' })
      expect((await prisma.project.findUniqueOrThrow({ where: { id: projects[1].id } })).uptimeSetupRetryAt).toBeInstanceOf(Date)
      await prisma.project.update({ where: { id: projects[1].id }, data: { uptimeSetupRetryAt: new Date(Date.now() - 1) } })
      await scheduleUptimeProbes(systemClock, 10, projects[1].id)
      await vi.waitFor(async () => {
        expect(await prisma.uptimeProbe.count({ where: { monitor: { projectId: projects[1].id } } })).toBe(1)
      }, { timeout: 10_000, interval: 50 })
      expect(observe).toHaveBeenCalledTimes(3)
      expect(await loadUptimeSummary(uptimeReadSite(projects[1]))).toMatchObject({ enabled: true, state: 'online' })
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
