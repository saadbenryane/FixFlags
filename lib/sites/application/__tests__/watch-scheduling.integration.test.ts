import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as entitlements from '@/lib/billing/effective-entitlements'
import * as scheduledRuns from '../scheduled-runs'
import { calcWatchNextRun, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { SiteRunRefusal } from '../run-refusal'
import { processDueProjectWatches } from '@/lib/audit/project-watch'
import { setProjectWatch } from '../monitoring-settings'
import { ensureDefaultMonitoring } from '../default-monitoring'
import { productTransaction } from '@/lib/billing/product-transaction'
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
      watchNextRunAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000), watchConsecutiveFailures: 3, watchLeaseUntil: null })
  })

  it.each(['never-attempted', 'same-clock-attempt'] as const)('admits each Site once when workers select the same %s cohort', async prior => {
    if (prior === 'same-clock-attempt') await prisma.project.updateMany({ where: { id: { in: [first.id, second.id] } },
      data: { watchLastAttemptAt: now } })
    const select = prisma.project.findMany.bind(prisma.project)
    let selected = 0, release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(prisma.project, 'findMany').mockImplementation(async input => {
      const rows = await select(input)
      // Both real SQL selections complete before either worker takes a row claim.
      if (input.where?.watchNextRunAt && typeof input.where.watchNextRunAt === 'object' && 'lte' in input.where.watchNextRunAt) {
        if (++selected === 2) release()
        await barrier
      }
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

  it('rotates a bounded sweep past an interrupted policy read even when its retry write fails', async () => {
    const originalPolicy = entitlements.loadEffectiveEntitlements
    vi.spyOn(entitlements, 'loadEffectiveEntitlements').mockImplementation(async (userId, db) => {
      if (userId === first.userId) throw new Error('Controlled persistent account lookup failure')
      return originalPolicy(userId, db)
    })
    const update = prisma.project.updateMany.bind(prisma.project)
    vi.spyOn(prisma.project, 'updateMany').mockImplementation(async input => {
      if (input.where?.id === first.id && input.data.watchConsecutiveFailures !== undefined)
        throw new Error('Controlled retry persistence failure')
      return update(input)
    })
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    expect(await processDueProjectWatches(1, { clock: fixedClock(now) })).toEqual({ processed: 0, enqueued: 0, errors: 1 })
    const later = new Date(now.getTime() + 1000)
    expect(await processDueProjectWatches(1, { clock: fixedClock(later) })).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(scheduledRuns.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: second.id }))
    expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      watchLastAttemptAt: now, watchNextRunAt: before.watchNextRunAt, watchLeaseUntil: null,
      watchConsecutiveFailures: before.watchConsecutiveFailures, watchLastRunAt: before.watchLastRunAt })
    expect(await processDueProjectWatches(1, { clock: fixedClock(new Date(now.getTime() + 2000)) }))
      .toEqual({ processed: 0, enqueued: 0, errors: 1 })
  })

  it.each(['pause', 'reschedule', 'transfer', 'suspend', 'lease', 'attempt'] as const)('fences the attempt rotation after a concurrent %s change', async change => {
    const replacement = new Date(now.getTime() + 30 * 60_000)
    const update = prisma.project.updateMany.bind(prisma.project)
    let changed = false
    vi.spyOn(prisma.project, 'updateMany').mockImplementation(async input => {
      if (!changed && input.data.watchLastAttemptAt) {
        changed = true
        if (change === 'pause') await prisma.project.update({ where: { id: first.id }, data: { watchInterval: null, watchNextRunAt: null } })
        if (change === 'reschedule') await prisma.project.update({ where: { id: first.id }, data: { watchNextRunAt: replacement } })
        if (change === 'transfer') await prisma.project.update({ where: { id: first.id }, data: { userId: second.userId } })
        if (change === 'suspend') await prisma.user.update({ where: { id: first.userId }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'lease') await prisma.project.update({ where: { id: first.id }, data: { watchLeaseUntil: replacement } })
        if (change === 'attempt') await prisma.project.update({ where: { id: first.id }, data: { watchLastAttemptAt: replacement } })
      }
      return update(input)
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
    const replacement = new Date(now.getTime() + 1000), update = prisma.project.updateMany.bind(prisma.project)
    let interrupted = false
    vi.spyOn(prisma.project, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (!interrupted && input.data.watchLastAttemptAt) {
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


  it('retains the admitted operator owner when ownership changes before due selection', async () => {
    const actorId = 'scoped-operator-' + randomUUID(), sessionId = randomUUID()
    await prisma.user.create({ data: { id: actorId, email: actorId + '@example.test', role: 'admin' } }); userIds.push(actorId)
    await prisma.session.create({ data: { id: sessionId, userId: actorId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
    const operation = await prisma.adminOperation.create({ data: { actorId, actorSessionId: sessionId, actorAuthenticatedAt: new Date(),
      action: 'SITE_RECONCILE', targetType: 'SITE', targetId: first.id, ownerId: first.userId, reason: 'Controlled scope fixture',
      input: {}, expectedRevision: 'fixture', idempotencyKey: randomUUID(), requestHash: 'fixture', intentExpiresAt: new Date(Date.now() + 60_000),
      status: 'RUNNING', executionToken: randomUUID(), leaseUntil: new Date(Date.now() + 60_000) } })
    const before = await prisma.project.findUniqueOrThrow({ where: { id: first.id } })
    const select = prisma.project.findMany.bind(prisma.project)
    vi.spyOn(prisma.project, 'findMany').mockImplementation(async input => {
      await prisma.project.update({ where: { id: first.id }, data: { userId: second.userId } })
      return select(input)
    })
    try {
      expect(await processDueProjectWatches(1, { onlyProjectId: first.id, clock: fixedClock(now),
        operator: { kind: 'admin', actorId, operationId: operation.id } })).toEqual({ processed: 0, enqueued: 0, errors: 0 })
      expect(scheduledRuns.requestScheduledSiteRun).not.toHaveBeenCalled()
      expect(await prisma.project.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ userId: second.userId,
        watchNextRunAt: before.watchNextRunAt, watchLastAttemptAt: before.watchLastAttemptAt, watchLeaseUntil: before.watchLeaseUntil })
    } finally { await prisma.adminOperation.delete({ where: { id: operation.id } }) }
  })

})
