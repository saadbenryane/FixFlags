import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac, randomUUID } from 'node:crypto'
vi.mock('@/lib/billing/beta-policy', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/billing/beta-policy')>(), OPEN_BETA_ACCESS: false, hasOpenBetaAccess: () => false,
}))
import type { Prisma, PrismaClient } from '@prisma/client'

const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null, send: vi.fn() }))
vi.mock('@/lib/db', async () => {
  if (!process.env.UPTIME_TEST_DATABASE_URL) return { prisma: {} }
  if (!new URL(process.env.UPTIME_TEST_DATABASE_URL).pathname.includes('uptime_test')) throw new Error('A disposable uptime_test database is required')
  const client = process.env.UPTIME_TEST_CLIENT_PATH ? await import(/* @vite-ignore */ process.env.UPTIME_TEST_CLIENT_PATH) : await import('@prisma/client')
  fixture.db = new client.PrismaClient({ datasourceUrl: process.env.UPTIME_TEST_DATABASE_URL })
  return { prisma: fixture.db }
})
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: fixture.send } } }))
import { deliverUptimeNotifications } from './alerts'
import { executeUptimeProbe } from './service'
import { updateOwnedSiteIdentity } from '@/lib/sites/application/settings-commands'
import { setProjectWatch } from '@/lib/sites/application/monitoring-settings'
import { performAdminExternalAction } from '@/lib/admin/external-actions'
import { resolveAdminTarget } from '@/lib/admin/targets'
import { adminDomainActorForOperation, assertAdminDomainActor } from '@/lib/admin/domain-actor'
import { emailRecipientHash } from '@/lib/email/delivery-events'
import { POST as receiveDelivery } from '@/app/api/webhooks/resend/delivery/route'

