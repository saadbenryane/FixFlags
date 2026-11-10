import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { emailRecipientHash } from '@/lib/email/delivery-events'
import { deliverWebsiteSummaries, saveNotificationPreferences } from '../service'
import { DEFAULT_NOTIFICATION_PREFERENCES, nextSummaryAt } from '../preferences'
import * as summaries from '@/lib/sites/application/list-sites'
import { scheduleSummaries } from '../schedule'

const provider = vi.hoisted(() => ({ send: vi.fn(), reserved: false }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: provider.send } } }))
vi.mock('@/lib/email/recipient', () => ({ isReservedEmailRecipient: () => provider.reserved }))
const run = process.env.NOTIFICATION_DB_REQUIRED === 'true' ? describe : describe.skip

run('summary delivery using real database claims', () => {
  const users: string[] = []
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use a disposable notification test database')
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    users.length = 0
  })
  afterAll(() => prisma.$disconnect())
  async function fixture() {
    const now = new Date(), id = randomUUID()
    users.push(id)
    await prisma.user.create({ data: { id, email: `${id}@notification.test`, emailVerified: true } })
    const site = await prisma.project.create({ data: { userId: id, name: 'Example', url: 'https://example.com/',
      canonicalHost: 'example.com', watchInterval: 'DAILY' } })
    await prisma.notificationPreference.create({ data: { userId: id, cadence: 'DAILY', nextSendAt: new Date(now.getTime() - 60_000) } })
    provider.send.mockReset().mockResolvedValue({ data: { id: 'accepted' }, error: null })
    provider.reserved = false
    return { id, site, now: new Date(now.getTime() + 1000) }
  }
  it('sends one account summary under competing sweeps and advances the delivery schedule', async () => {
    const { id, now } = await fixture()
    await Promise.all([deliverWebsiteSummaries(now), deliverWebsiteSummaries(now)])
    expect(provider.send).toHaveBeenCalledOnce()
    const receipt = await prisma.notificationDigest.findFirstOrThrow({ where: { userId: id } })
    expect(receipt).toMatchObject({ status: 'SENT', providerId: 'accepted', attempts: 1 })
    expect(provider.send.mock.calls[0][0].text).toContain('No completed check yet.')
    expect((await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } })).nextSendAt!.getTime()).toBeGreaterThan(now.getTime())
  })
  it('admits independent current accounts ahead of obsolete receipts and an older account backlog', async () => {
    const accounts = [await fixture(), await fixture(), await fixture()]
    const [backlog, independent, obsolete] = accounts, now = obsolete.now
    await prisma.notificationPreference.updateMany({ where: { userId: { in: accounts.map(account => account.id) } },
      data: { revision: 1, nextSendAt: new Date(now.getTime() + 86_400_000) } })
    const rows = [obsolete, obsolete, backlog, backlog, independent].map((account, index) => {
      const due = new Date(now.getTime() - (5 - index) * 60_000)
      return { id: randomUUID(), userId: account.id, revision: account === obsolete ? 0 : 1, scheduledAt: due, nextAttemptAt: due }
    })
    await prisma.notificationDigest.createMany({ data: rows })
    provider.send.mockImplementation(async () => ({ data: { id: randomUUID() }, error: null }))

    await deliverWebsiteSummaries(now, 2)
    expect(provider.send).toHaveBeenCalledTimes(2)
    expect(await prisma.notificationDigest.findMany({ where: { id: { in: rows.map(row => row.id) }, status: 'SENT' }, select: { id: true } }))
      .toEqual(expect.arrayContaining([{ id: rows[2].id }, { id: rows[4].id }]))

    await deliverWebsiteSummaries(now, 3)
    expect(provider.send).toHaveBeenCalledTimes(3)
    expect(await prisma.notificationDigest.count({ where: { id: { in: [rows[0].id, rows[1].id] }, status: 'SKIPPED', attempts: 0 } })).toBe(2)
  })
  it('delivers another account while a provider call is pending and keeps each account in order', async () => {
    const slow = await fixture(), independent = await fixture(), now = independent.now
    await prisma.notificationPreference.updateMany({ where: { userId: { in: [slow.id, independent.id] } },
      data: { nextSendAt: new Date(now.getTime() + 86_400_000) } })
    const rows = [slow, slow, independent].map((account, index) => {
      const due = new Date(now.getTime() - (3 - index) * 60_000)
      return { id: randomUUID(), userId: account.id, revision: 0, scheduledAt: due, nextAttemptAt: due }
    })
    await prisma.notificationDigest.createMany({ data: rows })
    let release!: () => void
    const hold = new Promise<void>(resolve => { release = resolve })
    provider.send.mockImplementation(async (_message, options) => {
      if (options.idempotencyKey === `fixflags-summary-${rows[0].id}`) await hold
      return { data: { id: randomUUID() }, error: null }
    })
    const sweep = deliverWebsiteSummaries(now, 3)
    try {
      await vi.waitFor(async () => {
        expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: rows[2].id } })).toMatchObject({ status: 'SENT' })
      }, { timeout: 1500 })
      expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: rows[0].id } })).toMatchObject({ status: 'SENDING' })
      expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: rows[1].id } })).toMatchObject({ status: 'PENDING', attempts: 0 })
    } finally { release(); await sweep }
    expect(provider.send).toHaveBeenCalledTimes(3)
    expect(await prisma.notificationDigest.count({ where: { id: { in: rows.map(row => row.id) }, status: 'SENT', attempts: 1 } })).toBe(3)
  })
  it('delivers a due receipt created after the sweep starts without waiting for another sweep', async () => {
    const { id, now } = await fixture()
    const future = await prisma.notificationDigest.create({ data: { userId: id, revision: 0,
      scheduledAt: new Date(now.getTime() + 86400_000), nextAttemptAt: new Date(now.getTime() + 60_000) } })
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
    const transaction = prisma.$transaction.bind(prisma)
    let advanced = false
    vi.spyOn(prisma, '$transaction').mockImplementation(async (...args) => {
      const result = await Reflect.apply(transaction, prisma, args)
      // Scheduling and persistence consume real time in production. Freeze
      // that boundary explicitly instead of relying on database clock skew.
      if (!advanced) {
        const receipt = await prisma.notificationDigest.findFirstOrThrow({ where: { userId: id, scheduledAt: { lt: now } } })
        advanced = true; vi.setSystemTime(now.getTime() + 100)
        await prisma.notificationDigest.update({ where: { id: receipt.id }, data: { nextAttemptAt: new Date() } })
      }
      return result
    })
    try {
      await deliverWebsiteSummaries(now)
      expect(advanced).toBe(true)
      expect(provider.send).toHaveBeenCalledOnce()
      expect(await prisma.notificationDigest.findFirstOrThrow({ where: { userId: id, status: 'SENT' } }))
        .toMatchObject({ status: 'SENT', attempts: 1 })
      expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: future.id } }))
        .toMatchObject({ status: 'PENDING', attempts: 0, nextAttemptAt: future.nextAttemptAt })
    } finally { vi.useRealTimers() }
  })
  it('retries the frozen message with its original delivery key', async () => {
    const { id, now, site } = await fixture()
    provider.send.mockResolvedValueOnce({ error: { message: 'Try later' }, data: null })
    await deliverWebsiteSummaries(now)
    const first = provider.send.mock.calls[0]
    await prisma.project.update({ where: { id: site.id }, data: { name: 'Changed name' } })
    const retryAt = new Date(now.getTime() + 6 * 60_000)
    await deliverWebsiteSummaries(retryAt)
    expect(provider.send).toHaveBeenCalledTimes(2)
    expect(provider.send.mock.calls[1][0]).toEqual(first[0])
    expect(provider.send.mock.calls[1][1].idempotencyKey).toEqual(first[1].idempotencyKey)
    expect(await prisma.notificationDigest.findFirst({ where: { userId: id } })).toMatchObject({ status: 'SENT', attempts: 2 })
  })
  it.each(['removed', 'transferred', 'muted', 'paused', 'recipient', 'suspended', 'preferences', 'urgent-only', 'cadence', 'target'] as const)('refuses a queued summary after %s changes', async change => {
    const { id, now, site } = await fixture()
    provider.send.mockResolvedValueOnce({ error: { message: 'Try later' }, data: null })
    await deliverWebsiteSummaries(now)
    if (change === 'removed') await prisma.project.update({ where: { id: site.id }, data: { deletedAt: now } })
    if (change === 'muted') await prisma.project.update({ where: { id: site.id }, data: { notificationLevel: 'OFF' } })
    if (change === 'paused') await prisma.project.update({ where: { id: site.id }, data: { watchPausedAt: now } })
    if (change === 'urgent-only') await prisma.project.update({ where: { id: site.id }, data: { notificationLevel: 'CRITICAL_ONLY' } })
    if (change === 'cadence') await prisma.project.update({ where: { id: site.id }, data: { watchInterval: 'WEEKLY' } })
    if (change === 'target') await prisma.project.update({ where: { id: site.id }, data: { url: 'https://other.example.com/' } })
    if (change === 'recipient') await prisma.user.update({ where: { id }, data: { email: `${randomUUID()}@notification.test` } })
    if (change === 'suspended') await prisma.user.update({ where: { id }, data: { lifecycleStatus: 'SUSPENDED' } })
    if (change === 'preferences') await saveNotificationPreferences(id, { ...DEFAULT_NOTIFICATION_PREFERENCES, cadence: 'OFF' }, now)
    if (change === 'transferred') {
      const other = randomUUID(); users.push(other)
      await prisma.user.create({ data: { id: other, email: `${other}@notification.test` } })
      await prisma.project.update({ where: { id: site.id }, data: { userId: other } })
    }
    await deliverWebsiteSummaries(new Date(now.getTime() + 6 * 60_000))
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.notificationDigest.findFirst({ where: { userId: id } })).toMatchObject({ status: 'SKIPPED' })
  })
  it('reports confirmed urgent findings without a generic coverage warning', async () => {
    const { id, site, now } = await fixture()
    await prisma.project.update({ where: { id: site.id }, data: { notificationLevel: 'CRITICAL_ONLY' } })
    const audit = await prisma.audit.create({ data: { userId: id, projectId: site.id, url: site.url,
      status: 'COMPLETED', completedAt: now, reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, scope: 'SITE', environment: 'production' } } })
    await prisma.flag.createMany({ data: ['CRITICAL', 'IMPORTANT'].map(severity => ({ auditId: audit.id, source: 'DETERMINISTIC' as const,
      rubric: 'SECURITY', severity: severity as 'CRITICAL' | 'IMPORTANT', confidence: 1, position: 0, checkId: 'test-confirmed',
      problem: 'Controlled problem', evidence: 'Fixture', whyItMatters: 'Fixture', fix: 'Fixture' })) })
    await deliverWebsiteSummaries(now)
    expect(provider.send.mock.calls[0][0].text).toContain('1 urgent problem to review')
    expect(provider.send.mock.calls[0][0].text).toContain('- Controlled problem')
    expect(provider.send.mock.calls[0][0].html).toContain('View fix prompts</a>')
    expect(provider.send.mock.calls[0][0].text).not.toContain('Some checks could not finish.')
  })
  it('keeps existing website problems after a newer targeted check completes', async () => {
    const { id, site, now } = await fixture()
    const broad = await prisma.audit.create({ data: { userId: id, projectId: site.id, url: site.url,
      status: 'COMPLETED', createdAt: new Date(now.getTime() - 2 * 3600_000), completedAt: new Date(now.getTime() - 3600_000),
      reportCompleteness: 'FULL', executionSpec: { version: 1, scope: 'SITE', environment: 'production' } } })
    await prisma.flag.create({ data: { auditId: broad.id, source: 'DETERMINISTIC', rubric: 'SECURITY', severity: 'CRITICAL',
      confidence: 1, position: 0, checkId: 'test-existing-problem', problem: 'Still needs fixing', evidence: 'Fixture',
      whyItMatters: 'Fixture', fix: 'Fixture' } })
    await prisma.audit.create({ data: { userId: id, projectId: site.id, url: site.url, status: 'COMPLETED', completedAt: now,
      executionSpec: { version: 1, scope: 'CATEGORY', environment: 'production' } } })
    await deliverWebsiteSummaries(now)
    expect(provider.send.mock.calls[0][0].text).toContain('1 problem to review')
    expect(provider.send.mock.calls[0][0].text).toContain('- Still needs fixing')
    expect(provider.send.mock.calls[0][0].text).not.toContain('No problems to review')
  })
  it('fences a preference change while the delivery body is being prepared', async () => {
    const { id, now } = await fixture()
    const original = summaries.loadSiteNotificationSummaries
    vi.spyOn(summaries, 'loadSiteNotificationSummaries').mockImplementationOnce(async (owner, at) => {
      const result = await original(owner, at)
      await saveNotificationPreferences(id, { ...DEFAULT_NOTIFICATION_PREFERENCES, cadence: 'OFF' }, now)
      return result
    })
    await deliverWebsiteSummaries(now)
    expect(provider.send).not.toHaveBeenCalled()
  })
  it.each(['transfer', 'opt-out', 'bounce', 'bounce during retry'] as const)('refuses a summary when a %s commits after the send claim', async change => {
    const { id, site, now } = await fixture()
    const retrying = change === 'bounce during retry'
    let prior = null
    if (retrying) {
      provider.send.mockResolvedValueOnce({ error: { message: 'Try later' }, data: null })
      await deliverWebsiteSummaries(now)
      prior = await prisma.notificationDigest.findFirstOrThrow({ where: { userId: id, status: 'FAILED' } })
    }
    const recipientHash = emailRecipientHash(`${id}@notification.test`)
    const update = prisma.notificationDigest.updateMany.bind(prisma.notificationDigest)
    let changed = false
    vi.spyOn(prisma.notificationDigest, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (input.data.status !== 'SENDING' || result.count !== 1) return result
      if (change === 'transfer') {
        const owner = randomUUID(); users.push(owner)
        await prisma.user.create({ data: { id: owner, email: `${owner}@notification.test` } })
        await prisma.project.update({ where: { id: site.id }, data: { userId: owner } })
      } else if (change === 'opt-out') {
        await saveNotificationPreferences(id, { cadence: 'OFF' }, now)
      } else {
        await prisma.emailSuppression.create({ data: { recipientHash, reason: 'BOUNCED', occurredAt: now, providerId: randomUUID() } })
      }
      changed = true
      return result
    })
    try {
      await deliverWebsiteSummaries(retrying ? new Date(now.getTime() + 6 * 60_000) : now)
      expect(changed).toBe(true)
      expect(provider.send).toHaveBeenCalledTimes(prior?.attempts ?? 0)
      expect(await prisma.notificationDigest.findFirstOrThrow({ where: { userId: id } })).toMatchObject({
        status: 'SKIPPED', attempts: prior?.attempts ?? 0, leaseUntil: null, payload: prior?.payload ?? null, providerId: null,
      })
    } finally {
      await prisma.emailSuppression.deleteMany({ where: { recipientHash } })
    }
  })
  it.each(['reconciliation', 'due'] as const)('continues scheduling independent accounts after an unreadable %s preference', async phase => {
    const accounts = [await fixture(), await fixture()].sort((a, b) => a.id.localeCompare(b.id))
    const [blocked, following] = accounts, now = following.now
    const before = await prisma.notificationPreference.update({ where: { userId: blocked.id }, data: {
      cadence: phase === 'reconciliation' ? 'FOLLOW_MONITORING' : 'DAILY', timeZone: 'Invalid/Recorded-Zone',
      nextSendAt: new Date(now.getTime() - 120_000), updatedAt: new Date('2000-01-01T00:00:00Z'),
    } })
    await prisma.notificationPreference.update({ where: { userId: following.id }, data: { resolvedCadence: 'DAILY' } })
    await deliverWebsiteSummaries(now)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(provider.send.mock.calls[0][0].to).toBe(`${following.id}@notification.test`)
    expect(await prisma.notificationDigest.findFirstOrThrow({ where: { userId: following.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
    expect(await prisma.notificationDigest.count({ where: { userId: blocked.id } })).toBe(0)
    expect(await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: blocked.id } }))
      .toMatchObject({ nextSendAt: before.nextSendAt, revision: before.revision, timeZone: before.timeZone })
  })
  it('continues beyond a full failed scheduling batch and retries the original due slot after correction', async () => {
    const accounts = [await fixture(), await fixture(), await fixture()].sort((a, b) => a.id.localeCompare(b.id))
    const now = accounts[2].now
    for (const [index, account] of accounts.entries()) await prisma.notificationPreference.update({ where: { userId: account.id }, data: {
      resolvedCadence: 'DAILY', timeZone: index < 2 ? 'Invalid/Recorded-Zone' : 'UTC',
      nextSendAt: new Date(now.getTime() - (3 - index) * 60_000), updatedAt: new Date('2000-01-0' + (index + 1) + 'T00:00:00Z'),
    } })
    const original = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: accounts[0].id } })
    for (let pass = 0; pass < 3; pass++) await scheduleSummaries(new Date(now.getTime() + pass * 1000), 1)
    expect(await prisma.notificationDigest.count({ where: { userId: accounts[2].id } })).toBe(1)
    expect(await prisma.notificationDigest.count({ where: { userId: { in: accounts.slice(0, 2).map(account => account.id) } } })).toBe(0)
    expect(await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: accounts[0].id } }))
      .toMatchObject({ nextSendAt: original.nextSendAt, revision: original.revision })
    await prisma.notificationPreference.update({ where: { userId: accounts[0].id }, data: { timeZone: 'UTC' } })
    await scheduleSummaries(new Date(now.getTime() + 3000), 20)
    expect(await prisma.notificationDigest.findFirstOrThrow({ where: { userId: accounts[0].id } }))
      .toMatchObject({ scheduledAt: original.nextSendAt, revision: original.revision, status: 'PENDING', attempts: 0 })
    expect(provider.send).not.toHaveBeenCalled()
  })
  it('initializes later accounts after one default transaction is interrupted', async () => {
    const [blocked, following] = [await fixture(), await fixture()].sort((a, b) => a.id.localeCompare(b.id))
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [blocked.id, following.id] } } })
    const transaction = prisma.$transaction.bind(prisma)
    vi.spyOn(prisma, '$transaction').mockImplementation(operation => {
      if (typeof operation !== 'function') return transaction(operation)
      return transaction(async tx => {
        const create = tx.notificationPreference.createMany.bind(tx.notificationPreference)
        const defaults = vi.spyOn(tx.notificationPreference, 'createMany').mockImplementation(args => {
          const data = Array.isArray(args.data) ? args.data : [args.data]
          if (data.some(row => row.userId === blocked.id)) throw new Error('Controlled account initialization interruption')
          return create(args)
        })
        try { return await operation(tx) }
        finally { defaults.mockRestore() }
      })
    })
    await scheduleSummaries(following.now, 20)
    expect(await prisma.notificationPreference.findUnique({ where: { userId: blocked.id } })).toBeNull()
    expect(await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: following.id } }))
      .toMatchObject({ cadence: 'FOLLOW_MONITORING', resolvedCadence: 'DAILY', nextSendAt: expect.any(Date) })
    expect(await prisma.notificationDigest.count({ where: { userId: { in: [blocked.id, following.id] } } })).toBe(0)
  })
  it('preserves a concurrent preference correction while retaining a failed scheduling intent', async () => {
    const { id, now } = await fixture()
    const before = await prisma.notificationPreference.update({ where: { userId: id }, data: {
      timeZone: 'Invalid/Recorded-Zone', resolvedCadence: 'DAILY',
    } })
    const nextSendAt = new Date(now.getTime() + 86400_000), updatedAt = new Date(now.getTime() + 1000)
    const update = prisma.notificationPreference.updateMany.bind(prisma.notificationPreference)
    let corrected = false
    vi.spyOn(prisma.notificationPreference, 'updateMany').mockImplementation(async args => {
      if (!corrected && args.where?.userId === id && args.data.updatedAt) {
        corrected = true
        await prisma.notificationPreference.update({ where: { userId: id }, data: {
          timeZone: 'UTC', hour: 18, revision: { increment: 1 }, nextSendAt, updatedAt,
        } })
      }
      return update(args)
    })
    await scheduleSummaries(now, 20)
    expect(corrected).toBe(true)
    expect(await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } }))
      .toMatchObject({ timeZone: 'UTC', hour: 18, revision: before.revision + 1, nextSendAt, updatedAt })
    expect(await prisma.notificationDigest.count({ where: { userId: id } })).toBe(0)
  })
  it('recalculates a followed schedule when monitoring changes from weekly to daily', async () => {
    const { id, site, now } = await fixture()
    await prisma.project.update({ where: { id: site.id }, data: { watchInterval: 'WEEKLY' } })
    await saveNotificationPreferences(id, DEFAULT_NOTIFICATION_PREFERENCES, now)
    expect(await prisma.notificationPreference.findUnique({ where: { userId: id } })).toMatchObject({ resolvedCadence: 'WEEKLY' })
    await prisma.project.update({ where: { id: site.id }, data: { watchInterval: 'DAILY' } })
    await deliverWebsiteSummaries(now)
    const saved = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } })
    expect(saved.resolvedCadence).toBe('DAILY')
    expect(saved.nextSendAt!.getTime() - now.getTime()).toBeLessThanOrEqual(24 * 3600_000)
    expect(provider.send).not.toHaveBeenCalled()
  })
  it.each([
    ['WEEKLY', 'DAILY'], ['DAILY', 'WEEKLY'],
  ] as const)('keeps a product-tip save coherent with a monitoring change from %s to %s', async (previous, current) => {
    const { id, site } = await fixture()
    const now = new Date('2026-10-29T10:00:00Z')
    await prisma.project.update({ where: { id: site.id }, data: { watchInterval: previous } })
    await saveNotificationPreferences(id, DEFAULT_NOTIFICATION_PREFERENCES, now)
    const before = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } })
    expect(before).toMatchObject({ resolvedCadence: previous,
      nextSendAt: nextSummaryAt(DEFAULT_NOTIFICATION_PREFERENCES, previous, now) })
    const queued = await prisma.notificationDigest.create({ data: { userId: id, revision: before.revision,
      scheduledAt: new Date(now.getTime() - 60_000), nextAttemptAt: now } })
    await prisma.project.update({ where: { id: site.id }, data: { watchInterval: current } })
    await saveNotificationPreferences(id, { productTips: true }, now)
    const saved = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } })
    expect(saved).toMatchObject({ productTips: true, resolvedCadence: current, revision: before.revision + 1,
      nextSendAt: nextSummaryAt(DEFAULT_NOTIFICATION_PREFERENCES, current, now) })
    await deliverWebsiteSummaries(now)
    expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({ status: 'SKIPPED', attempts: 0 })
    expect(provider.send).not.toHaveBeenCalled()
  })
  it('preserves a due summary and its revision when saving an unrelated preference without a cadence change', async () => {
    const { id, now } = await fixture()
    const before = await prisma.notificationPreference.update({ where: { userId: id }, data: { resolvedCadence: 'DAILY' } })
    await saveNotificationPreferences(id, { productTips: true }, now)
    expect(await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } }))
      .toMatchObject({ revision: before.revision, nextSendAt: before.nextSendAt, productTips: true })
    await deliverWebsiteSummaries(now)
    expect(provider.send).toHaveBeenCalledOnce()
  })
  it.each(['existing', 'missing'] as const)('serializes preference saves with summary scheduling for %s preferences', async kind => {
    const { id, now } = await fixture()
    if (kind === 'missing') await prisma.notificationPreference.delete({ where: { userId: id } })
    else await prisma.notificationPreference.update({ where: { userId: id }, data: { resolvedCadence: 'DAILY' } })
    let pause!: () => void, resume!: () => void
    const paused = new Promise<void>(resolve => { pause = resolve })
    const resumed = new Promise<void>(resolve => { resume = resolve })
    const transaction = prisma.$transaction.bind(prisma)
    let first = true
    vi.spyOn(prisma, '$transaction').mockImplementation(operation => {
      if (!first || typeof operation !== 'function') return transaction(operation)
      first = false
      return transaction(async tx => {
        const read = tx.project.findMany.bind(tx.project)
        const sites = vi.spyOn(tx.project, 'findMany').mockImplementation(async args => {
          const result = await read(args)
          pause(); await resumed
          return result
        })
        try { return await operation(tx) }
        finally { sites.mockRestore() }
      })
    })
    const saving = saveNotificationPreferences(id, { productTips: true }, now)
    await paused
    let settled = false
    const scheduling = scheduleSummaries(now, 20).finally(() => { settled = true })
    try {
      // Wait for either completed admission or its real PostgreSQL row wait,
      // then release the paused save. No fixed delay chooses the race winner.
      let waiting = false
      for (let attempt = 0; attempt < 100 && !settled && !waiting; attempt++) {
        const [state] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND (query LIKE 'UPDATE%notification_preferences%' OR query LIKE '%SELECT id FROM users%'
              OR query LIKE 'INSERT INTO%notification_%')) AS waiting`
        waiting = state.waiting
        if (!settled && !waiting) await new Promise(resolve => setTimeout(resolve, 10))
      }
      expect(settled || waiting).toBe(true)
    } finally { resume(); await saving; await scheduling }
    const saved = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: id } })
    expect(saved.productTips).toBe(true)
    expect(saved.nextSendAt!.getTime()).toBeGreaterThan(now.getTime())
    await scheduleSummaries(now, 20)
    expect(await prisma.notificationDigest.count({ where: { userId: id } })).toBe(kind === 'existing' ? 1 : 0)
    expect(provider.send).not.toHaveBeenCalled()
  })
  it('does not replay a failed delivery beyond the provider’s deduplication window', async () => {
    const { id, now } = await fixture()
    provider.send.mockResolvedValueOnce({ error: { message: 'Uncertain response' }, data: null })
    await deliverWebsiteSummaries(now)
    await prisma.notificationPreference.update({ where: { userId: id }, data: { nextSendAt: new Date(now.getTime() + 7 * 86400_000) } })
    await deliverWebsiteSummaries(new Date(now.getTime() + 25 * 3600_000))
    expect(provider.send).toHaveBeenCalledOnce()
  })
})
