import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

const provider = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: provider.send } } }))
import { notifyWatchRegression } from '../project-watch'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
const now = new Date('2026-10-20T12:00:00Z')

run('Watch notification admission through the database ledger', () => {
  const users: string[] = []
  const audits: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
    provider.send.mockReset().mockResolvedValue({ data: { id: 'fixture-accepted' }, error: null })
  })
  afterEach(() => { vi.useRealTimers() })
  afterAll(async () => {
    try {
      await prisma.audit.deleteMany({ where: { id: { in: audits } } })
      await prisma.user.deleteMany({ where: { id: { in: users } } })
    } finally { await prisma.$disconnect() }
  })
  async function fixture() {
    const owner = await prisma.user.create({ data: { email: `${randomUUID()}@notification.test`, role: 'admin' } })
    users.push(owner.id)
    const project = await prisma.project.create({ data: { userId: owner.id, name: 'Notification fixture',
      canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'WEEKLY' } })
    const audit = await prisma.audit.create({ data: { userId: owner.id, projectId: project.id, url: project.url,
      status: 'COMPLETED', recheckTrigger: 'WATCH', completedAt: now, improvementProjectedAt: now,
      reportCompleteness: 'FULL', watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'PENDING',
      flags: { create: { checkId: 'security-headers-missing-csp', source: 'DETERMINISTIC', rubric: 'SECURITY',
        severity: 'IMPORTANT', confidence: 1, position: 0, problem: 'Content policy is missing',
        evidence: 'Controlled missing header', whyItMatters: 'Policy is absent', fix: 'Add the policy' } } } })
    audits.push(audit.id)
    return { owner, project, audit }
  }

  it.each([false, true])('does not replay an uncertain delivery after provider deduplication expires (legacy: %s)', async legacy => {
    const { audit } = await fixture()
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
    await notifyWatchRegression(null, audit.id)
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    if (legacy) {
      const payload = { ...(original.watchNotificationPayload as Prisma.JsonObject) }; delete payload.firstAttemptAt
      await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationPayload: payload } })
    }
    vi.setSystemTime(new Date(now.getTime() + 25 * 3600_000))
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotifiedAt: null, watchNotificationProviderId: null,
      watchNotificationLastError: expect.stringContaining('idempotency window'),
    })
  })

  it('does not consume another delivery attempt before its retry is due', async () => {
    const { audit } = await fixture()
    provider.send.mockResolvedValue({ data: null, error: { message: 'Temporary provider outage' } })
    await notifyWatchRegression(null, audit.id)
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1,
      watchNotificationNextAttemptAt: new Date(now.getTime() + 5 * 60_000) })
    vi.setSystemTime(new Date(now.getTime() + 5 * 60_000 - 1))
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    vi.setSystemTime(new Date(now.getTime() + 5 * 60_000))
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).toHaveBeenCalledTimes(2)
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(failed).toMatchObject({ watchNotificationAttempts: 2,
      watchNotificationNextAttemptAt: new Date(now.getTime() + 15 * 60_000) })
    provider.send.mockResolvedValue({ data: { id: 'accepted-after-backoff' }, error: null })
    vi.setSystemTime(failed.watchNotificationNextAttemptAt!)
    await notifyWatchRegression(null, audit.id)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'SENT', watchNotificationAttempts: 3, watchNotificationNextAttemptAt: null })
  })

  it('cannot bypass a retry deferral committed after selection', async () => {
    const { audit } = await fixture()
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const dueAt = new Date(now.getTime() + 5 * 60_000)
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (input.data.watchNotificationStatus === 'SENDING')
        await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationNextAttemptAt: dueAt } })
      return update(input)
    })
    try { await notifyWatchRegression(null, audit.id) } finally { admission.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationNextAttemptAt: dueAt })
  })

  it.each(['legacy-retry', 'old-first-delivery'] as const)('permits a safe %s without renewing a prior attempt', async mode => {
    const { audit } = await fixture()
    if (mode === 'legacy-retry') {
      provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
      await notifyWatchRegression(null, audit.id)
      const recorded = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      const payload = { ...(recorded.watchNotificationPayload as Prisma.JsonObject) }; delete payload.firstAttemptAt
      await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationPayload: payload } })
    }
    vi.setSystemTime(new Date(now.getTime() + (mode === 'legacy-retry' ? 1 : 25) * 3600_000))
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).toHaveBeenCalledTimes(mode === 'legacy-retry' ? 2 : 1)
    const result = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(result).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationProviderId: 'fixture-accepted' })
    expect((result.watchNotificationPayload as Prisma.JsonObject).firstAttemptAt).toBe(
      mode === 'legacy-retry' ? now.toISOString() : new Date().toISOString())
  })

  it('rechecks provider retention after a slow claim while its lease remains valid', async () => {
    const { audit } = await fixture()
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
    await notifyWatchRegression(null, audit.id)
    vi.setSystemTime(new Date(now.getTime() + 24 * 3600_000 - 25_000))
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (result.count && input.data.watchNotificationStatus === 'SENDING') vi.setSystemTime(Date.now() + 10_000)
      return result
    })
    try { await notifyWatchRegression(null, audit.id) } finally { admission.mockRestore() }
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 2, watchNotifiedAt: null,
      watchNotificationLastError: expect.stringContaining('idempotency window') })
  })

  it.each(['preferences', 'recipient', 'owner'] as const)('rejects a %s change at frozen-body admission', async change => {
    const { owner, project, audit } = await fixture()
    const update = prisma.audit.updateMany.bind(prisma.audit)
    let changed = false
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (!changed && input.data.watchNotificationPayload) {
        changed = true
        if (change === 'preferences') await prisma.project.update({ where: { id: project.id }, data: { notificationLevel: 'OFF' } })
        else if (change === 'recipient') await prisma.user.update({ where: { id: owner.id }, data: { email: `${randomUUID()}@notification.test` } })
        else {
          const replacement = await prisma.user.create({ data: { email: `${randomUUID()}@notification.test` } })
          users.push(replacement.id)
          await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
        }
      }
      return update(input)
    })
    try { await notifyWatchRegression(null, audit.id) } finally { admission.mockRestore() }
    expect(changed).toBe(true)
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationPayload: null,
      watchNotificationLeaseUntil: null, watchNotificationProviderId: null })
  })

  it('does not start a provider request after a delayed claim consumes its request window', async () => {
    const { audit } = await fixture()
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (result.count && input.data.watchNotificationStatus === 'SENDING') vi.setSystemTime(Date.now() + 590_000)
      return result
    })
    try { await notifyWatchRegression(null, audit.id) } finally { admission.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1, watchNotificationProviderId: null,
      watchNotificationLeaseUntil: null, watchNotifiedAt: null })
  })

  it('freezes one provider body with the winning concurrent claim and reuses it after failure', async () => {
    const { owner, audit } = await fixture()
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Controlled provider failure' } })
    // Both senders finish reading before either physical claim can win.
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    let claims = 0
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (input.data.watchNotificationStatus === 'SENDING') {
        if (++claims === 2) release()
        await barrier
      }
      return update(input)
    })
    try { await Promise.all([notifyWatchRegression(null, audit.id), notifyWatchRegression(null, audit.id)]) }
    finally { release(); admission.mockRestore() }
    expect(claims).toBe(2)
    expect(provider.send).toHaveBeenCalledOnce()
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(failed).toMatchObject({ watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1,
      watchNotificationPayload: expect.objectContaining({ to: owner.email }), watchNotificationLeaseUntil: null })
    await prisma.user.update({ where: { id: owner.id }, data: { name: 'Changed display name' } })
    vi.setSystemTime(failed.watchNotificationNextAttemptAt!)
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).toHaveBeenCalledTimes(2)
    expect(provider.send.mock.calls[1][0]).toEqual(provider.send.mock.calls[0][0])
    expect(provider.send.mock.calls[1][1].idempotencyKey).toBe(provider.send.mock.calls[0][1].idempotencyKey)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationPayload: failed.watchNotificationPayload })
  })

  it('cannot replace a body changed after selection or consume its attempt', async () => {
    const { audit } = await fixture()
    const update = prisma.audit.updateMany.bind(prisma.audit)
    let replacement: Prisma.InputJsonObject | undefined
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (!replacement && input.data.watchNotificationPayload) {
        replacement = { ...input.data.watchNotificationPayload as Prisma.InputJsonObject, subject: 'Another frozen message' }
        await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationPayload: replacement } })
      }
      return update(input)
    })
    try { await notifyWatchRegression(null, audit.id) } finally { admission.mockRestore() }
    expect(replacement).toBeDefined()
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationPayload: replacement,
      watchNotificationLeaseUntil: null })
  })

  it('retains bounded failed attempts when the recorded payload cannot be validated', async () => {
    const { audit } = await fixture()
    await prisma.audit.update({ where: { id: audit.id }, data: {
      watchNotificationAttemptCeiling: 1, watchNotificationPayload: { version: 999 } } })
    await notifyWatchRegression(null, audit.id)
    await notifyWatchRegression(null, audit.id)
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1, watchNotificationPayload: { version: 999 },
      watchNotificationLeaseUntil: null, watchNotificationProviderId: null })
  })
})
