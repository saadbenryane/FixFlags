import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as entitlements from '@/lib/billing/effective-entitlements'
import * as scheduledRuns from '../scheduled-runs'
import * as watchStorage from '../scheduled-watch-storage'
import { calcWatchNextRun, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { SiteRunRefusal } from '../run-refusal'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { setProjectWatch } from '../monitoring-settings'
import { ensureDefaultMonitoring } from '../default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
import { fixedClock } from '@/lib/time/clock'
import { loadProductWatch } from '@/lib/products/application/queries'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { watchBoardState } from '@/lib/sites/watch-state'

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
    vi.spyOn(scheduledRuns, 'requestScheduledSiteRun').mockImplementation(async input => {
      const claim = input.claim!
      const changed = await prisma.project.updateMany({ where: { id: input.projectId, userId: input.userId,
        watchInterval: toStoredWatchInterval(input.interval), watchEveryMinutes: input.everyMinutes ?? null,
        watchNextRunAt: input.scheduledAt, watchLastAttemptAt: claim.attemptedAt, watchLeaseUntil: claim.leaseUntil },
        data: { watchLeaseUntil: null, watchNextRunAt: calcWatchNextRun(input.interval, input.now, input.everyMinutes) } })
      if (!changed.count) throw new SiteRunRefusal('The monitoring claim changed', 409, 'WATCH_CLAIM_CHANGED')
      return admission
    })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })
  afterAll(async () => { await prisma.$disconnect() })

  it.each([
    ['Site', 'before selection'], ['Site', 'after selection'], ['Site', 'before lease'],
    ['account', 'before selection'], ['account', 'after selection'], ['account', 'before lease'],
  ] as const)('admits the next due Site when the oldest Site’s %s row is locked %s', async (row, timing) => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    let release!: () => void, acquired!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { acquired = resolve })
    let holder: Promise<void> | undefined
    async function holdFirstRow() {
      holder = prisma.$transaction(async tx => {
        if (row === 'Site') await tx.$queryRaw`SELECT id FROM projects WHERE id = ${first.id} FOR UPDATE`
        else await tx.$queryRaw`SELECT id FROM users WHERE id = ${first.userId} FOR NO KEY UPDATE`
        acquired()
        await released
      }, { timeout: 10_000 })
      await locked
    }
    if (timing === 'before selection') await holdFirstRow()
    if (timing === 'after selection') {
      const select = watchStorage.selectDueWatchProjects
      vi.spyOn(watchStorage, 'selectDueWatchProjects').mockImplementationOnce(async (...args) => {
        const rows = await select(...args)
        await holdFirstRow()
        return rows
      })
    }
    if (timing === 'before lease') {
      const readPolicy = entitlements.loadEffectiveEntitlements
      vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (...args) => {
        const policy = await readPolicy(...args)
        if (args[0] === first.userId) await holdFirstRow()
        return policy
      })
    }
    const sweep = processDueProjectWatches(timing === 'before selection' ? 1 : 2, { clock: fixedClock(now) })
    try {
      await vi.waitFor(() => expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: second.id })),
        { timeout: 1500 })
      expect(await sweep).toEqual({ processed: 1, enqueued: 1, errors: 0 })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
        watchNextRunAt: before.watchNextRunAt, watchLeaseUntil: null, watchConsecutiveFailures: before.watchConsecutiveFailures,
        watchLastAttemptAt: timing === 'before lease' ? now : before.watchLastAttemptAt,
      })
    } finally { release(); await holder; await sweep }
    if (timing === 'before lease') vi.mocked(entitlements.loadEffectiveEntitlements).mockRestore()
    expect(await processDueProjectWatches(1, { clock: fixedClock(now) })).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: first.id }))
  })

  it('admits another owner while a Site stalls and keeps that owner’s Sites in due order', async () => {
    const sameOwner = await prisma.project.create({ data: { userId: first.userId, name: 'Second Site on the same account',
      url: 'https://same-owner.example.com/', canonicalHost: 'same-owner.example.com', watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(now.getTime() - 90_000) } })
    const admit = vi.mocked(scheduledRuns.requestScheduledSiteRun)
    const original = admit.getMockImplementation()!
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    admit.mockImplementation(async input => {
      if (input.projectId === first.id) {
        await held
        throw new Error('Controlled stalled admission')
      }
      return original(input)
    })
    const sweep = processDueProjectWatches(3, { clock: fixedClock(now) })
    try {
      await vi.waitFor(async () => {
        expect(admit.mock.calls.map(([input]) => input.projectId)).toEqual(expect.arrayContaining([first.id, second.id]))
        expect(await prisma.project.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
          watchNextRunAt: calcWatchNextRun('weekly', now), watchLeaseUntil: null,
        })
      }, { timeout: 2500 })
      expect(admit.mock.calls.some(([input]) => input.projectId === sameOwner.id)).toBe(false)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
        watchLeaseUntil: new Date(now.getTime() + 10 * 60_000),
      })
      release()
      await expect(sweep).resolves.toEqual({ processed: 3, enqueued: 2, errors: 1 })
      expect(admit.mock.calls.filter(([input]) => input.userId === first.userId).map(([input]) => input.projectId))
        .toEqual([first.id, sameOwner.id])
      expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
        watchNextRunAt: new Date(now.getTime() + 6 * 60 * 60_000), watchConsecutiveFailures: 4, watchLeaseUntil: null,
      })
    } finally {
      release()
      await sweep
    }
  })

  it('defers an interrupted account lookup without exposing diagnostics or misreporting a plan limit', async () => {
    const diagnostic = 'Controlled database quota error, PRIVATE_CONNECTION_DETAILS'
    const retryMessage = 'The scheduled check did not finish. FixFlags will try again.'
    const retryAt = new Date(now.getTime() + 6 * 60 * 60_000)
    const original = entitlements.loadEffectiveEntitlements
    const lookup = vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (...args) => {
      if (args[0] === first.userId) throw new Error(diagnostic)
      return original(...args)
    })
    expect(await processDueProjectWatches(20, { clock: fixedClock(now) })).toEqual({ processed: 1, enqueued: 1, errors: 1 })
    lookup.mockRestore()
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: second.id }))
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchNextRunAt: retryAt, watchConsecutiveFailures: 4, watchLeaseUntil: null, watchLastError: retryMessage })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
      watchNextRunAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000), watchConsecutiveFailures: 3, watchLeaseUntil: null })
    // Rows created by the earlier scheduler can still contain diagnostics.
    await prisma.project.update({ where: { id: first.id }, data: { watchLastError: diagnostic } })
    expect(await loadSiteRecord(first.id)).toMatchObject({ watchLastError: retryMessage })
    expect(await loadProductWatch(first.id, first.userId)).toMatchObject({ watchLastError: retryMessage, watchNextRunAt: retryAt })
    expect(watchBoardState({ interval: 'weekly', nextRunAt: retryAt, pausedAt: null, lastError: diagnostic,
      consecutiveFailures: 4, now })).toBe('delayed')
    expect(await processDueProjectWatches(1, { clock: fixedClock(retryAt), onlyProjectId: first.id }))
      .toEqual({ processed: 1, enqueued: 1, errors: 0 })
  })

  it.each(['never-attempted', 'same-clock-attempt'] as const)('admits each Site once when workers select the same %s cohort', async prior => {
    if (prior === 'same-clock-attempt') await prisma.project.updateMany({ where: { id: { in: [first.id, second.id] } },
      data: { watchLastAttemptAt: now } })
    const select = watchStorage.selectDueWatchProjects
    let selected = 0, release!: () => void
    let selection = Promise.resolve()
    const barrier = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(watchStorage, 'selectDueWatchProjects').mockImplementation(async (...args) => {
      const result = selection.then(() => select(...args))
      selection = result.then(() => undefined)
      const rows = await result
      // Both real SQL selections complete before either worker takes a row claim.
      expect(rows.map(row => row.id)).toEqual([first.id, second.id])
      if (++selected === 2) release()
      await barrier
      return rows
    })
    const results = await Promise.all([processDueProjectWatches(20, { clock: fixedClock(now) }),
      processDueProjectWatches(20, { clock: fixedClock(now) })])
    expect(selected).toBe(2)
    expect(results.reduce((sum, result) => sum + result.enqueued, 0)).toBe(2)
    expect(results.reduce((sum, result) => sum + result.errors, 0)).toBe(0)
    const admitted = vi.mocked(scheduledRuns.requestScheduledSiteRun).mock.calls.map(([input]) => input.projectId)
    expect(admitted.sort()).toEqual([first.id, second.id].sort())
    expect(await prisma.project.count({ where: { id: { in: [first.id, second.id] }, watchLeaseUntil: null,
      watchNextRunAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000) } })).toBe(2)
  })

  it.each(['advancing clock', 'same timestamp'] as const)('rotates a bounded sweep past an interrupted policy read and failed retry write: %s', async timing => {
    if (timing === 'same timestamp') await prisma.project.updateMany({ where: { id: { in: [first.id, second.id] } },
      data: { watchLastAttemptAt: now } })
    const originalPolicy = entitlements.loadEffectiveEntitlements
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db) => {
      if (userId === first.userId) throw new Error('Controlled persistent account lookup failure')
      return originalPolicy(userId, db)
    })
    const update = watchStorage.updateUnlockedWatchProject
    vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockImplementation(async (...args) => {
      const [id, , data] = args
      if (id === first.id && data.watchConsecutiveFailures !== undefined)
        throw new Error('Controlled retry persistence failure')
      return update(...args)
    })
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    expect(await processDueProjectWatches(1, { clock: fixedClock(now) })).toEqual({ processed: 0, enqueued: 0, errors: 1 })
    const later = timing === 'same timestamp' ? now : new Date(now.getTime() + 1000)
    expect(await processDueProjectWatches(1, { clock: fixedClock(later) })).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: second.id }))
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchLastAttemptAt: timing === 'same timestamp' ? new Date(now.getTime() + 1) : now,
      watchNextRunAt: before.watchNextRunAt, watchLeaseUntil: null,
      watchConsecutiveFailures: before.watchConsecutiveFailures, watchLastRunAt: before.watchLastRunAt })
    expect(await processDueProjectWatches(1, { clock: fixedClock(new Date(now.getTime() + 2000)) }))
      .toEqual({ processed: 0, enqueued: 0, errors: 1 })
  })

  it('refuses a stale selection with the same timestamp before repeating the policy read', async () => {
    await prisma.project.update({ where: { id: first.id }, data: { watchLastAttemptAt: now } })
    const scope = { projectId: first.id }
    const selected = await watchStorage.selectDueWatchProjects(now, 1, scope)
    expect(selected.map(row => row.id)).toEqual([first.id])
    vi.spyOn(watchStorage, 'selectDueWatchProjects').mockResolvedValue(selected)
    const readPolicy = entitlements.loadEffectiveEntitlements
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const policy = vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (...args) => {
      await held
      return readPolicy(...args)
    })
    const input = { clock: fixedClock(now), onlyProjectId: first.id }
    const firstSweep = processDueProjectWatches(1, input)
    let staleSweep: typeof firstSweep | undefined
    try {
      await vi.waitFor(() => expect(policy).toHaveBeenCalledOnce())
      staleSweep = processDueProjectWatches(1, input)
      await vi.waitFor(async () => {
        expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } }))
          .toMatchObject({ watchLastAttemptAt: new Date(now.getTime() + 1), watchLeaseUntil: null })
      })
      await expect(staleSweep).resolves.toEqual({ processed: 0, enqueued: 0, errors: 0 })
      expect(policy).toHaveBeenCalledOnce()
      release()
      await expect(firstSweep).resolves.toEqual({ processed: 1, enqueued: 1, errors: 0 })
      expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({
        projectId: first.id, now, claim: expect.objectContaining({ attemptedAt: new Date(now.getTime() + 1) }),
      }))
    } finally {
      release()
      await Promise.allSettled([firstSweep, staleSweep])
    }
  })

  it.each(['pause', 'reschedule', 'transfer', 'suspend', 'lease', 'attempt'] as const)('fences the attempt rotation after a concurrent %s change', async change => {
    const replacement = new Date(now.getTime() + 30 * 60_000)
    const update = watchStorage.updateUnlockedWatchProject
    let changed = false
    vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockImplementation(async (...args) => {
      const [, , data] = args
      if (!changed && data.watchLastAttemptAt) {
        changed = true
        if (change === 'pause') await prisma.project.update({ where: { id: first.id }, data: { watchInterval: null, watchNextRunAt: null } })
        if (change === 'reschedule') await prisma.project.update({ where: { id: first.id }, data: { watchNextRunAt: replacement } })
        if (change === 'transfer') await prisma.project.update({ where: { id: first.id }, data: { userId: second.userId } })
        if (change === 'suspend') await prisma.user.update({ where: { id: first.userId }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'lease') await prisma.project.update({ where: { id: first.id }, data: { watchLeaseUntil: replacement } })
        if (change === 'attempt') await prisma.project.update({ where: { id: first.id }, data: { watchLastAttemptAt: replacement } })
      }
      return update(...args)
    })
    expect(await processDueProjectWatches(1, { clock: fixedClock(now), onlyProjectId: first.id }))
      .toEqual({ processed: 0, enqueued: 0, errors: 0 })
    expect(changed).toBe(true)
    expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } }))
      .toMatchObject({ watchLastAttemptAt: change === 'attempt' ? replacement : null })
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

  it('preserves a successor attempt made during the original account lookup', async () => {
    const original = entitlements.loadEffectiveEntitlements, replacement = new Date(now.getTime() + 1000)
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db, clock) => {
      const policy = await original(userId, db, clock)
      await prisma.project.update({ where: { id: first.id }, data: { watchLastAttemptAt: replacement } })
      return policy
    })
    expect(await processDueProjectWatches(1, { clock: fixedClock(now), onlyProjectId: first.id }))
      .toEqual({ processed: 0, enqueued: 0, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } }))
      .toMatchObject({ watchLastAttemptAt: replacement, watchLeaseUntil: null })
  })

  it('does not defer a successor after an uncertain attempt-write acknowledgement', async () => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    const replacement = new Date(now.getTime() + 1000), update = watchStorage.updateUnlockedWatchProject
    let interrupted = false
    vi.spyOn(watchStorage, 'updateUnlockedWatchProject').mockImplementation(async (...args) => {
      const [, , data] = args
      const result = await update(...args)
      if (!interrupted && data.watchLastAttemptAt) {
        interrupted = true
        await prisma.project.update({ where: { id: first.id }, data: { watchLastAttemptAt: replacement } })
        throw new Error('Controlled acknowledgement loss after the attempt committed')
      }
      return result
    })
    expect(await processDueProjectWatches(1, { clock: fixedClock(now), onlyProjectId: first.id }))
      .toEqual({ processed: 0, enqueued: 0, errors: 1 })
    expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchLastAttemptAt: replacement, watchLeaseUntil: null, watchNextRunAt: before.watchNextRunAt,
      watchConsecutiveFailures: before.watchConsecutiveFailures, watchLastError: before.watchLastError })
    expect(await processDueProjectWatches(1, { clock: fixedClock(new Date(now.getTime() + 2000)), onlyProjectId: first.id }))
      .toEqual({ processed: 1, enqueued: 1, errors: 0 })
  })

  it('retains due intent when authority preparation outlasts its lease and admits a fresh retry', async () => {
    let instant = now.getTime()
    const clock = { now: () => new Date(instant) }
    const read = prisma.audit.findFirst.bind(prisma.audit)
    const delayed = vi.spyOn(prisma.audit, 'findFirst').mockImplementation(async input => {
      const value = await read(input)
      instant += 11 * 60_000
      return value
    })
    const original = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    expect(await processDueProjectWatches(1, { clock, onlyProjectId: first.id })).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchNextRunAt: original.watchNextRunAt,
      watchConsecutiveFailures: original.watchConsecutiveFailures, watchLeaseUntil: new Date(now.getTime() + 10 * 60_000) })
    delayed.mockRestore()
    expect(await processDueProjectWatches(1, { clock, onlyProjectId: first.id })).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: first.id, now: clock.now(), scheduledAt: original.watchNextRunAt }))
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

  it('drops an expired grant after slow lookup while preserving open-beta cadence', async () => {
    const start = new Date()
    let instant = start.getTime(), returnedGrant = false
    await prisma.project.update({ where: { id: first.id }, data: { watchInterval: 'DAILY' } })
    const grant = await prisma.entitlementGrant.create({ data: { userId: first.userId, operationId: 'slow-policy-' + randomUUID(),
      grantedBy: 'local-fixture-operator', plan: 'TEAM', expiresAt: new Date(start.getTime() + 60_000) } })
    const resolve = entitlements.loadEffectiveEntitlements
    let policy: Awaited<ReturnType<typeof resolve>> = null
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db, clock) => {
      const result = await resolve(userId, db, clock)
      policy = result
      return result
    })
    const read = prisma.user.findUnique.bind(prisma.user)
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(async input => {
      const value = await read(input)
      if (input.where.id === first.userId) {
        returnedGrant = Boolean(value && 'entitlementGrants' in value &&
          (value.entitlementGrants as Array<{ id: string }>).some(item => item.id === grant.id))
        instant += 2 * 60_000
      }
      return value
    })
    expect(await processDueProjectWatches(1, { clock: { now: () => new Date(instant) }, onlyProjectId: first.id }))
      .toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(returnedGrant).toBe(true)
    expect(policy).toMatchObject({ plan: 'FREE', grantIds: [], sources: expect.arrayContaining(['OPEN_BETA']) })
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledOnce()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } }))
      .toMatchObject({ watchInterval: 'DAILY', watchLeaseUntil: null })
    expect(await prisma.user.findUniqueOrThrow({ where: { id: first.userId } })).toMatchObject({ plan: 'FREE', subscriptionStatus: 'NONE' })
  })

  it.each(['transfer', 'delete', 'suspend'] as const)('cannot save schedule or freshness after a concurrent %s', async change => {
    await productTransaction(tx => ensureDefaultMonitoring(tx, first.id, first.userId, now))
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: first.id } })
    const read = entitlements.loadEffectiveEntitlements
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db, clock) => {
      const policy = await read(userId, db, clock)
      if (change === 'transfer') await prisma.project.update({ where: { id: first.id }, data: { userId: second.userId } })
      if (change === 'delete') await prisma.project.update({ where: { id: first.id }, data: { deletedAt: now } })
      if (change === 'suspend') await prisma.user.update({ where: { id: first.userId }, data: { lifecycleStatus: 'SUSPENDED' } })
      return policy
    })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, interval: 'daily' }, { clock: fixedClock(now) }))
      .toMatchObject({ ok: false })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchInterval: before.watchInterval,
      watchNextRunAt: before.watchNextRunAt, watchLeaseUntil: before.watchLeaseUntil, watchConsecutiveFailures: before.watchConsecutiveFailures })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ staleAfterMinutes: outcome.staleAfterMinutes })
  })

  it('keeps the due intent and in-flight lease when saving an unchanged cadence', async () => {
    const lease = new Date(now.getTime() + 60_000)
    const before = await prisma.project.update({ where: { id: first.id }, data: { watchLeaseUntil: lease, watchLastError: 'Controlled pending check' } })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, interval: 'weekly' }, { clock: fixedClock(now) })).toEqual({ ok: true })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchNextRunAt: before.watchNextRunAt,
      watchLeaseUntil: lease, watchLastError: before.watchLastError, watchConsecutiveFailures: before.watchConsecutiveFailures })
  })

  it.each(['paused', 'disabled'] as const)('makes a %s schedule due immediately when re-enabled', async state => {
    await prisma.project.update({ where: { id: first.id }, data: { watchInterval: state === 'paused' ? 'WEEKLY' : null,
      watchNextRunAt: null, watchLastError: 'Paused. This Site is not on a check schedule.' } })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, interval: 'weekly' }, { clock: fixedClock(now) })).toEqual({ ok: true })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: now,
      watchLeaseUntil: null, watchConsecutiveFailures: 0, watchLastError: null })
  })

  it('requests a fresh observation after slowing the cadence instead of waiting beyond the old evidence window', async () => {
    await prisma.project.update({ where: { id: first.id }, data: { watchInterval: 'HOURLY',
      watchNextRunAt: new Date(now.getTime() + 60 * 60_000), watchLeaseUntil: new Date(now.getTime() + 5 * 60_000) } })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, interval: 'weekly' }, { clock: fixedClock(now) }))
      .toMatchObject({ ok: true })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchInterval: 'WEEKLY', watchNextRunAt: now, watchLeaseUntil: null,
    })
    expect(await processDueProjectWatches(1, { onlyProjectId: first.id, clock: fixedClock(now) }))
      .toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchNextRunAt: new Date(now.getTime() + 7 * 86400_000),
    })
  })

  it('refuses a stale cadence edit without replacing the newer schedule or freshness', async () => {
    await productTransaction(tx => ensureDefaultMonitoring(tx, first.id, first.userId, now))
    const read = entitlements.loadEffectiveEntitlements
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db, clock) => {
      const policy = await read(userId, db, clock)
      await prisma.project.update({ where: { id: first.id }, data: { watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchNextRunAt: now } })
      await prisma.siteOutcome.updateMany({ where: { projectId: first.id }, data: { staleAfterMinutes: 900 } })
      return policy
    })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, interval: 'daily' }, { clock: fixedClock(now) }))
      .toMatchObject({ ok: false, code: 'WATCH_CHANGED' })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchNextRunAt: now })
    expect(await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: first.id } })).toMatchObject({ staleAfterMinutes: 900 })
  })

  it('pauses without policy or queue availability and resumes the current custom cadence once', async () => {
    await productTransaction(tx => ensureDefaultMonitoring(tx, first.id, first.userId, now))
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: first.id } })
    await prisma.project.update({ where: { id: first.id }, data: { watchInterval: 'CUSTOM', watchEveryMinutes: 180,
      watchLeaseUntil: new Date(now.getTime() + 60_000) } })
    const policy = vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockRejectedValue(new Error('Policy unavailable'))
    const redis = process.env.REDIS_URL
    try {
      delete process.env.REDIS_URL
      expect(await setProjectWatch({ projectId: first.id, userId: first.userId, action: 'pause' }))
        .toEqual({ ok: true, interval: 'custom', everyMinutes: 180 })
      expect(policy).not.toHaveBeenCalled()
    } finally { process.env.REDIS_URL = redis; policy.mockRestore() }
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchInterval: 'CUSTOM',
      watchEveryMinutes: 180, watchNextRunAt: null, watchLeaseUntil: null })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ staleAfterMinutes: outcome.staleAfterMinutes })
    // A newer saved cadence is resolved by the resume command, not an API snapshot.
    await prisma.project.update({ where: { id: first.id }, data: { watchEveryMinutes: 240 } })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, action: 'resume' }, { clock: fixedClock(now) }))
      .toEqual({ ok: true, interval: 'custom', everyMinutes: 240 })
    const lease = new Date(now.getTime() + 60_000)
    await prisma.project.update({ where: { id: first.id }, data: { watchLeaseUntil: lease } })
    expect(await setProjectWatch({ projectId: first.id, userId: first.userId, action: 'resume' },
      { clock: fixedClock(new Date(now.getTime() + 30_000)) })).toMatchObject({ ok: true })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchNextRunAt: now, watchLeaseUntil: lease })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ staleAfterMinutes: 960 })
  })

  it.each(['direct', 'parent'] as const)('rolls back both schedule and freshness when a %s transaction cannot save freshness', async transaction => {
    await productTransaction(tx => ensureDefaultMonitoring(tx, first.id, first.userId, now))
    const project = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: first.id } })
    // Disposable database only. Enforce a real PostgreSQL failure after the Project write.
    await prisma.$executeRawUnsafe('ALTER TABLE "site_outcomes" ADD CONSTRAINT "watch_settings_fixture" CHECK ("staleAfterMinutes" <> 2160) NOT VALID')
    try {
      const input = { projectId: first.id, userId: first.userId, interval: 'daily' as const }
      const attempt = transaction === 'direct' ? setProjectWatch(input, { clock: fixedClock(now) })
        : prisma.$transaction(tx => setProjectWatch(input, { tx, clock: fixedClock(now) }))
      await expect(attempt).rejects.toThrow()
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "site_outcomes" DROP CONSTRAINT "watch_settings_fixture"')
    }
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ watchInterval: project.watchInterval,
      watchNextRunAt: project.watchNextRunAt, watchConsecutiveFailures: project.watchConsecutiveFailures })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ staleAfterMinutes: outcome.staleAfterMinutes })
  })


  it.each(['owner transfer', 'session revoked', 'execution replaced'] as const)('does not write a due attempt after %s', async change => {
    const actorId = 'scoped-operator-' + randomUUID(), sessionId = randomUUID()
    await prisma.user.create({ data: { id: actorId, email: actorId + '@example.test', role: 'admin' } }); userIds.push(actorId)
    await prisma.session.create({ data: { id: sessionId, userId: actorId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
    const operation = await prisma.adminOperation.create({ data: { actorId, actorSessionId: sessionId, actorAuthenticatedAt: new Date(),
      action: 'SITE_RECONCILE', targetType: 'SITE', targetId: first.id, ownerId: first.userId, reason: 'Controlled scope fixture',
      input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(Date.now() + 60_000),
      status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(Date.now() + 60_000) } })
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    const select = watchStorage.selectDueWatchProjects
    vi.spyOn(watchStorage, 'selectDueWatchProjects').mockImplementationOnce(async (...args) => {
      if (change === 'owner transfer') {
        await prisma.project.update({ where: { id: first.id }, data: { userId: second.userId } })
        return select(...args)
      }
      const rows = await select(...args)
      if (change === 'session revoked') await prisma.session.delete({ where: { id: sessionId } })
      else await prisma.adminOperation.update({ where: { id: operation.id }, data: { executionToken: randomUUID() } })
      return rows
    })
    try {
      const tick = processDueProjectWatches(1, { onlyProjectId: first.id, clock: fixedClock(now),
        operator: { kind: 'admin', actorId, operationId: operation.id, executionToken: operation.executionToken! } })
      if (change === 'owner transfer') await expect(tick).resolves.toEqual({ processed: 0, enqueued: 0, errors: 0 })
      else await expect(tick).rejects.toMatchObject({ code: change === 'session revoked' ? 'ADMIN_ACCESS_REVOKED' : 'ADMIN_DOMAIN_ACCESS_DENIED' })
      expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
      expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ userId: change === 'owner transfer' ? second.userId : first.userId,
        watchNextRunAt: before.watchNextRunAt, watchLastAttemptAt: before.watchLastAttemptAt, watchLeaseUntil: before.watchLeaseUntil })
    } finally { await prisma.adminOperation.delete({ where: { id: operation.id } }) }
  })

})
