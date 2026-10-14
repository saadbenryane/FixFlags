import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as entitlements from '@/lib/billing/effective-entitlements'
import * as scheduledRuns from '../scheduled-runs'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { fixedClock } from '@/lib/time/clock'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('watch scheduling state with migrated PostgreSQL', () => {
  const now = new Date('2026-10-14T12:00:00Z'), userIds: string[] = []
  let first: { id: string; userId: string }, second: { id: string; userId: string }
  const admission = { runId: 'controlled-admission', auditId: 'controlled-audit', outcomeIds: [], reused: false }

  beforeAll(() => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Scheduling integration requires a disposable local execution database')
  })
  beforeEach(async () => {
    async function site(position: number) {
      const userId = 'watch-scheduling-' + randomUUID(); userIds.push(userId)
      await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
      return prisma.project.create({ data: { userId, name: 'Scheduling fixture', url: 'https://schedule-' + position + '.example.com/',
        canonicalHost: 'schedule-' + position + '.example.com', watchInterval: 'WEEKLY',
        watchNextRunAt: new Date(now.getTime() - (3 - position) * 60_000), watchConsecutiveFailures: 3 }, select: { id: true, userId: true } })
    }
    first = await site(1); second = await site(2)
    // Admission is controlled here. These tests prove SQL scheduling ownership,
    // not execution of the webpage or acceptance by an external provider.
    vi.spyOn(scheduledRuns, 'requestScheduledSiteRun').mockResolvedValue(admission)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })
  afterAll(async () => { await prisma.$disconnect() })

  it('defers one failed account lookup and admits the next due Site', async () => {
    const original = entitlements.loadEffectiveEntitlements
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db) => {
      if (userId === first.userId) throw new Error('Controlled account lookup failure')
      return original(userId, db)
    })
    expect(await processDueProjectWatches(20, { clock: fixedClock(now) })).toEqual({ processed: 1, enqueued: 1, errors: 1 })
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: second.id }))
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchNextRunAt: new Date(now.getTime() + 6 * 60 * 60_000), watchConsecutiveFailures: 4, watchLeaseUntil: null })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
      watchNextRunAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000), watchConsecutiveFailures: 0, watchLeaseUntil: null })
  })

  it.each(['success', 'failure'] as const)('preserves a replacement lease after stale admission %s', async result => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    const replacement = new Date(now.getTime() + 20 * 60_000)
    vi.mocked(scheduledRuns.requestScheduledSiteRun).mockImplementation(async () => {
      await prisma.project.update({ where: { id: first.id }, data: { watchLeaseUntil: replacement } })
      if (result === 'failure') throw new Error('Controlled interrupted admission')
      return admission
    })
    await processDueProjectWatches(20, { clock: fixedClock(now), onlyProjectId: first.id })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchNextRunAt: before.watchNextRunAt, watchLeaseUntil: replacement, watchConsecutiveFailures: 3, watchLastError: null })
  })

  it('cannot claim a due Site transferred during account policy lookup', async () => {
    const original = entitlements.loadEffectiveEntitlements
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db) => {
      const policy = await original(userId, db)
      await prisma.project.update({ where: { id: first.id }, data: { userId: second.userId } })
      return policy
    })
    expect(await processDueProjectWatches(20, { clock: fixedClock(now), onlyProjectId: first.id })).toEqual({ processed: 0, enqueued: 0, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ userId: second.userId, watchLeaseUntil: null })
  })

  it('preserves a changed due time when an old policy snapshot attempts to pause monitoring', async () => {
    const original = entitlements.loadEffectiveEntitlements, editedNext = new Date(now.getTime() + 60 * 60_000)
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db) => {
      const policy = await original(userId, db)
      await prisma.project.update({ where: { id: first.id }, data: { watchNextRunAt: editedNext } })
      return policy && { ...policy, watchIntervals: [] }
    })
    await processDueProjectWatches(20, { clock: fixedClock(now), onlyProjectId: first.id })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchInterval: 'WEEKLY', watchNextRunAt: editedNext, watchLastError: null })
  })
})
