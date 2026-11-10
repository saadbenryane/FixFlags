import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { updateOwnedSiteIdentity } from '@/lib/sites/application/settings-commands'
import { fixedClock } from '@/lib/time/clock'
import { InvalidUptimeCursorError, loadUptimeEvents, loadUptimeHistory, loadUptimeSummary, loadUptimeStatus } from './queries'
import { uptimeReadSite } from './__tests__/read-site'
import { UPTIME_INTERVAL_MS, uptimeSlotStart, uptimeTimeline } from './domain'
import { executeUptimeProbe } from './service'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Uptime private read authority', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(() => prisma.$disconnect())

  it('aggregates a dense month without changing slot evidence or raw pagination', async () => {
    const now = new Date('2026-11-08T09:17:00Z'), lastSlot = uptimeSlotStart(now.getTime())
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@uptime-read.example' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Uptime history fixture',
        canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'WEEKLY' } })
      // The monitor has existed for the whole retained month of evidence.
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url,
        state: 'online', lastCheckedAt: now, nextProbeAt: new Date(lastSlot + UPTIME_INTERVAL_MS), createdAt: new Date(now.getTime() - 40 * 86400_000) } })
      const site = uptimeReadSite(project)
      const probe = (at: number, result = 'ONLINE') => ({ monitorId: monitor.id, version: monitor.version, targetUrl: project.url,
        scheduledAt: new Date(at), observedAt: new Date(at + 1000), attempt: 1, result,
        confirmed: result === 'FAILED', reason: 'fixture', durationMs: 50 })
      const rows = Array.from({ length: 30 * 24 * 12 }, (_, offset) => probe(lastSlot - offset * UPTIME_INTERVAL_MS))
      const failed = probe(lastSlot - 2 * UPTIME_INTERVAL_MS, 'FAILED')
      rows[2] = failed
      rows.push({ ...failed, attempt: 2, result: 'ONLINE', confirmed: false })
      // One retained off-cadence failure cannot fill a missing slot. A later
      // attempt observed after the read also cannot replace that evidence.
      const offCadence = probe(lastSlot - UPTIME_INTERVAL_MS + 1000, 'FAILED')
      rows.push(offCadence, { ...offCadence, attempt: 2, observedAt: new Date(now.getTime() + 1), result: 'ONLINE', confirmed: false })
      rows.splice(3, 1)
      const unrelated = [
        { ...probe(lastSlot + 1000, 'FAILED'), version: monitor.version + 1 },
        { ...probe(lastSlot + 2000, 'FAILED'), targetUrl: 'https://previous.example/' },
        { ...probe(lastSlot - 4 * UPTIME_INTERVAL_MS, 'FAILED'), attempt: 2, observedAt: new Date(lastSlot - 5 * UPTIME_INTERVAL_MS) },
      ]
      const retained = [...rows, ...unrelated]
      for (let offset = 0; offset < retained.length; offset += 1000) {
        await prisma.uptimeProbe.createMany({ data: retained.slice(offset, offset + 1000) })
      }
      const aggregates = vi.spyOn(prisma, '$queryRaw')
      try {
        for (const window of ['24h', '7d', '30d'] as const) {
          const history = await loadUptimeHistory(site, window, null, now)
          expect(history?.segments).toEqual(uptimeTimeline(rows, now, window))
          expect(history?.segments.at(-1)?.state).toBe('offline')
          expect(history?.segments.some(segment => segment.state === 'online')).toBe(true)
          expect(history?.probes).toHaveLength(100)
          expect(history?.nextCursor).toBeTruthy()
          if (window === '30d') {
            const next = await loadUptimeHistory(site, window, history!.nextCursor, now)
            expect(next?.segments).toEqual(history?.segments)
            expect(next?.probes).toHaveLength(100)
            expect(next?.probes.some(item => history!.probes.some(previous => previous.id === item.id))).toBe(false)
          }
        }
        expect((await loadUptimeSummary(site, now))?.segments).toEqual(uptimeTimeline(rows, now))
        const periodRows = await Promise.all(aggregates.mock.results.map(result => result.value as Promise<unknown[]>))
        expect(periodRows.map(result => result.length)).toEqual([48, 56, 60, 60, 48])
      } finally { aggregates.mockRestore() }
    } finally { await prisma.user.delete({ where: { id: owner.id } }) }
  })

  it.each(['history', 'summary', 'status', 'cursor', 'return', 'recovery'] as const)(
    'keeps %s on current evidence when the target or observation changes during collection', async reader => {
      const now = new Date(), target = 'http://example.com:8080/'
      const owner = await prisma.user.create({ data: { email: randomUUID() + '@uptime-retarget.example' } })
      try {
        const project = await prisma.project.create({ data: { userId: owner.id, name: 'Uptime retarget fixture',
          canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'WEEKLY', watchNextRunAt: now } })
        const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url,
          state: 'offline', lastCheckedAt: now, nextProbeAt: now } })
        const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version, targetUrl: project.url,
          startedAt: new Date(now.getTime() - 120_000), confirmedAt: new Date(now.getTime() - 60_000), reason: 'response_error' } })
        const probe = await prisma.uptimeProbe.create({ data: { monitorId: monitor.id, version: monitor.version, targetUrl: project.url,
          scheduledAt: new Date(uptimeSlotStart(now.getTime()) - UPTIME_INTERVAL_MS), observedAt: now, attempt: 2, result: 'FAILED', confirmed: true,
          reason: 'response_error', statusCode: 503, durationMs: 10, finalUrl: project.url } })
        const site = uptimeReadSite(project)
        let cursor: string | null = null
        if (reader === 'cursor') {
          await prisma.uptimeProbe.createMany({ data: Array.from({ length: 100 }, (_, index) => {
            const at = new Date(uptimeSlotStart(now.getTime()) - (index + 2) * UPTIME_INTERVAL_MS)
            return { monitorId: monitor.id, version: monitor.version, targetUrl: project.url, scheduledAt: at, observedAt: at,
              attempt: 1, result: 'ONLINE', confirmed: false, reason: 'response_received', durationMs: 10 }
          }) })
          cursor = (await loadUptimeHistory(site, '24h', null, now))!.nextCursor
          expect(cursor).toBeTruthy()
        }
        const change = async () => {
          if (reader === 'recovery') {
            await executeUptimeProbe({ monitorId: monitor.id, version: monitor.version,
              scheduledAt: new Date(uptimeSlotStart(now.getTime())).toISOString(), attempt: 1 }, async url => ({
              result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 10, finalUrl: url,
            }), fixedClock(now))
            return
          }
          await updateOwnedSiteIdentity({ projectId: project.id, userId: owner.id }, { origin: target })
          if (reader === 'return') await updateOwnedSiteIdentity({ projectId: project.id, userId: owner.id }, { origin: project.url })
        }
        const readMonitor = prisma.uptimeMonitor.findUnique.bind(prisma.uptimeMonitor)
        const readProject = prisma.project.findUnique.bind(prisma.project)
        const move = reader === 'status' ? vi.spyOn(prisma.project, 'findUnique').mockImplementationOnce((async (args: Parameters<typeof readProject>[0]) => {
          const snapshot = await readProject(args)
          await change()
          return snapshot
        }) as never) : vi.spyOn(prisma.uptimeMonitor, 'findUnique').mockImplementationOnce((async (args: Parameters<typeof readMonitor>[0]) => {
          const snapshot = await readMonitor(args)
          await change()
          return snapshot
        }) as never)
        try {
          if (reader === 'cursor') await expect(loadUptimeHistory(site, '24h', cursor, now)).rejects.toBeInstanceOf(InvalidUptimeCursorError)
          else if (reader === 'recovery') expect(await loadUptimeHistory(site, '24h', null, now)).toMatchObject({
            state: 'online', targetUrl: project.url, lastCheckedAt: now.toISOString(), incidentOpen: false, openIncidentCount: 0,
            incidents: [{ id: incident.id, recoveredAt: now.toISOString(), supersededAt: null }],
          })
          else {
            const result = await (reader === 'status' ? loadUptimeStatus(site, now)
              : reader === 'summary' ? loadUptimeSummary(site, now) : loadUptimeHistory(site, '24h', null, now))
            expect(result).toMatchObject({ state: 'unknown', targetUrl: reader === 'return' ? project.url : target, lastCheckedAt: null, incidentOpen: false })
            if (reader !== 'status') expect(result).toMatchObject({ openIncidentCount: 0 })
            if (reader === 'history' || reader === 'return') expect(result).toMatchObject({ probes: [], nextCursor: null,
              historyScope: { key: `${monitor.id}:${reader === 'return' ? 3 : 2}` },
              incidents: [{ id: incident.id, targetUrl: project.url, recoveredAt: null, supersededAt: expect.any(String) }] })
          }
        } finally { move.mockRestore() }
        expect(await prisma.uptimeProbe.findUniqueOrThrow({ where: { id: probe.id } })).toMatchObject({ version: 1, targetUrl: project.url })
      } finally { await prisma.user.delete({ where: { id: owner.id } }) }
    },
  )

  it.each((['history', 'summary', 'events', 'status'] as const).flatMap(reader => (['transfer', 'remove', 'suspend'] as const)
    .map(change => ({ reader, change }))))('withholds $reader after $change during its source snapshot read and retains historical evidence', async ({ reader, change }) => {
    const identity = randomUUID(), now = new Date(), userIds: string[] = []
    const oldOwner = await prisma.user.create({ data: { email: 'old-' + identity + '@uptime-read.example' } })
    userIds.push(oldOwner.id)
    const newOwner = await prisma.user.create({ data: { email: 'new-' + identity + '@uptime-read.example' } })
    userIds.push(newOwner.id)
    try {
      const project = await prisma.project.create({ data: { userId: oldOwner.id, name: 'Private uptime fixture',
        canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'WEEKLY', watchNextRunAt: now } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url,
        state: 'offline', lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000) } })
      const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
        startedAt: new Date(now.getTime() - 120_000), confirmedAt: new Date(now.getTime() - 60_000), reason: 'response_error' } })
      const probe = await prisma.uptimeProbe.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
        scheduledAt: new Date(Math.floor(now.getTime() / 300_000) * 300_000), observedAt: now, attempt: 2,
        result: 'FAILED', confirmed: true, reason: 'response_error', statusCode: 503, durationMs: 50, finalUrl: project.url } })
      const site = uptimeReadSite(project)
      const read = () => reader === 'history' ? loadUptimeHistory(site, '24h', null, now)
        : reader === 'summary' ? loadUptimeSummary(site, now) : reader === 'status' ? loadUptimeStatus(site, now) : loadUptimeEvents(site)
      const original = prisma.uptimeMonitor.findUnique.bind(prisma.uptimeMonitor)
      const originalProject = prisma.project.findUnique.bind(prisma.project)
      const revoke = async () => {
        if (change === 'transfer') await prisma.project.update({ where: { id: project.id }, data: { userId: newOwner.id } })
        else if (change === 'remove') await prisma.project.update({ where: { id: project.id }, data: { deletedAt: now } })
        else await prisma.user.update({ where: { id: oldOwner.id }, data: { lifecycleStatus: 'SUSPENDED' } })
      }
      const transfer = reader === 'status' ? vi.spyOn(prisma.project, 'findUnique').mockImplementationOnce((async (args: Parameters<typeof originalProject>[0]) => {
        const snapshot = await originalProject(args)
        await revoke()
        return snapshot
      }) as never) : vi.spyOn(prisma.uptimeMonitor, 'findUnique').mockImplementationOnce((async (args: Parameters<typeof original>[0]) => {
        const snapshot = await original(args)
        await revoke()
        return snapshot
      }) as never)
      try { await expect(read()).rejects.toMatchObject({ status: 404 }) }
      finally { transfer.mockRestore() }
      expect(await prisma.uptimeProbe.findUniqueOrThrow({ where: { id: probe.id } })).toMatchObject({ monitorId: monitor.id })
      expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null, supersededAt: null })
      if (change === 'transfer') await expect(read()).rejects.toMatchObject({ status: 404 })
      else if (change === 'remove') await prisma.project.update({ where: { id: project.id }, data: { deletedAt: null } })
      else await prisma.user.update({ where: { id: oldOwner.id }, data: { lifecycleStatus: 'ACTIVE' } })
      const currentSite = uptimeReadSite({ ...project, userId: change === 'transfer' ? newOwner.id : oldOwner.id })
      if (reader === 'history') expect(await loadUptimeHistory(currentSite, '24h', null, now)).toMatchObject({ probes: [{ id: probe.id }], incidents: [{ id: incident.id }] })
      else if (reader === 'summary') expect(await loadUptimeSummary(currentSite, now)).toMatchObject({ state: 'offline', incidentOpen: true, openIncidentCount: 1 })
      else if (reader === 'status') expect(await loadUptimeStatus(currentSite, now)).toMatchObject({ state: 'offline', incidentOpen: true })
      else expect(await loadUptimeEvents(currentSite)).toEqual([expect.objectContaining({ id: incident.id })])
    } finally { await prisma.user.deleteMany({ where: { id: { in: userIds } } }) }
  })
})
