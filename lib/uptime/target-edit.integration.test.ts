import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { fixedClock } from '@/lib/time/clock'
import { PATCH } from '@/app/api/projects/[id]/route'
import { POST } from '@/app/api/projects/route'
import { uptimeSlotStart } from './domain'
import { executeUptimeProbe, scheduleUptimeProbes } from './service'
import { startUptimeWorker } from './queue'
import { loadUptimeEvents, loadUptimeHistory } from './queries'
import { uptimeReadSite } from './__tests__/read-site'

const session = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: session } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/security/rate-limit')>(),
  enforceRateLimit: vi.fn(), recordRateLimit: vi.fn(), requestClientId: () => 'target-edit-fixture',
}))

const run = process.env.UPTIME_TEST_DATABASE_URL ? describe : describe.skip
run('owner edits to an automatically monitored target', () => {
  async function fixture() {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    const user = await prisma.user.create({ data: { email: `target-edit-${randomUUID()}@example.test`, role: 'admin', auditsUsed: 2 } })
    session.mockResolvedValue({ user: { id: user.id } })
    const site = await prisma.project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com',
      url: 'https://example.com', watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() + 86400_000) } })
    const edit = (url: string) => PATCH(new NextRequest('http://localhost/api/projects/' + site.id,
      { method: 'PATCH', body: JSON.stringify({ url }) }), { params: Promise.resolve({ id: site.id }) })
    return { user, site, edit }
  }

  it('invalidates an in-flight probe even when edits return to the original origin', async () => {
    const { user, site, edit } = await fixture()
    const now = new Date(), slot = new Date(uptimeSlotStart(now.getTime()))
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url + '/', nextProbeAt: slot } })
    const confirmedAt = new Date(now.getTime() - 2 * 86400_000)
    const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: monitor.targetUrl,
      startedAt: confirmedAt, confirmedAt, reason: 'response_error',
      notifications: { create: { kind: 'DOWN', nextAttemptAt: now } },
    }, include: { notifications: true } })
    let observed!: () => void, release!: () => void
    const started = new Promise<void>(resolve => { observed = resolve })
    const held = new Promise<void>(resolve => { release = resolve })
    const pending = executeUptimeProbe({ monitorId: monitor.id, version: 1, scheduledAt: slot.toISOString(), attempt: 1 }, async url => {
      observed(); await held
      return { result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 10, finalUrl: url }
    }, fixedClock(now))
    try {
      await Promise.race([started, pending.then(() => { throw new Error('Probe did not reach observation') })])
      const access = uptimeReadSite(site)
      expect(await loadUptimeHistory(access, '24h', null, now)).toMatchObject({ incidentOpen: true,
        incidents: [{ id: incident.id, targetUrl: monitor.targetUrl, recoveredAt: null, supersededAt: null }] })
      expect((await edit('http://example.com:8080/pricing')).status).toBe(200)
      const changed = await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })
      expect(changed).toMatchObject({ confirmedAt, targetUrl: monitor.targetUrl, supersededAt: expect.any(Date), recoveredAt: null })
      expect(await prisma.uptimeNotification.findUniqueOrThrow({ where: { id: incident.notifications[0].id } }))
        .toMatchObject({ status: 'SKIPPED', attempts: 0 })
      const boundary = new Date(changed.supersededAt!.getTime() + 86400_000)
      expect(await loadUptimeHistory(access, '24h', null, boundary)).toMatchObject({ state: 'unknown',
        incidentOpen: false, openIncidentCount: 0, probes: [],
        incidents: [{ id: incident.id, targetUrl: monitor.targetUrl, recoveredAt: null, supersededAt: changed.supersededAt!.toISOString() }],
      })
      expect(await loadUptimeHistory(access, '24h', null, new Date(boundary.getTime() + 1))).toMatchObject({ incidents: [] })
      expect(await loadUptimeEvents(access)).toMatchObject([{ id: incident.id, targetUrl: monitor.targetUrl,
        recoveredAt: null, supersededAt: changed.supersededAt }])
      expect((await edit(site.url)).status).toBe(200)
      release(); await pending
      expect(await prisma.uptimeProbe.count({ where: { monitorId: monitor.id } })).toBe(0)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({
        targetUrl: monitor.targetUrl, version: 3, state: 'unknown', leaseToken: null, lastCheckedAt: null,
      })
      expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({
        version: 1, supersededAt: expect.any(Date), recoveredAt: null,
      })
    } finally { release(); await pending; await prisma.user.delete({ where: { id: user.id } }) }
  })

  it('clears setup backoff and starts a first probe after a same-host origin update', async () => {
    const { user, site } = await fixture()
    const now = new Date(), clock = fixedClock(now), url = 'http://example.com:8080'
    const observe = vi.fn(async (target: string) => ({ result: 'ONLINE' as const, reason: 'response_received' as const,
      statusCode: 200, durationMs: 10, finalUrl: target }))
    const worker = startUptimeWorker(job => executeUptimeProbe(job, observe, clock))
    try {
      await worker.waitUntilReady()
      await prisma.project.update({ where: { id: site.id }, data: { uptimeSetupRetryAt: new Date(now.getTime() + 86400_000) } })
      expect((await POST(new NextRequest('http://localhost/api/projects',
        { method: 'POST', body: JSON.stringify({ url, name: site.name }) }))).status).toBe(201)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({ url, uptimeSetupRetryAt: null,
        watchTargetRevision: 2, watchNextRunAt: expect.any(Date), watchInterval: 'WEEKLY' })
      expect(await scheduleUptimeProbes(clock, 1, site.id)).toEqual({ published: 1, failed: 0 })
      await vi.waitFor(async () => {
        expect(await prisma.uptimeMonitor.findUnique({ where: { projectId: site.id } }))
          .toMatchObject({ targetUrl: url + '/', version: 1, state: 'online' })
      }, { timeout: 3000, interval: 20 })
      expect(observe.mock.calls).toEqual([[url + '/']])
      expect(await prisma.audit.count({ where: { projectId: site.id } })).toBe(0)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).auditsUsed).toBe(2)
    } finally { await worker.close(); await prisma.user.delete({ where: { id: user.id } }) }
  })
})
