import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { acceptEmailProviderEvent, deferEmailAcceptanceProjection, emailRecipientHash, loadEmailDeliveryHistory, notificationRecipientAllowed, recordEmailAcceptance } from '../delivery-events'
import { emailDeliveryState } from '../delivery-state'
import { FROM_EMAIL } from '../from'
import { maintainEmailDelivery, recoverEmailDeliveryHistory } from '../maintenance'

const run = process.env.NOTIFICATION_DB_REQUIRED === 'true' ? describe : describe.skip
run('provider delivery facts and recovery', () => {
  const users: string[] = [], providers: string[] = [], emails: string[] = []
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname)) throw new Error('Disposable notification database required')
  })
  afterEach(async () => {
    await prisma.emailProviderEvent.deleteMany({ where: { providerId: { in: providers } } })
    await prisma.emailSuppression.deleteMany({ where: { recipientHash: { in: emails.map(emailRecipientHash) } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    users.length = 0; providers.length = 0; emails.length = 0
  })
  afterAll(() => prisma.$disconnect())
  async function fixture() {
    const userId = randomUUID(), providerId = randomUUID(), email = userId + '@notification.test', at = new Date()
    users.push(userId); providers.push(providerId); emails.push(email)
    await prisma.user.create({ data: { id: userId, email, emailVerified: true } })
    return { userId, providerId, email, channel: 'summary' as const, sourceId: randomUUID(), acceptedAt: at }
  }
  async function event(input: Awaited<ReturnType<typeof fixture>>, type: string, at: Date, id = randomUUID(), to = input.email) {
    const payload = JSON.stringify({ type, created_at: at.toISOString(), data: { email_id: input.providerId, from: FROM_EMAIL, to: [to] } })
    await acceptEmailProviderEvent(id, payload, new Date(at.getTime() + 1000))
    return { id, payload }
  }
  async function acceptedUptime() {
    const original = await fixture(), current = await fixture()
    const project = await prisma.project.create({ data: { userId: original.userId, name: 'Historical uptime alert',
      url: 'https://example.com/', canonicalHost: 'example.com' } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url } })
    const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
      startedAt: original.acceptedAt, confirmedAt: original.acceptedAt, reason: 'response_error' } })
    const payload = { ownerId: original.userId, to: original.email, firstAttemptAt: original.acceptedAt.toISOString() }
    const receipt = await prisma.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN', status: 'SENT',
      attempts: 1, providerId: original.providerId, sentAt: original.acceptedAt, deliveryPayload: payload } })
    await prisma.project.update({ where: { id: project.id }, data: { userId: current.userId } })
    return { original, current, receipt, payload }
  }
  async function acceptedSource(input: Awaited<ReturnType<typeof fixture>>, channel: 'summary' | 'watch' | 'uptime' | 'onboarding', invalid = false) {
    const payload = { ownerId: input.userId, to: input.email, firstAttemptAt: invalid ? 'unreadable' : input.acceptedAt.toISOString() }
    const data = { id: input.sourceId, status: 'SENT' as const, attempts: 1, providerId: input.providerId,
      sentAt: input.acceptedAt, nextAttemptAt: input.acceptedAt }
    if (channel === 'summary') {
      await prisma.notificationPreference.create({ data: { userId: input.userId, cadence: 'OFF' } })
      await prisma.notificationDigest.create({ data: { ...data, userId: input.userId, revision: 0, scheduledAt: input.acceptedAt, payload } })
    } else if (channel === 'onboarding') {
      await prisma.emailLog.create({ data: { ...data, userId: input.userId, emailType: 'welcome', payload } })
    } else if (channel === 'watch') {
      await prisma.audit.create({ data: { id: input.sourceId, userId: input.userId, url: 'https://example.com/', status: 'COMPLETED',
        watchNotificationStatus: 'SENT', watchNotificationAttempts: 1, watchNotificationProviderId: input.providerId,
        watchNotifiedAt: input.acceptedAt, watchNotificationNextAttemptAt: input.acceptedAt, watchNotificationPayload: payload } })
    } else {
      const project = await prisma.project.create({ data: { userId: input.userId, name: 'Accepted uptime alert',
        url: 'https://example.com/', canonicalHost: 'example.com' } })
      const monitor = await prisma.uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url } })
      const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url,
        startedAt: input.acceptedAt, confirmedAt: input.acceptedAt, reason: 'response_error' } })
      await prisma.uptimeNotification.create({ data: { ...data, incidentId: incident.id, kind: 'DOWN', deliveryPayload: payload } })
    }
    return {
      async read() {
        if (channel === 'summary') return prisma.notificationDigest.findUniqueOrThrow({ where: { id: input.sourceId } })
        if (channel === 'onboarding') return prisma.emailLog.findUniqueOrThrow({ where: { id: input.sourceId } })
        if (channel === 'uptime') return prisma.uptimeNotification.findUniqueOrThrow({ where: { id: input.sourceId } })
        const source = await prisma.audit.findUniqueOrThrow({ where: { id: input.sourceId } })
        return { status: source.watchNotificationStatus, attempts: source.watchNotificationAttempts,
          providerId: source.watchNotificationProviderId, sentAt: source.watchNotifiedAt,
          nextAttemptAt: source.watchNotificationNextAttemptAt, deliveryProjectedAt: source.watchDeliveryProjectedAt }
      },
      async repairTimestamp() {
        const fixed = { ...payload, firstAttemptAt: input.acceptedAt.toISOString() }
        if (channel === 'summary') await prisma.notificationDigest.update({ where: { id: input.sourceId }, data: { payload: fixed } })
        else if (channel === 'onboarding') await prisma.emailLog.update({ where: { id: input.sourceId }, data: { payload: fixed } })
        else if (channel === 'uptime') await prisma.uptimeNotification.update({ where: { id: input.sourceId }, data: { deliveryPayload: fixed } })
        else await prisma.audit.update({ where: { id: input.sourceId }, data: { watchNotificationPayload: fixed } })
      },
    }
  }
  it('deduplicates events, keeps facts in order and does not downgrade delivery to delayed', async () => {
    const input = await fixture(); await recordEmailAcceptance(input)
    const delivered = await event(input, 'email.delivered', input.acceptedAt)
    await acceptEmailProviderEvent(delivered.id, delivered.payload)
    await acceptEmailProviderEvent(delivered.id, JSON.stringify(JSON.parse(delivered.payload), null, 2))
    await event(input, 'email.delivery_delayed', new Date(input.acceptedAt.getTime() - 1000))
    const receipt = await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } })
    expect(emailDeliveryState(receipt)).toBe('delivered')
    expect(await prisma.emailProviderEvent.count({ where: { providerId: input.providerId } })).toBe(2)
    expect((await loadEmailDeliveryHistory(input.userId))[0].state).toBe('delivered')
    expect(await loadEmailDeliveryHistory('another-owner')).toEqual([])
  })
  it('reconciles an event received before acceptance is recorded, even after an idempotent retry', async () => {
    const input = await fixture(), firstAttemptAt = input.acceptedAt
    await event(input, 'email.delivered', firstAttemptAt)
    await recordEmailAcceptance({ ...input, firstAttemptAt, acceptedAt: new Date(firstAttemptAt.getTime() + 10 * 60_000) })
    expect(emailDeliveryState(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } }))).toBe('delivered')
  })
  it.each(['email.delivered', 'email.bounced', 'email.complained'] as const)('does not revive an expired early %s event when acceptance is recovered', async type => {
    const input = await fixture()
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(input.acceptedAt)
    try {
      const early = await event(input, type, input.acceptedAt)
      const stored = await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: early.id } })
      vi.setSystemTime(stored.expiresAt)
      await recordEmailAcceptance(input)
      const receipt = await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } })
      expect(emailDeliveryState(receipt)).toBe('accepted')
      expect(await notificationRecipientAllowed(input.email)).toBe(true)
      expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: early.id } }))
        .toMatchObject({ processedAt: null, expiresAt: stored.expiresAt })
      await acceptEmailProviderEvent(early.id, early.payload, new Date())
      expect(emailDeliveryState(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } }))).toBe('accepted')
      expect(await notificationRecipientAllowed(input.email)).toBe(true)
      await maintainEmailDelivery(new Date())
      expect(await prisma.emailProviderEvent.findUnique({ where: { id: early.id } })).toBeNull()
    } finally { vi.useRealTimers() }
  })
  it('retains a still-valid early delivery event at the end of its reconciliation window', async () => {
    const input = await fixture()
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(input.acceptedAt)
    try {
      const early = await event(input, 'email.delivered', input.acceptedAt)
      const stored = await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: early.id } })
      vi.setSystemTime(stored.expiresAt.getTime() - 1)
      await recordEmailAcceptance(input)
      expect(emailDeliveryState(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } }))).toBe('delivered')
    } finally { vi.useRealTimers() }
  })
  it.each(['email.bounced', 'email.complained'] as const)('suppresses only the known recipient after %s', async type => {
    const input = await fixture(); await recordEmailAcceptance(input)
    const other = randomUUID() + '@notification.test'; emails.push(other)
    await event(input, type, input.acceptedAt, randomUUID(), other)
    expect(await notificationRecipientAllowed(input.email)).toBe(true)
    expect(await notificationRecipientAllowed(other)).toBe(true)
    await event(input, type, input.acceptedAt)
    expect(await notificationRecipientAllowed(input.email)).toBe(false)
    expect(await notificationRecipientAllowed(other)).toBe(true)
    await event(input, 'email.delivered', new Date(input.acceptedAt.getTime() + 1000))
    expect(emailDeliveryState(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } }))).toBe(type === 'email.bounced' ? 'bounced' : 'complained')
  })
  it('does not collect opens or let an unknown message suppress a recipient', async () => {
    const input = await fixture()
    await event(input, 'email.opened', input.acceptedAt)
    expect(await prisma.emailProviderEvent.count({ where: { providerId: input.providerId } })).toBe(0)
    await event(input, 'email.bounced', input.acceptedAt)
    expect(await notificationRecipientAllowed(input.email)).toBe(true)
  })
  it('refuses a reused provider event identity with changed delivery facts', async () => {
    const input = await fixture(); await recordEmailAcceptance(input)
    const delivered = await event(input, 'email.delivered', input.acceptedAt)
    const changed = { ...JSON.parse(delivered.payload), type: 'email.bounced' }
    await expect(acceptEmailProviderEvent(delivered.id, JSON.stringify(changed))).rejects.toThrow('identity changed')
    expect(await notificationRecipientAllowed(input.email)).toBe(true)
  })
  it('recovers delivery history from a committed source receipt after an interrupted projection', async () => {
    const input = await fixture()
    await prisma.notificationPreference.create({ data: { userId: input.userId, cadence: 'OFF' } })
    await prisma.notificationDigest.create({ data: { id: input.sourceId, userId: input.userId, revision: 0, scheduledAt: input.acceptedAt,
      status: 'SENT', providerId: input.providerId, sentAt: input.acceptedAt,
      payload: { to: input.email, firstAttemptAt: input.acceptedAt.toISOString() } } })
    await event(input, 'email.delivered', input.acceptedAt)
    await maintainEmailDelivery(new Date(input.acceptedAt.getTime() + 1000))
    expect((await loadEmailDeliveryHistory(input.userId))[0].state).toBe('delivered')
  })
  it.each((['summary', 'watch', 'uptime', 'onboarding'] as const).flatMap(channel =>
    (['invalid timestamp', 'receipt identity conflict'] as const).map(failure => ({ channel, failure }))))(
    'does not let an older $channel $failure starve unrelated accepted mail', async ({ channel, failure }) => {
    const older = await fixture(), later = await fixture()
    later.acceptedAt = new Date(older.acceptedAt.getTime() + 1000)
    const source = await acceptedSource(older, channel, failure === 'invalid timestamp')
    await acceptedSource(later, 'summary')
    if (failure === 'receipt identity conflict') await recordEmailAcceptance({ ...later, providerId: older.providerId })
    const now = new Date(later.acceptedAt.getTime() + 1000)
    await recoverEmailDeliveryHistory(now, 1)
    expect(await prisma.emailDelivery.findUnique({ where: { providerId: later.providerId } })).toBeNull()
    await recoverEmailDeliveryHistory(now, 1)
    expect(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: later.providerId } }))
      .toMatchObject({ userId: later.userId, acceptedAt: later.acceptedAt })
    const deferred = await source.read()
    expect(deferred).toMatchObject({ status: 'SENT', attempts: 1, providerId: older.providerId,
      sentAt: older.acceptedAt, deliveryProjectedAt: null })
    expect(deferred.nextAttemptAt!.getTime()).toBeGreaterThan(now.getTime())
    if (failure === 'receipt identity conflict') await prisma.emailDelivery.delete({ where: { providerId: older.providerId } })
    else await source.repairTimestamp()
    await recoverEmailDeliveryHistory(new Date(deferred.nextAttemptAt!.getTime() - 1), 1)
    expect(await prisma.emailDelivery.findUnique({ where: { providerId: older.providerId } })).toBeNull()
    await recoverEmailDeliveryHistory(deferred.nextAttemptAt!, 1)
    expect(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: older.providerId } }))
      .toMatchObject({ userId: older.userId, acceptedAt: older.acceptedAt, firstAttemptAt: older.acceptedAt })
    expect(await source.read())
      .toMatchObject({ status: 'SENT', attempts: 1, deliveryProjectedAt: expect.any(Date) })
  })
  it.each(['summary', 'watch', 'uptime', 'onboarding'] as const)('does not defer completed %s history after a stale recovery read', async channel => {
    const input = await fixture(), source = await acceptedSource(input, channel)
    const now = new Date(input.acceptedAt.getTime() + 1000)
    await recoverEmailDeliveryHistory(now, 1)
    const completed = await source.read()
    expect(completed.deliveryProjectedAt).toEqual(expect.any(Date))
    await deferEmailAcceptanceProjection({ ...input, channel }, new Date(now.getTime() + 300_000))
    expect(await source.read()).toMatchObject({ status: 'SENT', attempts: 1,
      deliveryProjectedAt: completed.deliveryProjectedAt, nextAttemptAt: completed.nextAttemptAt })
  })
  it('continues recovering independent mail when a failed source cannot save its retry clock', async () => {
    const older = await fixture(), later = await fixture()
    later.acceptedAt = new Date(older.acceptedAt.getTime() + 1000)
    await acceptedSource(older, 'summary', true)
    await acceptedSource(later, 'summary')
    const update = prisma.notificationDigest.updateMany.bind(prisma.notificationDigest)
    const unavailable = vi.spyOn(prisma.notificationDigest, 'updateMany').mockImplementation(args => {
      if (args?.where?.id === older.sourceId) throw new Error('Controlled source retry interruption')
      return update(args)
    })
    try { await recoverEmailDeliveryHistory(new Date(later.acceptedAt.getTime() + 1000), 2) }
    finally { unavailable.mockRestore() }
    expect(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: later.providerId } }))
      .toMatchObject({ userId: later.userId, acceptedAt: later.acceptedAt })
    expect(await prisma.notificationDigest.findUniqueOrThrow({ where: { id: older.sourceId } }))
      .toMatchObject({ status: 'SENT', attempts: 1, deliveryProjectedAt: null })
  })
  it.each([
    { status: 'SENDING', attempts: 5, leaseMs: 1, expected: 'sending' },
    { status: 'SENDING', attempts: 5, leaseMs: 0, expected: 'unconfirmed' },
    { status: 'SENDING', attempts: 5, leaseMs: null, expected: 'unconfirmed' },
    { status: 'FAILED', attempts: 5, leaseMs: 1000, expected: 'unconfirmed' },
    { status: 'FAILED', attempts: 4, leaseMs: null, expected: 'sending' },
  ] as const)('reports $status attempt $attempts with lease $leaseMs as $expected', async ({ status, attempts, leaseMs, expected }) => {
    const input = await fixture()
    await prisma.notificationPreference.create({ data: { userId: input.userId, cadence: 'OFF' } })
    await prisma.notificationDigest.create({ data: { id: input.sourceId, userId: input.userId, revision: 0,
      scheduledAt: input.acceptedAt, status, attempts, createdAt: input.acceptedAt,
      leaseUntil: leaseMs === null ? null : new Date(input.acceptedAt.getTime() + leaseMs) } })
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(input.acceptedAt)
    try {
      expect(await loadEmailDeliveryHistory(input.userId)).toEqual([
        { id: input.sourceId, channel: 'summary', state: expected, at: input.acceptedAt.toISOString() },
      ])
    } finally { vi.useRealTimers() }
  })
  it('recovers accepted uptime mail for its frozen owner after Site transfer without resending or reassigning it', async () => {
    const { original, current, receipt, payload } = await acceptedUptime()
    const changedEmail = randomUUID() + '@notification.test'; emails.push(changedEmail)
    await prisma.user.update({ where: { id: original.userId }, data: { email: changedEmail } })
    await event(original, 'email.bounced', original.acceptedAt)
    expect(await notificationRecipientAllowed(original.email)).toBe(true)
    await maintainEmailDelivery(new Date(original.acceptedAt.getTime() + 1000))
    expect(await loadEmailDeliveryHistory(original.userId)).toEqual([
      { id: original.providerId, channel: 'uptime', state: 'bounced', at: original.acceptedAt.toISOString() },
    ])
    expect(await loadEmailDeliveryHistory(current.userId)).toEqual([])
    expect(await notificationRecipientAllowed(original.email)).toBe(false)
    expect(await notificationRecipientAllowed(changedEmail)).toBe(true)
    expect(await notificationRecipientAllowed(current.email)).toBe(true)
    const recovered = await prisma.uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })
    expect(recovered).toMatchObject({ status: 'SENT', attempts: 1, providerId: original.providerId,
      sentAt: original.acceptedAt, deliveryPayload: payload, deliveryProjectedAt: expect.any(Date) })
    await maintainEmailDelivery(new Date(original.acceptedAt.getTime() + 2000))
    expect(await prisma.emailDelivery.count({ where: { providerId: original.providerId } })).toBe(1)
  })
  it.each(['missing', 'erased'] as const)('does not assign historical uptime mail to the current Site owner when its frozen owner is %s', async mode => {
    const { original, current, receipt, payload } = await acceptedUptime()
    if (mode === 'erased') await prisma.user.delete({ where: { id: original.userId } })
    else {
      const unattributed = { to: payload.to, firstAttemptAt: payload.firstAttemptAt }
      await prisma.uptimeNotification.update({ where: { id: receipt.id }, data: { deliveryPayload: unattributed } })
    }
    await maintainEmailDelivery(new Date(original.acceptedAt.getTime() + 1000))
    expect(await loadEmailDeliveryHistory(current.userId)).toEqual([])
    expect(await prisma.emailDelivery.count({ where: { providerId: original.providerId } })).toBe(0)
    expect(await prisma.uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } }))
      .toMatchObject({ status: 'SENT', attempts: 1, deliveryProjectedAt: null })
  })
})
