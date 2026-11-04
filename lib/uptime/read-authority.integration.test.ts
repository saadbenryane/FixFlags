import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadUptimeEvents, loadUptimeHistory, loadUptimeSummary, loadUptimeStatus } from './queries'
import { uptimeReadSite } from './__tests__/read-site'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Uptime private read authority', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(() => prisma.$disconnect())

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
