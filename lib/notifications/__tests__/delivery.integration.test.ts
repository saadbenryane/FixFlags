import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { deliverWebsiteSummaries, saveNotificationPreferences } from '../service'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../preferences'
import * as summaries from '@/lib/sites/application/list-sites'

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
  it('labels incomplete evidence and respects urgent-only selection', async () => {
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
    expect(provider.send.mock.calls[0][0].text).toContain('Some checks could not finish.')
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
  it('does not replay a failed delivery beyond the provider’s deduplication window', async () => {
    const { id, now } = await fixture()
    provider.send.mockResolvedValueOnce({ error: { message: 'Uncertain response' }, data: null })
    await deliverWebsiteSummaries(now)
    await prisma.notificationPreference.update({ where: { userId: id }, data: { nextSendAt: new Date(now.getTime() + 7 * 86400_000) } })
    await deliverWebsiteSummaries(new Date(now.getTime() + 25 * 3600_000))
    expect(provider.send).toHaveBeenCalledOnce()
  })
})
