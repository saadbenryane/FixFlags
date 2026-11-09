import { createHmac, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { performAdminExternalAction } from '@/lib/admin/external-actions'
import { executeAdminOperation } from '@/lib/admin/runtime'
import { resolveAdminTarget } from '@/lib/admin/targets'
import { prisma } from '@/lib/db'
import { setProjectWatch } from '@/lib/sites/application/monitoring-settings'
import type { Prisma } from '@prisma/client'
import { POST as receiveDelivery } from '@/app/api/webhooks/resend/delivery/route'
import { FROM_EMAIL } from '@/lib/email/from'

const provider = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: provider.send } } }))
import { notifyWatchRegression, retryPendingWatchNotifications } from '../project-watch'

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
    const owner = await prisma.user.create({ data: { email: `${randomUUID()}@notification.test`, emailVerified: true, role: 'admin' } })
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

  async function retryOperation(actorId: string, auditId: string, status: 'QUEUED' | 'RUNNING' = 'RUNNING') {
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: actorId, token: randomUUID(), expiresAt: new Date(now.getTime() + 3600_000) } })
    const intent = { action: 'WATCH_NOTIFICATION_RETRY' as const, targetId: auditId, reason: 'Controlled Watch retry', input: {} }
    const target = await resolveAdminTarget(intent)
    return prisma.adminOperation.create({ data: { ...intent, actorId, actorSessionId: session.id, actorAuthenticatedAt: now,
      ownerId: target.ownerId, targetType: 'AUDIT', expectedRevision: target.revision, idempotencyKey: randomUUID(), requestHash: 'fixture',
      intentExpiresAt: session.expiresAt, status, ...(status === 'RUNNING' ? { executionToken: randomUUID(), leaseUntil: session.expiresAt } : {}) } })
  }

  it('uses the approved retry immediately with the original provider body after backoff was saved', async () => {
    const { owner, audit } = await fixture()
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Controlled provider refusal' } })
    await notifyWatchRegression(audit.id)
    const before = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(before.watchNotificationNextAttemptAt!.getTime()).toBeGreaterThan(now.getTime())
    const operation = await retryOperation(owner.id, audit.id, 'QUEUED')
    try {
      await executeAdminOperation(operation.id)
      expect(await prisma.adminOperation.findUniqueOrThrow({ where: { id: operation.id } })).toMatchObject({ status: 'SUCCEEDED',
        result: { auditId: audit.id, state: 'SENT' } })
      expect((await prisma.adminActivityEvent.findMany({ where: { operationId: operation.id }, orderBy: { sequence: 'asc' } }))
        .map(event => event.type)).toEqual(['STARTED', 'COMPLETED'])
      expect(provider.send).toHaveBeenCalledTimes(2)
      expect(provider.send.mock.calls[1][0]).toEqual(provider.send.mock.calls[0][0])
      expect(provider.send.mock.calls[1][1].idempotencyKey).toBe(provider.send.mock.calls[0][1].idempotencyKey)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
        watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationNextAttemptAt: null,
        watchNotificationPayload: before.watchNotificationPayload,
      })
    } finally {
      // The operation and its append-only events remain in this disposable database.
      await prisma.audit.delete({ where: { id: audit.id } })
    }
  })

  it.each(['session revoked', 'delivery changed'] as const)('retains the failed receipt if %s after confirmation', async change => {
    const { owner, audit } = await fixture()
    await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationStatus: 'FAILED' } })
    const operation = await retryOperation(owner.id, audit.id)
    try {
      if (change === 'session revoked') await prisma.session.delete({ where: { id: operation.actorSessionId } })
      else await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationNextAttemptAt: new Date(now.getTime() + 60_000) } })
      const before = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      await expect(performAdminExternalAction(operation, {})).rejects.toMatchObject({ status: change === 'session revoked' ? 403 : 409 })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(before)
      expect(provider.send).not.toHaveBeenCalled()
    } finally {
      await prisma.adminOperation.delete({ where: { id: operation.id } })
      await prisma.audit.delete({ where: { id: audit.id } })
    }
  })

  it('lets the scheduler recover a committed operator retry after delivery is interrupted', async () => {
    const { owner, audit } = await fixture()
    await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationStatus: 'FAILED',
      watchNotificationAttempts: 5, watchNotificationNextAttemptAt: new Date(now.getTime() + 3600_000) } })
    const operation = await retryOperation(owner.id, audit.id)
    const read = prisma.audit.findUnique.bind(prisma.audit)
    const interrupted = vi.spyOn(prisma.audit, 'findUnique').mockImplementation(input => {
      if (input.where.id === audit.id && input.select?.watchNotificationPayload) throw new Error('Controlled interruption before sending')
      return read(input)
    })
    try {
      await expect(performAdminExternalAction(operation, {})).rejects.toThrow('Controlled interruption before sending')
      expect(provider.send).not.toHaveBeenCalled()
    } finally { interrupted.mockRestore(); await prisma.adminOperation.delete({ where: { id: operation.id } }) }
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 10,
      watchNotificationNextAttemptAt: now,
    })
    expect(await retryPendingWatchNotifications(1)).toBe(1)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'SENT', watchNotificationAttempts: 6, watchNotificationNextAttemptAt: null,
    })
    expect(await retryPendingWatchNotifications(1)).toBe(0)
  })

  it.each(['email.sent', 'email.delivered'] as const)('settles a lost final provider response from an exactly tagged signed %s event', async type => {
    const { owner, audit } = await fixture()
    await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationAttemptCeiling: 1 } })
    const providerId = randomUUID(), secret = Buffer.alloc(32, 7)
    vi.stubEnv('RESEND_DELIVERY_WEBHOOK_SECRET', 'whsec_' + secret.toString('base64'))
    let release!: () => void
    const hold = new Promise<void>(resolve => { release = resolve })
    provider.send.mockImplementationOnce(async () => { await hold; throw new Error('Controlled loss of provider response') })
    const sending = notifyWatchRegression(audit.id)
    try {
      await vi.waitFor(() => expect(provider.send).toHaveBeenCalledOnce())
      const claimed = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      expect(claimed).toMatchObject({ watchNotificationStatus: 'SENDING', watchNotificationAttempts: 1 })
      const tags = Object.fromEntries(provider.send.mock.calls[0][0].tags.map((tag: { name: string; value: string }) => [tag.name, tag.value]))
      expect(tags).toMatchObject({ audit_id: audit.id, purpose: 'watch', fixflags_receipt: expect.stringMatching(/^[a-f0-9]{32}$/) })
      vi.setSystemTime(new Date(claimed.watchNotificationLeaseUntil!.getTime() + 1000))
      expect(await retryPendingWatchNotifications(1)).toBe(1)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ watchNotificationStatus: 'FAILED' })
      const occurredAt = new Date(now.getTime() + 1000)
      function deliver(id: string, to: string, eventTags: Record<string, string>, valid = true) {
        const body = JSON.stringify({ type, created_at: occurredAt.toISOString(),
          data: { email_id: providerId, from: FROM_EMAIL, to: [to], tags: eventTags, created_at: now.toISOString() } })
        const timestamp = Math.floor(Date.now() / 1000)
        const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64')
        return receiveDelivery(new Request('https://fixflags.example/api/webhooks/resend/delivery', { method: 'POST', body,
          headers: { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': 'v1,' + (valid ? signature : 'invalid') } }))
      }
      expect((await deliver(randomUUID(), owner.email, tags, false)).status).toBe(400)
      expect((await deliver(randomUUID(), 'foreign@notification.test', tags)).status).toBe(200)
      expect((await deliver(randomUUID(), owner.email, { ...tags, fixflags_receipt: '0'.repeat(32) })).status).toBe(200)
      expect(await prisma.emailDelivery.findUnique({ where: { providerId } })).toBeNull()
      const id = randomUUID()
      expect((await deliver(id, owner.email, tags)).status).toBe(200)
      expect((await deliver(id, owner.email, tags)).status).toBe(200)
      expect((await deliver(id, owner.email, { ...tags, fixflags_receipt: 'f'.repeat(32) })).status).toBe(503)
      expect(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId } })).toMatchObject({
        userId: owner.id, channel: 'watch', sourceId: audit.id, acceptedAt: now, deliveredAt: type === 'email.delivered' ? occurredAt : null,
      })
      release()
      await sending
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
        watchNotificationStatus: 'SENT', watchNotificationProviderId: providerId, watchNotifiedAt: now,
        watchNotificationAttempts: 1, watchNotificationPayload: claimed.watchNotificationPayload, watchNotificationLastError: null,
      })
      expect(await retryPendingWatchNotifications(1)).toBe(0)
      expect(provider.send).toHaveBeenCalledOnce()
    } finally {
      release()
      await sending
      vi.unstubAllEnvs()
      await prisma.emailProviderEvent.deleteMany({ where: { providerId } })
    }
  })

  it('retains monitoring and pending findings while waiting for a verified recipient', async () => {
    const { owner, project, audit } = await fixture()
    await prisma.user.update({ where: { id: owner.id }, data: { emailVerified: false } })
    await prisma.audit.update({ where: { id: audit.id }, data: { watchRegressionCount: null, watchRecoveryCount: null } })
    await notifyWatchRegression(audit.id)
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationPayload: null,
      watchRegressionCount: 1, watchRecoveryCount: 0, completedAt: now })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
      .toMatchObject({ watchInterval: 'WEEKLY', watchLastRunAt: now })
    await prisma.user.update({ where: { id: owner.id }, data: { emailVerified: true } })
    await notifyWatchRegression(audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } }))
      .toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationAttempts: 1, completedAt: now })
  })

  it.each(['before classification', 'at delivery claim'] as const)('keeps a foreign comparison parent out of Watch mail %s', async timing => {
    const { owner, project, audit } = await fixture()
    const foreign = await prisma.project.create({ data: { userId: owner.id, name: 'Separate Site',
      canonicalHost: 'other.example.com', url: 'https://other.example.com/' } })
    const parent = await prisma.audit.create({ data: { userId: owner.id,
      projectId: timing === 'before classification' ? foreign.id : project.id, url: project.url, status: 'COMPLETED', completedAt: now } })
    audits.push(parent.id)
    await prisma.audit.update({ where: { id: audit.id }, data: { parentId: parent.id } })
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const move = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (timing === 'at delivery claim' && input.data.watchNotificationStatus === 'SENDING')
        await prisma.audit.update({ where: { id: parent.id }, data: { projectId: foreign.id } })
      return update(input)
    })
    try { await notifyWatchRegression(audit.id) } finally { move.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationPayload: null,
    })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ watchLastRunAt: now })
    expect(await retryPendingWatchNotifications(1)).toBe(0)
    expect(provider.send).not.toHaveBeenCalled()
  })

  it('refuses an operator retry for a foreign comparison parent before raising the attempt ceiling', async () => {
    const { owner, audit } = await fixture()
    const foreign = await prisma.project.create({ data: { userId: owner.id, name: 'Separate Site',
      canonicalHost: 'other.example.com', url: 'https://other.example.com/' } })
    const parent = await prisma.audit.create({ data: { userId: owner.id, projectId: foreign.id, url: foreign.url,
      status: 'COMPLETED', completedAt: now } })
    audits.push(parent.id)
    await prisma.audit.update({ where: { id: audit.id }, data: { parentId: parent.id, watchNotificationStatus: 'FAILED' } })
    const operation = await retryOperation(owner.id, audit.id)
    try {
      await expect(performAdminExternalAction(operation, {})).rejects.toMatchObject({ code: 'TARGET_CHANGED' })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
        watchNotificationStatus: 'FAILED', watchNotificationAttempts: 0, watchNotificationAttemptCeiling: 5,
      })
      expect(provider.send).not.toHaveBeenCalled()
    } finally { await prisma.adminOperation.delete({ where: { id: operation.id } }) }
  })

  it.each([false, true])('does not replay an uncertain delivery after provider deduplication expires (legacy: %s)', async legacy => {
    const { audit } = await fixture()
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
    await notifyWatchRegression(audit.id)
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    if (legacy) {
      const payload = { ...(original.watchNotificationPayload as Prisma.JsonObject) }; delete payload.firstAttemptAt
      await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationPayload: payload } })
    }
    vi.setSystemTime(new Date(now.getTime() + 25 * 3600_000))
    await notifyWatchRegression(audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotifiedAt: null, watchNotificationProviderId: null,
      watchNotificationLastError: expect.stringContaining('idempotency window'),
    })
  })

  it('does not consume another delivery attempt before its retry is due', async () => {
    const { audit } = await fixture()
    provider.send.mockResolvedValue({ data: null, error: { message: 'Temporary provider outage' } })
    await notifyWatchRegression(audit.id)
    await notifyWatchRegression(audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1,
      watchNotificationNextAttemptAt: new Date(now.getTime() + 5 * 60_000) })
    vi.setSystemTime(new Date(now.getTime() + 5 * 60_000 - 1))
    await notifyWatchRegression(audit.id)
    expect(provider.send).toHaveBeenCalledOnce()
    vi.setSystemTime(new Date(now.getTime() + 5 * 60_000))
    await notifyWatchRegression(audit.id)
    expect(provider.send).toHaveBeenCalledTimes(2)
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(failed).toMatchObject({ watchNotificationAttempts: 2,
      watchNotificationNextAttemptAt: new Date(now.getTime() + 15 * 60_000) })
    provider.send.mockResolvedValue({ data: { id: 'accepted-after-backoff' }, error: null })
    vi.setSystemTime(failed.watchNotificationNextAttemptAt!)
    await notifyWatchRegression(audit.id)
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
    try { await notifyWatchRegression(audit.id) } finally { admission.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationNextAttemptAt: dueAt })
  })

  it.each([false, true])('rechecks an owner pause committed during a waiting claim (classification deferred: %s)', async deferred => {
    const { owner, project, audit } = await fixture()
    if (deferred) await prisma.audit.update({ where: { id: audit.id }, data: {
      watchNotificationStatus: 'NOT_APPLICABLE', watchRegressionCount: null, watchRecoveryCount: null,
    } })
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (input.data.watchNotificationStatus !== 'SENDING') return update(input)
      let claim: Promise<Prisma.BatchPayload> | undefined
      try {
        await prisma.$transaction(async tx => {
          const [{ backend }] = await tx.$queryRaw<Array<{ backend: number }>>`
            SELECT pg_backend_pid() AS backend FROM audits WHERE id = ${audit.id} FOR NO KEY UPDATE`
          claim = update(input).then(result => result)
          void claim.catch(() => {})
          await expect.poll(async () => {
            const [{ waiting }] = await tx.$queryRaw<Array<{ waiting: boolean }>>`
              SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${backend} = ANY(pg_blocking_pids(pid))) AS waiting`
            return waiting
          }, { timeout: 2500 }).toBe(true)
          expect(await setProjectWatch({ projectId: project.id, userId: owner.id, action: 'pause' }, { tx })).toMatchObject({ ok: true })
        })
        return await claim!
      } finally { await claim?.catch(() => {}) }
    })
    try { await notifyWatchRegression(audit.id) } finally { admission.mockRestore() }
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchRegressionCount: 1, watchRecoveryCount: 0,
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationPayload: null, watchNotificationLeaseUntil: null,
    })
  })

  it.each(['legacy-retry', 'old-first-delivery'] as const)('permits a safe %s without renewing a prior attempt', async mode => {
    const { audit } = await fixture()
    if (mode === 'legacy-retry') {
      provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
      await notifyWatchRegression(audit.id)
      const recorded = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
      const payload = { ...(recorded.watchNotificationPayload as Prisma.JsonObject) }; delete payload.firstAttemptAt
      await prisma.audit.update({ where: { id: audit.id }, data: { watchNotificationPayload: payload } })
    }
    vi.setSystemTime(new Date(now.getTime() + (mode === 'legacy-retry' ? 1 : 25) * 3600_000))
    await notifyWatchRegression(audit.id)
    expect(provider.send).toHaveBeenCalledTimes(mode === 'legacy-retry' ? 2 : 1)
    const result = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(result).toMatchObject({ watchNotificationStatus: 'SENT', watchNotificationProviderId: 'fixture-accepted' })
    expect((result.watchNotificationPayload as Prisma.JsonObject).firstAttemptAt).toBe(
      mode === 'legacy-retry' ? now.toISOString() : new Date().toISOString())
  })

  it('rechecks provider retention after a slow claim while its lease remains valid', async () => {
    const { audit } = await fixture()
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
    await notifyWatchRegression(audit.id)
    vi.setSystemTime(new Date(now.getTime() + 24 * 3600_000 - 25_000))
    const update = prisma.audit.updateMany.bind(prisma.audit)
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (result.count && input.data.watchNotificationStatus === 'SENDING') vi.setSystemTime(Date.now() + 10_000)
      return result
    })
    try { await notifyWatchRegression(audit.id) } finally { admission.mockRestore() }
    expect(provider.send).toHaveBeenCalledOnce()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 2, watchNotifiedAt: null,
      watchNotificationLastError: expect.stringContaining('idempotency window') })
  })

  it.each(['preferences', 'recipient', 'verification', 'owner'] as const)('rejects a %s change at frozen-body admission', async change => {
    const { owner, project, audit } = await fixture()
    const update = prisma.audit.updateMany.bind(prisma.audit)
    let changed = false
    const admission = vi.spyOn(prisma.audit, 'updateMany').mockImplementation(async input => {
      if (!changed && input.data.watchNotificationPayload) {
        changed = true
        if (change === 'preferences') await prisma.project.update({ where: { id: project.id }, data: { notificationLevel: 'OFF' } })
        else if (change === 'recipient') await prisma.user.update({ where: { id: owner.id }, data: { email: `${randomUUID()}@notification.test` } })
        else if (change === 'verification') await prisma.user.update({ where: { id: owner.id }, data: { emailVerified: false } })
        else {
          const replacement = await prisma.user.create({ data: { email: `${randomUUID()}@notification.test` } })
          users.push(replacement.id)
          await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
        }
      }
      return update(input)
    })
    try { await notifyWatchRegression(audit.id) } finally { admission.mockRestore() }
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
    try { await notifyWatchRegression(audit.id) } finally { admission.mockRestore() }
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
    try { await Promise.all([notifyWatchRegression(audit.id), notifyWatchRegression(audit.id)]) }
    finally { release(); admission.mockRestore() }
    expect(claims).toBe(2)
    expect(provider.send).toHaveBeenCalledOnce()
    const failed = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    expect(failed).toMatchObject({ watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1,
      watchNotificationPayload: expect.objectContaining({ to: owner.email }), watchNotificationLeaseUntil: null })
    await prisma.user.update({ where: { id: owner.id }, data: { name: 'Changed display name' } })
    vi.setSystemTime(failed.watchNotificationNextAttemptAt!)
    await notifyWatchRegression(audit.id)
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
    try { await notifyWatchRegression(audit.id) } finally { admission.mockRestore() }
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
    await notifyWatchRegression(audit.id)
    await notifyWatchRegression(audit.id)
    expect(provider.send).not.toHaveBeenCalled()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1, watchNotificationPayload: { version: 999 },
      watchNotificationLeaseUntil: null, watchNotificationProviderId: null })
  })
})