const now = new Date('2026-10-12T12:00:00Z')
const db = () => fixture.db!
async function receiptFixture(kind = 'DOWN', label = 'alerts') {
  const user = await db().user.create({ data: { email: label + '@uptime-test.example', emailVerified: true, role: 'admin', preferredTools: [] } })
  const project = await db().project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
  const monitor = await db().uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url, nextProbeAt: now } })
  const incident = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, startedAt: now, confirmedAt: now,
    recoveredAt: kind === 'RECOVERED' ? now : null, reason: 'response_error' } })
  const receipt = await db().uptimeNotification.create({ data: { incidentId: incident.id, kind, nextAttemptAt: now } })
  return { user, project, monitor, incident, receipt }
}
describe.skipIf(!process.env.UPTIME_TEST_DATABASE_URL)('Uptime notification receipts', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
    fixture.send.mockReset().mockResolvedValue({ data: { id: 'provider-receipt' }, error: null })
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
  })
  afterAll(async () => {
    vi.useRealTimers()
    try { await fixture.db?.user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } }) }
    finally { await fixture.db?.$disconnect() }
  })
  it('retains the current incident without sending to an unverified recipient and resumes after verification', async () => {
    const { user, monitor, incident, receipt } = await receiptFixture()
    await db().user.update({ where: { id: user.id }, data: { emailVerified: false } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } }))
      .toMatchObject({ status: 'PENDING', attempts: 0, deliveryPayload: null })
    expect(await db().uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id } })).toMatchObject({ enabled: true, version: 1 })
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } }))
      .toMatchObject({ confirmedAt: now, recoveredAt: null })
    await db().user.update({ where: { id: user.id }, data: { emailVerified: true } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } }))
      .toMatchObject({ status: 'SENT', attempts: 1, providerId: 'provider-receipt' })
  })

  it.each([false, true])('recovers a lost final response by signed delivery (retired target and transferred Site: %s)', async moved => {
    const { user, project, incident, receipt } = await receiptFixture()
    await db().uptimeNotification.update({ where: { id: receipt.id }, data: { maxAttempts: 1 } })
    const providerId = randomUUID(), secret = Buffer.alloc(32, 8)
    vi.stubEnv('RESEND_DELIVERY_WEBHOOK_SECRET', 'whsec_' + secret.toString('base64'))
    let release!: () => void
    const hold = new Promise<void>(resolve => { release = resolve })
    fixture.send.mockImplementationOnce(async () => { await hold; throw new Error('Controlled loss of provider response') })
    const sending = deliverUptimeNotifications(now, 1, receipt.id)
    try {
      await vi.waitFor(() => expect(fixture.send).toHaveBeenCalledOnce())
      const message = fixture.send.mock.calls[0][0]
      const tags = Object.fromEntries(message.tags.map((tag: { name: string; value: string }) => [tag.name, tag.value]))
      expect(tags).toMatchObject({ purpose: 'uptime', notification_id: receipt.id, fixflags_receipt: expect.stringMatching(/^[a-f0-9]{32}$/) })
      const claimed = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
      expect(claimed).toMatchObject({ status: 'SENDING', attempts: 1 })
      const expired = new Date(claimed.leaseUntil!.getTime() + 1000)
      vi.setSystemTime(expired)
      await deliverUptimeNotifications(expired, 1, receipt.id)
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'FAILED' })
      if (moved) {
        await updateOwnedSiteIdentity({ projectId: project.id, userId: user.id }, { origin: 'http://example.com:8080' })
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SKIPPED' })
        const newOwner = await db().user.create({ data: { email: 'new-owner@uptime-test.example', emailVerified: true } })
        await db().project.update({ where: { id: project.id }, data: { userId: newOwner.id } })
      }
      const occurredAt = new Date(now.getTime() + 1000)
      function deliver(id: string, to: string, eventTags: Record<string, string>) {
        const body = JSON.stringify({ type: 'email.delivered', created_at: occurredAt.toISOString(),
          data: { email_id: providerId, from: message.from, to: [to], tags: eventTags, created_at: now.toISOString() } })
        const timestamp = Math.floor(Date.now() / 1000)
        const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${body}`).digest('base64')
        return receiveDelivery(new Request('https://fixflags.example/api/webhooks/resend/delivery', { method: 'POST', body,
          headers: { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': 'v1,' + signature } }))
      }
      expect((await deliver(randomUUID(), 'wrong@uptime-test.example', tags)).status).toBe(200)
      expect((await deliver(randomUUID(), user.email, { ...tags, fixflags_receipt: '0'.repeat(32) })).status).toBe(200)
      expect(await db().emailDelivery.findUnique({ where: { providerId } })).toBeNull()
      const id = randomUUID()
      expect((await deliver(id, user.email, tags)).status).toBe(200)
      expect((await deliver(id, user.email, tags)).status).toBe(200)
      release()
      await sending
      expect(await db().emailDelivery.findUniqueOrThrow({ where: { providerId } })).toMatchObject({
        userId: user.id, channel: 'uptime', sourceId: receipt.id, acceptedAt: now, deliveredAt: occurredAt,
      })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
        incidentId: incident.id, status: 'SENT', sentAt: now, providerId, attempts: 1, deliveryPayload: claimed.deliveryPayload, lastError: null,
      })
      await deliverUptimeNotifications(expired, 1, receipt.id)
      expect(fixture.send).toHaveBeenCalledOnce()
    } finally {
      release()
      await sending
      vi.unstubAllEnvs()
      await db().emailProviderEvent.deleteMany({ where: { providerId } })
    }
  })

  it('prioritizes a new target outage over an overdue receipt from a previous generation', async () => {
    const { monitor, incident, receipt } = await receiptFixture()
    await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { version: 2 } })
    const frozen = { version: 1, saved: 'historical payload' }
    await db().uptimeNotification.update({ where: { id: receipt.id }, data: { status: 'FAILED', attempts: 1,
      deliveryPayload: frozen, nextAttemptAt: new Date(now.getTime() - 60_000) } })
    const current = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 2, targetUrl: monitor.targetUrl,
      startedAt: now, confirmedAt: now, reason: incident.reason,
      notifications: { create: { kind: 'DOWN', nextAttemptAt: now } } }, include: { notifications: true } })

    await deliverUptimeNotifications(now, 1)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: current.notifications[0].id } })).toMatchObject({ status: 'SENT', attempts: 1 })
    await deliverUptimeNotifications(now, 1)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'SKIPPED', attempts: 1, deliveryPayload: frozen,
    })
    expect(fixture.send).toHaveBeenCalledOnce()
  })

  it('retires queued receipts atomically on target edit and retains an admitted provider result', async () => {
    const { user, project, monitor, receipt } = await receiptFixture()
    const prior = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl,
      startedAt: new Date(now.getTime() - 60_000), confirmedAt: new Date(now.getTime() - 60_000), recoveredAt: now, reason: 'response_error',
      notifications: { create: { kind: 'RECOVERED', status: 'FAILED', attempts: 2, deliveryPayload: { version: 1 } } } }, include: { notifications: true } })
    let release!: (result: { data: { id: string }; error: null }) => void
    fixture.send.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const delivery = deliverUptimeNotifications(now, 1, receipt.id)
    try {
      await vi.waitFor(() => expect(fixture.send).toHaveBeenCalledOnce())
      await updateOwnedSiteIdentity({ projectId: project.id, userId: user.id }, { origin: 'http://example.com:8080' })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: prior.notifications[0].id } })).toMatchObject({
        status: 'SKIPPED', attempts: 2, deliveryPayload: { version: 1 },
      })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENDING', attempts: 1 })
    } finally { release?.({ data: { id: 'in-flight-acceptance' }, error: null }); await delivery }
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'SENT', attempts: 1, providerId: 'in-flight-acceptance',
    })
  })

  it.each(['current', 'obsolete', 'sent', 'sending', 'revoked', 'changed', 'transferred', 'unverified'] as const)('only an admitted operator can retry a current failed receipt: %s', async scenario => {
    const { user, monitor, receipt } = await receiptFixture()
    const expiresAt = new Date(now.getTime() + 60_000)
    const session = await db().session.create({ data: { id: randomUUID(), userId: user.id, token: randomUUID(), expiresAt } })
    await db().uptimeNotification.update({ where: { id: receipt.id }, data: { status: 'FAILED', attempts: 8 } })
    const request = { action: 'UPTIME_NOTIFICATION_RETRY' as const, targetId: receipt.id, reason: 'Controlled retry', input: {} }
    const target = await resolveAdminTarget(request, db())
    const operation = await db().adminOperation.create({ data: { ...request, actorId: user.id,
      actorSessionId: session.id, actorAuthenticatedAt: now, targetType: 'UPTIME_NOTIFICATION',
      ownerId: user.id, expectedRevision: target.revision, idempotencyKey: randomUUID(),
      requestHash: 'fixture', intentExpiresAt: expiresAt, status: 'RUNNING', executionToken: randomUUID(), leaseUntil: expiresAt } })
    try {
      if (scenario === 'obsolete') await db().uptimeMonitor.update({ where: { id: monitor.id }, data: { version: 2 } })
      if (scenario === 'revoked') await db().session.delete({ where: { id: session.id } })
      if (scenario === 'unverified') await db().user.update({ where: { id: user.id }, data: { emailVerified: false } })
      if (scenario === 'transferred') {
        const next = await db().user.create({ data: { email: 'new-owner@uptime-test.example', emailVerified: true } })
        await db().project.update({ where: { id: monitor.projectId }, data: { userId: next.id } })
      }
      const before = await db().uptimeNotification.update({ where: { id: receipt.id }, data: {
        status: scenario === 'sent' ? 'SENT' : scenario === 'sending' ? 'SENDING' : 'FAILED', attempts: scenario === 'changed' ? 9 : 8,
        ...(scenario === 'sent' ? { sentAt: now, providerId: 'previous-acceptance' } : {}),
        ...(scenario === 'sending' ? { leaseUntil: expiresAt } : {}),
      } })
      if (scenario === 'current') {
        await expect(assertAdminDomainActor(adminDomainActorForOperation(operation), user.id, monitor.projectId, db()))
          .rejects.toMatchObject({ code: 'ADMIN_DOMAIN_ACTION_DENIED' })
        await expect(performAdminExternalAction(operation, {})).resolves.toMatchObject({ state: 'SENT' })
        expect(fixture.send).toHaveBeenCalledOnce()
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENT', attempts: 9, maxAttempts: 16 })
      } else {
        await expect(performAdminExternalAction(operation, {})).rejects.toMatchObject({ code: scenario === 'revoked' ? 'ADMIN_ACCESS_REVOKED' : 'TARGET_CHANGED' })
        expect(fixture.send).not.toHaveBeenCalled()
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(before)
      }
    } finally { await db().adminOperation.delete({ where: { id: operation.id } }) }
  })
  it.each([false, true])('does not replay an uncertain delivery after provider deduplication expires (legacy: %s)', async legacy => {
    const { receipt } = await receiptFixture()
    fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
    await deliverUptimeNotifications(now)
    const original = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
    if (legacy) {
      const payload = { ...(original.deliveryPayload as Prisma.JsonObject) }; delete payload.firstAttemptAt
      await db().uptimeNotification.update({ where: { id: receipt.id }, data: { deliveryPayload: payload } })
    }
    vi.setSystemTime(new Date(now.getTime() + 25 * 3600_000))
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'FAILED', providerId: null, sentAt: null, lastError: expect.stringContaining('idempotency window'),
    })
  })
  it.each(['legacy-retry', 'old-first-delivery'] as const)('permits a safe %s without renewing a prior attempt', async mode => {
    const { receipt } = await receiptFixture()
    if (mode === 'legacy-retry') {
      fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
      await deliverUptimeNotifications(now)
      const recorded = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
      const payload = { ...(recorded.deliveryPayload as Prisma.JsonObject) }; delete payload.firstAttemptAt
      await db().uptimeNotification.update({ where: { id: receipt.id }, data: { deliveryPayload: payload } })
    }
    vi.setSystemTime(new Date(now.getTime() + (mode === 'legacy-retry' ? 1 : 25) * 3600_000))
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledTimes(mode === 'legacy-retry' ? 2 : 1)
    const result = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
    expect(result).toMatchObject({ status: 'SENT', providerId: 'provider-receipt' })
    expect((result.deliveryPayload as Prisma.JsonObject).firstAttemptAt).toBe(
      mode === 'legacy-retry' ? now.toISOString() : new Date().toISOString())
  })
  it('rechecks provider retention after a slow claim while its lease remains valid', async () => {
    const { receipt } = await receiptFixture()
    fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain provider response' } })
    await deliverUptimeNotifications(now)
    vi.setSystemTime(new Date(now.getTime() + 24 * 3600_000 - 25_000))
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (result.count && input.data.status === 'SENDING') vi.setSystemTime(Date.now() + 10_000)
      return result
    })
    try { await deliverUptimeNotifications(new Date()) } finally { admission.mockRestore() }
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'FAILED', attempts: 2, sentAt: null, lastError: expect.stringContaining('idempotency window') })
  })
  it('claims delivery once across concurrent sweeps and uses a stable provider key', async () => {
    const { receipt } = await receiptFixture()
    await Promise.all([deliverUptimeNotifications(now), deliverUptimeNotifications(now)])
    await deliverUptimeNotifications(now)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(fixture.send.mock.calls[0][1]).toEqual(expect.objectContaining({ idempotencyKey: `uptime-${receipt.id}`, signal: expect.any(AbortSignal) }))
    expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('SENT')
  })
  it.each(['preferences', 'recipient', 'verification'] as const)('rejects a %s change at frozen-body admission', async change => {
    const { user, project, receipt } = await receiptFixture()
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    let changed = false
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      if (!changed && input.data.deliveryPayload) {
        changed = true
        if (change === 'preferences') await db().project.update({ where: { id: project.id }, data: { notificationLevel: 'OFF' } })
        else if (change === 'verification') await db().user.update({ where: { id: user.id }, data: { emailVerified: false } })
        else await db().user.update({ where: { id: user.id }, data: { email: 'changed@uptime-test.example' } })
      }
      return update(input)
    })
    try { await deliverUptimeNotifications(now) } finally { admission.mockRestore() }
    expect(changed).toBe(true)
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'PENDING', attempts: 0, deliveryPayload: null, leaseUntil: null, providerId: null })
  })
  it('honors a bounce recorded after Uptime delivery is claimed', async () => {
    const { user, receipt } = await receiptFixture()
    const recipientHash = emailRecipientHash(user.email)
    const write = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    let claimed = false
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      const result = await write(input)
      if (input.data.status === 'SENDING' && result.count === 1) {
        await db().emailSuppression.create({ data: {
          recipientHash, reason: 'BOUNCED', occurredAt: now, providerId: randomUUID(),
        } })
        claimed = true
      }
      return result
    })
    try {
      await deliverUptimeNotifications(now, 1, receipt.id)
      expect(claimed).toBe(true)
      expect(fixture.send).not.toHaveBeenCalled()
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
        status: 'SKIPPED', attempts: 0, leaseUntil: null, providerId: null, sentAt: null,
      })
    } finally {
      admission.mockRestore()
      await db().emailSuppression.deleteMany({ where: { recipientHash } })
    }
  })
  it('selects verified recipients before limiting a delivery batch', async () => {
    const older = await receiptFixture('DOWN', 'unverified'), later = await receiptFixture('DOWN', 'verified')
    await db().user.update({ where: { id: older.user.id }, data: { emailVerified: false } })
    await db().uptimeNotification.update({ where: { id: older.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 1000) } })
    await deliverUptimeNotifications(now, 1)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(fixture.send.mock.calls[0][0].to).toBe(later.user.email)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: older.receipt.id } }))
      .toMatchObject({ status: 'PENDING', attempts: 0, deliveryPayload: null })
  })

  it('delivers another Site outage while the oldest provider request is still pending', async () => {
    const slow = await receiptFixture('DOWN', 'held-site'), peer = await receiptFixture('DOWN', 'independent-site')
    const past = new Date(now.getTime() - 60_000)
    const earlier = await db().uptimeIncident.create({ data: { monitorId: slow.monitor.id, version: slow.monitor.version,
      targetUrl: slow.monitor.targetUrl, startedAt: past, confirmedAt: past, recoveredAt: past, reason: 'response_error' } })
    const backlog = await db().uptimeNotification.create({ data: { incidentId: earlier.id, kind: 'RECOVERED', nextAttemptAt: new Date(now.getTime() - 1) } })
    await db().uptimeNotification.update({ where: { id: slow.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 2) } })
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    fixture.send.mockImplementation(async message => {
      if (message.to === slow.user.email) await held
      return { data: { id: `accepted-${message.to}` }, error: null }
    })
    const delivery = deliverUptimeNotifications(now, 2)
    try {
      await vi.waitFor(async () => {
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: slow.receipt.id } })).toMatchObject({ status: 'SENDING' })
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: peer.receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
      }, { timeout: 1500 })
    } finally { release(); await delivery }
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: slow.receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: backlog.id } })).toMatchObject({ status: 'PENDING', attempts: 0 })
    await deliverUptimeNotifications(now, 2)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: backlog.id } })).toMatchObject({ status: 'SKIPPED', attempts: 0 })
  })
  it('does not start a provider request after a delayed claim consumes its request window', async () => {
    const { receipt } = await receiptFixture()
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      const result = await update(input)
      if (result.count && input.data.status === 'SENDING') vi.setSystemTime(Date.now() + 45_000)
      return result
    })
    try { await deliverUptimeNotifications(now) } finally { admission.mockRestore() }
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'FAILED', attempts: 1, providerId: null, leaseUntil: null,
      nextAttemptAt: new Date(Date.now() + 5 * 60_000) })
  })
  it('cannot replace a body changed after selection or consume its attempt', async () => {
    const { receipt } = await receiptFixture()
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    let replacement: Prisma.InputJsonObject | undefined
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      if (!replacement && input.data.deliveryPayload) {
        replacement = { ...input.data.deliveryPayload as Prisma.InputJsonObject, subject: 'Another frozen message' }
        await db().uptimeNotification.update({ where: { id: receipt.id }, data: { deliveryPayload: replacement } })
      }
      return update(input)
    })
    try { await deliverUptimeNotifications(now) } finally { admission.mockRestore() }
    expect(replacement).toBeDefined()
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'PENDING', attempts: 0, deliveryPayload: replacement, leaseUntil: null })
  })
  it('retains bounded failed attempts when the recorded payload cannot be validated', async () => {
    const { receipt } = await receiptFixture()
    await db().uptimeNotification.update({ where: { id: receipt.id }, data: { maxAttempts: 1, deliveryPayload: { version: 999 } } })
    await deliverUptimeNotifications(now)
    await deliverUptimeNotifications(new Date(now.getTime() + 5 * 60_000))
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'FAILED', attempts: 1, deliveryPayload: { version: 999 }, leaseUntil: null, providerId: null })
  })
  it('keeps later delivery leases live after earlier provider requests consume the batch clock', async () => {
    const batch = []
    for (let index = 0; index < 5; index++) {
      const item = await receiptFixture('DOWN', 'slow-batch-' + index)
      await db().uptimeNotification.update({ where: { id: item.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 1000 + index) } })
      batch.push(item)
    }
    type Acceptance = { data: { id: string }; error: null }
    let finish!: (response: Acceptance) => void
    fixture.send.mockImplementation(async message => {
      if (message.to === batch[4].user.email) {
        if (finish) return { data: { id: 'overlapping-acceptance' }, error: null }
        return new Promise<Acceptance>(resolve => { finish = resolve })
      }
      vi.setSystemTime(Date.now() + 19_000)
      return { data: { id: 'accepted-' + message.to }, error: null }
    })
    const pending = deliverUptimeNotifications(now, 5)
    try {
      await vi.waitFor(() => expect(fixture.send).toHaveBeenCalledTimes(5))
      const last = batch[4].receipt.id
      await deliverUptimeNotifications(new Date(), 1, last)
      expect(fixture.send).toHaveBeenCalledTimes(5)
      const held = await db().uptimeNotification.findUniqueOrThrow({ where: { id: last } })
      expect(held).toMatchObject({ status: 'SENDING', attempts: 1 })
      expect(held.leaseUntil!.getTime()).toBeGreaterThan(Date.now() + 20_000)
    } finally {
      finish?.({ data: { id: 'final-acceptance' }, error: null })
      await pending
    }
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: batch[4].receipt.id } }))
      .toMatchObject({ status: 'SENT', attempts: 1, providerId: 'final-acceptance', sentAt: new Date() })
  })
  it.each(['revoked', 'expired', 'plan-changed', 'schedule-changed'] as const)('keeps included uptime notifications authorized when an analysis grant is %s before the claim', async phase => {
    const { user, project, receipt } = await receiptFixture()
    await db().user.update({ where: { id: user.id }, data: { role: 'user' } })
    await db().project.update({ where: { id: project.id }, data: { watchInterval: 'DAILY' } })
    const grant = await db().entitlementGrant.create({ data: { userId: user.id, operationId: 'uptime-alert:' + user.id,
      grantedBy: 'local-fixture', allowedWatchIntervals: ['daily'], expiresAt: new Date(now.getTime() + 60_000) } })
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    let changed = false
    const claim = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      if (!changed && input.data.status === 'SENDING') {
        changed = true
        await db().entitlementGrant.update({ where: { id: grant.id }, data: phase === 'revoked' ? { revokedAt: now }
          : phase === 'expired' ? { expiresAt: now } : phase === 'plan-changed' ? { plan: 'FREE', allowedWatchIntervals: [] }
            : { allowedWatchIntervals: ['weekly'] } })
      }
      return update(input)
    })
    try { await deliverUptimeNotifications(now) } finally { claim.mockRestore() }
    expect(changed).toBe(true)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
    await db().entitlementGrant.update({ where: { id: grant.id }, data: { plan: null, allowedWatchIntervals: ['daily'], revokedAt: null,
      expiresAt: new Date(now.getTime() + 60_000) } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
  })
  it('persists failed delivery and retries without changing notification identity', async () => {
    const { receipt } = await receiptFixture()
    fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Provider unavailable' } })
    await deliverUptimeNotifications(now)
    expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('FAILED')
    const later = new Date(now.getTime() + 5 * 60_000)
    await deliverUptimeNotifications(later)
    expect(fixture.send).toHaveBeenCalledTimes(2)
    expect(fixture.send.mock.calls[1][1].idempotencyKey).toEqual(fixture.send.mock.calls[0][1].idempotencyKey)
    expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('SENT')
  })
  it('starts backoff after a slow failure and preserves the frozen body and provider key', async () => {
    const { receipt } = await receiptFixture('DOWN', 'slow-failure')
    fixture.send.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 19_000)
      return { data: null, error: { message: 'Controlled slow provider failure' } }
    })
    await deliverUptimeNotifications(now)
    const failed = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
    const due = new Date(Date.now() + 5 * 60_000)
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 1, nextAttemptAt: due, sentAt: null })
    vi.setSystemTime(due.getTime() - 1)
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledOnce()
    vi.setSystemTime(due)
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledTimes(2)
    expect(fixture.send.mock.calls[1][0]).toEqual(fixture.send.mock.calls[0][0])
    expect(fixture.send.mock.calls[1][1].idempotencyKey).toBe(fixture.send.mock.calls[0][1].idempotencyKey)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'SENT', attempts: 2, sentAt: due, deliveryPayload: failed.deliveryPayload })
  })
  it('defers an interrupted claim from the failure time without consuming an attempt', async () => {
    const { receipt } = await receiptFixture('DOWN', 'slow-deferral')
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const failure = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(args => {
      if (args.where?.id === receipt.id && args.data.status === 'SENDING') {
        vi.setSystemTime(Date.now() + 19_000)
        throw new Error('Controlled delayed claim failure')
      }
      return update(args)
    })
    try {
      await deliverUptimeNotifications(now)
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
        status: 'PENDING', attempts: 0, leaseUntil: null, sentAt: null, nextAttemptAt: new Date(Date.now() + 30_000) })
    } finally { failure.mockRestore() }
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).not.toHaveBeenCalled()
    vi.setSystemTime(Date.now() + 30_000)
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
  })

  it.each(['claim', 'retry-write'] as const)('delivers independent receipts after a %s failure and retains the interrupted delivery', async stage => {
    const first = await receiptFixture('DOWN', 'interrupted')
    const second = await receiptFixture('DOWN', 'independent')
    await db().uptimeNotification.update({ where: { id: first.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 1) } })
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const failure = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(args => {
      if (args.where?.id === first.receipt.id && (stage === 'claim' && args.data.status === 'SENDING' || stage === 'retry-write' && args.data.status === 'FAILED'))
        throw new Error('Controlled notification persistence failure')
      return update(args)
    })
    if (stage === 'retry-write') fixture.send.mockImplementation(async message => message.to === first.user.email &&
      fixture.send.mock.calls.filter(([body]) => body.to === first.user.email).length === 1
      ? { data: null, error: { message: 'Provider unavailable' } } : { data: { id: 'provider-receipt' }, error: null })
    try {
      await deliverUptimeNotifications(now, 2)
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: second.receipt.id } })).toMatchObject({
        status: 'SENT', attempts: 1, providerId: 'provider-receipt' })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: first.receipt.id } })).toMatchObject({
        status: stage === 'claim' ? 'PENDING' : 'SENDING', attempts: stage === 'claim' ? 0 : 1, providerId: null, sentAt: null })
    } finally { failure.mockRestore() }
    await deliverUptimeNotifications(new Date(now.getTime() + 5 * 60_000), 2)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: first.receipt.id } })).toMatchObject({
      status: 'SENT', attempts: stage === 'claim' ? 1 : 2, providerId: 'provider-receipt' })
    const firstCalls = fixture.send.mock.calls.filter(([body]) => body.to === first.user.email)
    expect(firstCalls).toHaveLength(stage === 'claim' ? 1 : 2)
    for (const [, options] of firstCalls) expect(options.idempotencyKey).toBe(`uptime-${first.receipt.id}`)
  })

  it.each([false, true])('continues after failed claim deferral with persistence unavailable=%s', async deferralFails => {
    const first = await receiptFixture('DOWN', 'deferral')
    const second = await receiptFixture('DOWN', 'following')
    await db().uptimeNotification.update({ where: { id: first.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 1) } })
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const failure = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(args => {
      if (args.where?.id === first.receipt.id && (deferralFails || args.data.status === 'SENDING'))
        throw new Error('Controlled claim or deferral failure')
      return update(args)
    })
    try {
      await deliverUptimeNotifications(now, deferralFails ? 2 : 1)
      if (!deferralFails) {
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: first.receipt.id } })).toMatchObject({
          status: 'PENDING', attempts: 0, leaseUntil: null, nextAttemptAt: new Date(now.getTime() + 30_000) })
        await deliverUptimeNotifications(now, 1)
      }
      expect(fixture.send).toHaveBeenCalledOnce()
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: second.receipt.id } })).toMatchObject({ status: 'SENT' })
    } finally { failure.mockRestore() }
  })

  it('retries the recorded body after sender configuration changes', async () => {
    const { receipt } = await receiptFixture()
    try {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://original-app.example')
      vi.stubEnv('RESEND_FROM_EMAIL', 'Original <original@example.test>')
      fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain response' } })
      await deliverUptimeNotifications(now)
      const original = fixture.send.mock.calls[0][0]
      const stored = (await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).deliveryPayload
      expect(stored).not.toBeNull()
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://changed-app.example')
      vi.stubEnv('RESEND_FROM_EMAIL', 'Changed <changed@example.test>')
      await deliverUptimeNotifications(new Date(now.getTime() + 5 * 60_000))
      expect(fixture.send.mock.calls[1][0]).toEqual(original)
      expect(fixture.send.mock.calls[1][1].idempotencyKey).toBe(`uptime-${receipt.id}`)
      expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).deliveryPayload).toEqual(stored)
      expect(Object.keys(original).sort()).toEqual(['from', 'html', 'subject', 'tags', 'text', 'to'])
    } finally { vi.unstubAllEnvs() }
  })

  it('does not reuse a recorded delivery for a changed recipient', async () => {
    const { user, receipt } = await receiptFixture()
    fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain response' } })
    await deliverUptimeNotifications(now)
    await db().user.update({ where: { id: user.id }, data: { email: 'changed@uptime-test.example' } })
    await deliverUptimeNotifications(new Date(now.getTime() + 5 * 60_000))
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'FAILED', attempts: 2, providerId: null, sentAt: null,
      lastError: 'Recorded notification no longer matches its recipient or incident' })
  })

  it.each(['rejection', 'acceptance'] as const)('fences a late expired sender %s even when lease timestamps match', async outcome => {
    const { receipt } = await receiptFixture()
    // Keep this regression on identical lease timestamps. Attempt identity must
    // fence the old sender even when a clock has not advanced between claims.
    const frozenClock = vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    type Response = { data: { id: string } | null; error: { message: string } | null }
    let finishOld!: (response: Response) => void, finishCurrent!: (response: Response) => void
    fixture.send.mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finishCurrent = resolve }))
    const old = deliverUptimeNotifications(now, 1, receipt.id)
    let current: Promise<void> | undefined
    try {
      await vi.waitFor(() => expect(fixture.send).toHaveBeenCalledOnce())
      await db().uptimeNotification.update({ where: { id: receipt.id }, data: { leaseUntil: new Date(0) } })
      current = deliverUptimeNotifications(now, 1, receipt.id)
      await vi.waitFor(() => expect(fixture.send).toHaveBeenCalledTimes(2))
      if (outcome === 'rejection') {
        finishCurrent({ data: { id: 'new-acceptance' }, error: null }); await current
        finishOld({ data: null, error: { message: 'Old rejection' } }); await old
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
          status: 'SENT', attempts: 2, providerId: 'new-acceptance', lastError: null })
      } else {
        finishOld({ data: { id: 'old-acceptance' }, error: null }); await old
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
          status: 'SENDING', attempts: 2, providerId: null, sentAt: null,
          leaseUntil: new Date(now.getTime() + 60_000) })
        finishCurrent({ data: { id: 'new-acceptance' }, error: null }); await current
        expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
          status: 'SENT', attempts: 2, providerId: 'new-acceptance' })
      }
    } finally {
      finishOld?.({ data: null, error: { message: 'Fixture cleanup' } })
      finishCurrent?.({ data: null, error: { message: 'Fixture cleanup' } })
      await Promise.allSettled([old, ...(current ? [current] : [])])
      frozenClock.mockRestore()
    }
  })

  it('terminalizes an expired final attempt without another provider request', async () => {
    const { receipt } = await receiptFixture()
    await db().uptimeNotification.update({ where: { id: receipt.id }, data: { status: 'SENDING', attempts: 8, leaseUntil: new Date(0) } })
    await deliverUptimeNotifications(now)
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'FAILED', attempts: 8, leaseUntil: null, providerId: null,
      lastError: 'Delivery confirmation expired after the final attempt' })
  })

  it.each(['preferences', 'recipient', 'account', 'site', 'target', 'version', 'ceiling', 'owner', 'recovery', 'pause'] as const)(
    'rejects stale batch permission after a %s change', async change => {
      const second = await receiptFixture(change === 'recovery' ? 'RECOVERED' : 'DOWN', 'second')
      const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
      // Change permission after reading the receipt and before its conditional
      // claim. The race is independent of other Sites' delivery order.
      const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementationOnce(async input => {
        expect(input).toMatchObject({ where: { id: second.receipt.id }, data: { status: 'SENDING' } })
        if (change === 'preferences') await db().project.update({ where: { id: second.project.id }, data: { notificationLevel: 'OFF' } })
        if (change === 'pause') await db().project.update({ where: { id: second.project.id }, data: { watchPausedAt: now, watchNextRunAt: null } })
        if (change === 'recipient') await db().user.update({ where: { id: second.user.id }, data: { email: 'changed@uptime-test.example' } })
        if (change === 'account') await db().user.update({ where: { id: second.user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'site') await db().project.update({ where: { id: second.project.id }, data: { deletedAt: now } })
        if (change === 'target') await db().project.update({ where: { id: second.project.id }, data: { url: 'https://changed.example/' } })
        if (change === 'version') await db().uptimeMonitor.update({ where: { id: second.monitor.id }, data: { version: 2 } })
        if (change === 'ceiling') await db().uptimeNotification.update({ where: { id: second.receipt.id }, data: { maxAttempts: 0 } })
        if (change === 'owner') {
          const owner = await db().user.create({ data: { email: 'new-owner@uptime-test.example', role: 'admin' } })
          await db().project.update({ where: { id: second.project.id }, data: { userId: owner.id } })
        }
        if (change === 'recovery') await db().project.update({ where: { id: second.project.id }, data: { notifyOnRecovery: false } })
        return update(input)
      })
      try {
        await deliverUptimeNotifications(now)
        expect(admission).toHaveBeenCalledOnce()
      } finally { admission.mockRestore() }
      expect(fixture.send).not.toHaveBeenCalled()
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: second.receipt.id } })).toMatchObject({
        status: 'PENDING', attempts: 0, leaseUntil: null, deliveryPayload: null, providerId: null })
    })

  it('rechecks an owner pause committed while the alert claim waits on the receipt', async () => {
    const { user, project, incident, receipt } = await receiptFixture()
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      if (input.data.status !== 'SENDING') return update(input)
      let claim: Promise<Prisma.BatchPayload> | undefined
      try {
        await db().$transaction(async tx => {
          const [{ backend }] = await tx.$queryRaw<Array<{ backend: number }>>`
            SELECT pg_backend_pid() AS backend FROM uptime_notifications WHERE id = ${receipt.id} FOR NO KEY UPDATE`
          claim = update(input).then(result => result)
          void claim.catch(() => {})
          await expect.poll(async () => {
            const [{ waiting }] = await tx.$queryRaw<Array<{ waiting: boolean }>>`
              SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${backend} = ANY(pg_blocking_pids(pid))) AS waiting`
            return waiting
          }, { timeout: 2500 }).toBe(true)
          expect(await setProjectWatch({ projectId: project.id, userId: user.id, action: 'pause' }, { tx })).toMatchObject({ ok: true })
        })
        return await claim!
      } finally { await claim?.catch(() => {}) }
    })
    try { await deliverUptimeNotifications(now, 1, receipt.id) } finally { admission.mockRestore() }
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'PENDING', attempts: 0, deliveryPayload: null, leaseUntil: null,
    })
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
  })

  it('does not report acceptance when the provider returns no message receipt', async () => {
    const { receipt } = await receiptFixture()
    fixture.send.mockResolvedValueOnce({ data: {}, error: null })
    await deliverUptimeNotifications(now)
    const recorded = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
    expect(recorded.status).toBe('FAILED')
    expect(recorded.providerId).toBeNull()
    expect(recorded.sentAt).toBeNull()
    expect(recorded.lastError).toBe('Email provider did not confirm acceptance')
  })
  it('rechecks disabled notifications, recovery preferences, pauses, and target versions', async () => {
    const first = await receiptFixture()
    await db().project.update({ where: { id: first.project.id }, data: { notificationLevel: 'OFF' } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
    const second = await receiptFixture('RECOVERED')
    await db().project.update({ where: { id: second.project.id }, data: { notifyOnRecovery: false } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
    const third = await receiptFixture()
    await db().project.update({ where: { id: third.project.id }, data: { watchInterval: null, watchNextRunAt: null } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
    const fourth = await receiptFixture()
    await db().uptimeMonitor.update({ where: { id: fourth.monitor.id }, data: { version: 2 } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
    await db().user.deleteMany({ where: { email: { endsWith: '@uptime-test.example' } } })
    const fifth = await receiptFixture()
    await db().project.update({ where: { id: fifth.project.id }, data: { url: 'https://new-target.example/' } })
    await deliverUptimeNotifications(now)
    expect(fixture.send).not.toHaveBeenCalled()
  })
  it.each([false, true])('retires an obsolete outage message after recovery without changing its retained body (retried: %s)', async retried => {
    const { incident, monitor, receipt } = await receiptFixture('DOWN', 'recovered-before-delivery')
    if (retried) {
      fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Controlled delivery interruption' } })
      await deliverUptimeNotifications(now)
      fixture.send.mockClear()
    }
    const before = await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
    const recoveredAt = new Date(now.getTime() + 60_000)
    vi.setSystemTime(recoveredAt)
    await executeUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: now.toISOString(), attempt: 1 }, async () => ({
      result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 25, finalUrl: monitor.targetUrl,
    }))
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({
      status: 'SKIPPED', attempts: before.attempts, deliveryPayload: before.deliveryPayload,
    })
    const recovery = await db().uptimeNotification.update({ where: { incidentId_kind: { incidentId: incident.id, kind: 'RECOVERED' } },
      data: { nextAttemptAt: recoveredAt } })
    await deliverUptimeNotifications(recoveredAt)
    expect(fixture.send).toHaveBeenCalledTimes(1)
    expect(fixture.send.mock.calls[0][0].subject).toBe('example.com is responding again')
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SKIPPED',
      attempts: before.attempts, deliveryPayload: before.deliveryPayload, sentAt: null, providerId: null })
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: recovery.id } })).toMatchObject({ status: 'SENT' })
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ confirmedAt: now, recoveredAt })
  })
  it('keeps a recovery behind its live outage delivery while another Site can send', async () => {
    const { incident, monitor, receipt } = await receiptFixture('DOWN', 'live-outage-delivery')
    type Acceptance = { data: { id: string }; error: null }
    let release!: (result: Acceptance) => void
    fixture.send.mockImplementationOnce(() => new Promise<Acceptance>(resolve => { release = resolve }))
      .mockResolvedValueOnce({ data: { id: 'other-site-acceptance' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'recovery-acceptance' }, error: null })
    const outage = deliverUptimeNotifications(now, 1, receipt.id)
    try {
      await vi.waitFor(() => expect(fixture.send).toHaveBeenCalledOnce())
      const recoveredAt = new Date(now.getTime() + 1000)
      vi.setSystemTime(recoveredAt)
      await executeUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: now.toISOString(), attempt: 1 }, async () => ({
        result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 25, finalUrl: monitor.targetUrl,
      }))
      const recovery = await db().uptimeNotification.update({ where: { incidentId_kind: { incidentId: incident.id, kind: 'RECOVERED' } },
        data: { nextAttemptAt: now } })
      const other = await receiptFixture('DOWN', 'independent-while-recovering')
      await db().uptimeNotification.update({ where: { id: other.receipt.id }, data: { nextAttemptAt: recoveredAt } })
      await deliverUptimeNotifications(recoveredAt, 1)
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENDING', attempts: 1 })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: recovery.id } })).toMatchObject({ status: 'PENDING', attempts: 0 })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: other.receipt.id } })).toMatchObject({
        status: 'SENT', providerId: 'other-site-acceptance',
      })
      release({ data: { id: 'outage-acceptance' }, error: null })
      await outage
      await deliverUptimeNotifications(recoveredAt, 1, recovery.id)
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENT', providerId: 'outage-acceptance' })
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: recovery.id } })).toMatchObject({
        status: 'SENT', attempts: 1, providerId: 'recovery-acceptance',
      })
    } finally {
      release?.({ data: { id: 'outage-acceptance' }, error: null })
      await outage
    }
  })
  it('rechecks an outage lease at the recovery claim and proceeds when it expires', async () => {
    const { incident, receipt } = await receiptFixture('RECOVERED', 'outage-lease-at-recovery-claim')
    const outage = await db().uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN', nextAttemptAt: now } })
    const leaseUntil = new Date(now.getTime() + 60_000)
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const claim = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      if (input.where?.id === receipt.id && input.data.status === 'SENDING') {
        await db().uptimeNotification.update({ where: { id: outage.id }, data: { status: 'SENDING', attempts: 1, leaseUntil } })
      }
      return update(input)
    })
    try { await deliverUptimeNotifications(now, 1, receipt.id) } finally { claim.mockRestore() }
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'PENDING', attempts: 0 })
    vi.setSystemTime(leaseUntil.getTime() + 1)
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: outage.id } })).toMatchObject({ status: 'SKIPPED', attempts: 1 })
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
  })
  it('retires a delayed recovery after a newer confirmed outage while retaining both incidents', async () => {
    const { incident, monitor, receipt } = await receiptFixture('RECOVERED', 'recurrence-before-delivery')
    const recurrenceAt = new Date(now.getTime() + 60_000)
    vi.setSystemTime(recurrenceAt)
    const recurrence = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl,
      startedAt: recurrenceAt, confirmedAt: recurrenceAt, reason: 'response_error' } })
    const down = await db().uptimeNotification.create({ data: { incidentId: recurrence.id, kind: 'DOWN', nextAttemptAt: recurrenceAt } })
    await deliverUptimeNotifications(recurrenceAt)
    expect(fixture.send).toHaveBeenCalledTimes(1)
    expect(fixture.send.mock.calls[0][0].subject).toBe('example.com is not responding')
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SKIPPED', attempts: 0 })
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: down.id } })).toMatchObject({ status: 'SENT' })
    expect(await db().uptimeIncident.count({ where: { monitorId: monitor.id } })).toBe(2)
    expect(await db().uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: now })
  })
  it('fences a recurrence committed between recovery selection and delivery admission', async () => {
    const { monitor, receipt } = await receiptFixture('RECOVERED', 'recurrence-at-claim')
    const original = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    let changed = false
    const admission = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(async input => {
      if (!changed && input.where?.id === receipt.id && input.data.status === 'SENDING') {
        changed = true
        const at = new Date(now.getTime() + 1)
        await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl,
          startedAt: at, confirmedAt: at, reason: 'response_error' } })
      }
      return original(input)
    })
    try { await deliverUptimeNotifications(now) } finally { admission.mockRestore() }
    expect(changed).toBe(true)
    expect(fixture.send).not.toHaveBeenCalled()
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'PENDING', attempts: 0, deliveryPayload: null })
    await deliverUptimeNotifications(now)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ status: 'SKIPPED', attempts: 0 })
  })
})
