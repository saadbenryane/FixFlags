import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { acceptEmailProviderEvent, deferEmailAcceptanceProjection, EMAIL_DELIVERY_RETENTION_MS, emailRecipientHash, loadEmailDeliveryHistory, notificationRecipientAllowed, recordEmailAcceptance } from '../delivery-events'
import { emailDeliveryState } from '../delivery-state'
import { FROM_EMAIL } from '../from'
import { maintainEmailDelivery, recoverEmailDeliveryHistory } from '../maintenance'

const run = process.env.NOTIFICATION_DB_REQUIRED === 'true' ? describe : describe.skip
run('provider delivery facts and recovery', () => {
  const users: string[] = [], providers: string[] = [], emails: string[] = [], eventIds: string[] = []
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname)) throw new Error('Disposable notification database required')
  })
  afterEach(async () => {
    await prisma.emailProviderEvent.deleteMany({ where: { OR: [{ providerId: { in: providers } }, { id: { in: eventIds } }] } })
    await prisma.emailSuppression.deleteMany({ where: { recipientHash: { in: emails.map(emailRecipientHash) } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    users.length = 0; providers.length = 0; emails.length = 0; eventIds.length = 0
  })
  afterAll(() => prisma.$disconnect())
  async function fixture() {
    const userId = randomUUID(), providerId = randomUUID(), email = userId + '@notification.test', at = new Date()
    users.push(userId); providers.push(providerId); emails.push(email)
    await prisma.user.create({ data: { id: userId, email, emailVerified: true } })
    return { userId, providerId, email, channel: 'summary' as const, sourceId: randomUUID(), acceptedAt: at }
  }
  async function event(input: Awaited<ReturnType<typeof fixture>>, type: string, at: Date, id = randomUUID(), to = input.email) {
    eventIds.push(id)
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

  it('shows current Watch and uptime attempts until acceptance and keeps their history private after transfer', async () => {
    const input = await fixture(), other = await fixture()
    const at = input.acceptedAt
    const site = await prisma.project.create({ data: { userId: input.userId, name: 'Delivery history fixture',
      url: 'https://example.com/', canonicalHost: 'example.com' } })
    const watch = await prisma.audit.create({ data: { userId: input.userId, projectId: site.id, url: site.url,
      status: 'COMPLETED', recheckTrigger: 'WATCH', completedAt: at, improvementProjectedAt: at,
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 6, watchNotificationAttemptCeiling: 6,
      watchNotificationPayload: { to: input.email, receiptOwnerId: input.userId } } })
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId: site.id, targetUrl: site.url } })
    const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, targetUrl: site.url, version: monitor.version,
      startedAt: at, confirmedAt: at, reason: 'response_error' } })
    const alert = await prisma.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'DOWN', createdAt: at,
      status: 'SENDING', attempts: 8, maxAttempts: 8, leaseUntil: new Date(at.getTime() + 60_000),
      deliveryPayload: { ownerId: input.userId, to: input.email } } })
    const read = () => loadEmailDeliveryHistory(input.userId)
    expect(await read()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: watch.id, channel: 'watch', state: 'unconfirmed' }),
      expect.objectContaining({ id: alert.id, channel: 'uptime', state: 'sending' }),
    ]))
    await prisma.audit.update({ where: { id: watch.id }, data: { improvementProjectedAt: null } })
    expect((await read()).some(item => item.id === watch.id)).toBe(false)
    await prisma.audit.update({ where: { id: watch.id }, data: { improvementProjectedAt: at } })
    await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { leaseUntil: new Date(at.getTime() - 1000) } })
    expect((await read()).find(item => item.id === alert.id)?.state).toBe('unconfirmed')
    await prisma.uptimeNotification.update({ where: { id: alert.id }, data: { status: 'SENT', providerId: input.providerId, sentAt: at } })
    await recordEmailAcceptance({ ...input, channel: 'uptime', sourceId: alert.id })
    await event(input, 'email.delivered', at)
    expect((await read()).filter(item => item.channel === 'uptime')).toEqual([
      { id: input.providerId, channel: 'uptime', at: at.toISOString(), state: 'delivered' },
    ])
    await prisma.project.update({ where: { id: site.id }, data: { userId: other.userId } })
    expect(await loadEmailDeliveryHistory(other.userId)).toEqual([])
    expect(await read()).toMatchObject([{ id: input.providerId, channel: 'uptime', state: 'delivered' }])
    await prisma.audit.delete({ where: { id: watch.id } })
    await prisma.project.delete({ where: { id: site.id } })
  })

  it.each([false, true])('keeps accepted Watch history bound to its frozen owner (erased: %s)', async erased => {
    const original = await fixture(), current = await fixture()
    await acceptedSource(original, 'watch')
    await prisma.audit.update({ where: { id: original.sourceId }, data: { userId: current.userId,
      watchNotificationPayload: { receiptOwnerId: original.userId, to: original.email, firstAttemptAt: original.acceptedAt.toISOString() } } })
    if (erased) await prisma.user.delete({ where: { id: original.userId } })
    expect(await loadEmailDeliveryHistory(current.userId)).toEqual([])
    expect(await loadEmailDeliveryHistory(original.userId)).toEqual(erased ? [] : [
      { id: original.providerId, channel: 'watch', state: 'accepted', at: original.acceptedAt.toISOString() },
    ])
    await recoverEmailDeliveryHistory()
    const receipt = await prisma.emailDelivery.findUnique({ where: { providerId: original.providerId } })
    if (erased) expect(receipt).toBeNull()
    else expect(receipt).toMatchObject({ userId: original.userId, channel: 'watch', sourceId: original.sourceId })
    expect(await loadEmailDeliveryHistory(current.userId)).toEqual([])
    await prisma.audit.delete({ where: { id: original.sourceId } })
  })

  it.each([false, true])('defers a locked receipt without blocking another message (owner erased: %s)', async eraseOwner => {
    const input = await fixture(), independent = await fixture()
    await recordEmailAcceptance(input)
    await recordEmailAcceptance(independent)
    let release!: () => void, acquired!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { acquired = resolve })
    const transaction = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "providerId" FROM email_deliveries WHERE "providerId" = ${input.providerId} FOR UPDATE`
      acquired()
      await released
      if (eraseOwner) await tx.user.delete({ where: { id: input.userId } })
    }, { timeout: 15_000 })
    let pending: Awaited<ReturnType<typeof event>> | undefined
    let delivery: ReturnType<typeof event> | undefined
    const at = new Date(Math.max(input.acceptedAt.getTime(), independent.acceptedAt.getTime()) + 1000)
    try {
      await Promise.race([locked, transaction])
      delivery = event(input, 'email.bounced', at)
      void delivery.then(result => { pending = result }, () => undefined)
      await event(independent, 'email.bounced', at)
      await vi.waitFor(() => expect(pending).toBeDefined(), { timeout: 3000 })
      expect(await notificationRecipientAllowed(input.email)).toBe(true)
      expect(await notificationRecipientAllowed(independent.email)).toBe(false)
      expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: pending!.id } })).toMatchObject({ processedAt: null })
    } finally {
      release()
      await transaction
      await delivery
    }
    await maintainEmailDelivery(new Date(at.getTime() + 2000))
    const reconciled = await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: pending!.id } })
    expect(reconciled.processedAt).toEqual(eraseOwner ? null : new Date(at.getTime() + 2000))
    expect(await notificationRecipientAllowed(input.email)).toBe(eraseOwner)
    await acceptEmailProviderEvent(pending!.id, pending!.payload, new Date(at.getTime() + 3000))
    expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: pending!.id } }))
      .toMatchObject({ processedAt: reconciled.processedAt, expiresAt: reconciled.expiresAt })
  }, 20_000)

  it('gives a bounded maintenance pass to eligible mail behind a locked older receipt', async () => {
    const older = await fixture(), following = await fixture()
    const at = new Date(Math.max(older.acceptedAt.getTime(), following.acceptedAt.getTime()) + 1000)
    const earlier = await event(older, 'email.bounced', at)
    const later = await event(following, 'email.delivered', at)
    await prisma.emailProviderEvent.update({ where: { id: earlier.id }, data: { receivedAt: new Date(at.getTime() - 2000) } })
    await prisma.emailDelivery.createMany({ data: [older, following].map(({ email, ...source }) => ({
      ...source, firstAttemptAt: source.acceptedAt, recipientHash: emailRecipientHash(email),
    })) })
    let release!: () => void, acquired!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { acquired = resolve })
    const transaction = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "providerId" FROM email_deliveries WHERE "providerId" = ${older.providerId} FOR UPDATE`
      acquired()
      await released
    }, { timeout: 15_000 })
    const now = new Date(at.getTime() + 2000)
    try {
      await Promise.race([locked, transaction])
      await maintainEmailDelivery(now, 1)
      expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: earlier.id } })).toMatchObject({ processedAt: null })
      expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: later.id } })).toMatchObject({ processedAt: now })
      expect(await notificationRecipientAllowed(older.email)).toBe(true)
      expect((await loadEmailDeliveryHistory(following.userId))[0].state).toBe('delivered')
    } finally { release(); await transaction }
    await maintainEmailDelivery(now, 1)
    expect(await notificationRecipientAllowed(older.email)).toBe(false)
  }, 20_000)

  it('bounds expiration cleanup, skips locked rows and preserves each retention boundary', async () => {
    const input = await fixture(), now = new Date(), cutoff = now.getTime() - EMAIL_DELIVERY_RETENTION_MS
    const recipientHash = emailRecipientHash(input.email)
    const history = Array.from({ length: 503 }, (_, index) => {
      const providerId = randomUUID(), acceptedAt = new Date(cutoff - 502 + index)
      return { providerId, userId: input.userId, recipientHash, channel: input.channel, sourceId: randomUUID(),
        acceptedAt, firstAttemptAt: acceptedAt }
    })
    providers.push(...history.map(row => row.providerId))
    const events = history.map((row, index) => ({ id: randomUUID(), providerId: row.providerId, type: 'email.delivered',
      bodyHash: 'retention-fixture', recipientHashes: [recipientHash], occurredAt: row.acceptedAt,
      expiresAt: new Date(now.getTime() - 502 + index), processedAt: row.acceptedAt }))
    const fresh = { ...events[502], id: randomUUID(), expiresAt: new Date(now.getTime() + 1) }
    await prisma.emailDelivery.createMany({ data: history })
    await prisma.emailProviderEvent.createMany({ data: [...events, fresh] })
    let release!: () => void, acquired!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { acquired = resolve })
    const transaction = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "providerId" FROM email_deliveries WHERE "providerId" = ${history[0].providerId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM email_provider_events WHERE id = ${events[0].id} FOR UPDATE`
      acquired()
      await released
    }, { timeout: 15_000 })
    const remainingEvents = () => prisma.emailProviderEvent.findMany({ where: { providerId: { in: providers } },
      orderBy: { expiresAt: 'asc' }, select: { id: true } })
    const remainingHistory = () => prisma.emailDelivery.findMany({ where: { userId: input.userId },
      orderBy: { acceptedAt: 'asc' }, select: { providerId: true } })
    try {
      await Promise.race([locked, transaction])
      await maintainEmailDelivery(now)
      expect(await remainingEvents()).toEqual([events[0], events[501], events[502], fresh].map(row => ({ id: row.id })))
      expect(await remainingHistory()).toEqual([history[0], history[501], history[502]].map(row => ({ providerId: row.providerId })))
      await maintainEmailDelivery(now)
      expect(await remainingEvents()).toEqual([events[0], fresh].map(row => ({ id: row.id })))
      expect(await remainingHistory()).toEqual([history[0], history[502]].map(row => ({ providerId: row.providerId })))
    } finally { release(); await transaction }
    await maintainEmailDelivery(now)
    expect(await remainingEvents()).toEqual([{ id: fresh.id }])
    expect(await remainingHistory()).toEqual([{ providerId: history[502].providerId }])
  }, 20_000)

  it('does not authorize a fresh bounce from an expired receipt awaiting cleanup', async () => {
    const input = await fixture(), at = input.acceptedAt
    await recordEmailAcceptance({ ...input, acceptedAt: new Date(at.getTime() - EMAIL_DELIVERY_RETENTION_MS - 1) })
    const bounced = await event(input, 'email.bounced', at)
    expect(await prisma.emailDelivery.findUnique({ where: { providerId: input.providerId } })).not.toBeNull()
    expect(await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: bounced.id } })).toMatchObject({ processedAt: null })
    expect(await notificationRecipientAllowed(input.email)).toBe(true)
    await maintainEmailDelivery(new Date(at.getTime() + 2000))
    expect(await prisma.emailDelivery.findUnique({ where: { providerId: input.providerId } })).toBeNull()
    expect(await notificationRecipientAllowed(input.email)).toBe(true)
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
      const discarded = await prisma.emailProviderEvent.findUniqueOrThrow({ where: { id: early.id } })
      expect(discarded).toMatchObject({ discardedAt: new Date(), processedAt: null, providerId: '', type: '', recipientHashes: [],
        bodyHash: stored.bodyHash, expiresAt: new Date(input.acceptedAt.getTime() + EMAIL_DELIVERY_RETENTION_MS) })
      await acceptEmailProviderEvent(early.id, early.payload, new Date())
      expect(await prisma.emailProviderEvent.findUnique({ where: { id: early.id } })).toEqual(discarded)
      expect(emailDeliveryState(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } }))).toBe('accepted')
      expect(await notificationRecipientAllowed(input.email)).toBe(true)
      vi.setSystemTime(discarded.expiresAt)
      await maintainEmailDelivery(new Date())
      expect(await prisma.emailProviderEvent.findUnique({ where: { id: early.id } })).toBeNull()
      await acceptEmailProviderEvent(early.id, early.payload, new Date())
      expect(await prisma.emailProviderEvent.findUnique({ where: { id: early.id } })).toBeNull()
      expect(await notificationRecipientAllowed(input.email)).toBe(true)
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

  it('correlates a first webhook arriving more than a day after the event', async () => {
    const input = await fixture(), id = randomUUID()
    await recordEmailAcceptance(input)
    const payload = JSON.stringify({ type: 'email.delivered', created_at: input.acceptedAt.toISOString(),
      data: { email_id: input.providerId, from: FROM_EMAIL, to: [input.email] } })
    await acceptEmailProviderEvent(id, payload, new Date(input.acceptedAt.getTime() + 30 * 60 * 60_000))
    expect(emailDeliveryState(await prisma.emailDelivery.findUniqueOrThrow({ where: { providerId: input.providerId } }))).toBe('delivered')
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
  it.each(['summary', 'watch', 'uptime', 'onboarding'] as const)('shows saved %s acceptance through an interrupted history projection', async channel => {
    const input = await fixture(), unrelated = await fixture()
    await acceptedSource(input, channel)
    const due = new Date(input.acceptedAt.getTime() + 60_000)
    await deferEmailAcceptanceProjection({ ...input, channel }, due)
    await event(input, 'email.delivered', input.acceptedAt)
    const row = { id: input.providerId, channel, at: input.acceptedAt.toISOString() }
    expect(await loadEmailDeliveryHistory(input.userId)).toEqual([{ ...row, state: 'accepted' }])
    expect(await loadEmailDeliveryHistory(unrelated.userId)).toEqual([])
    await maintainEmailDelivery(new Date(due.getTime() - 1))
    expect(await prisma.emailDelivery.findUnique({ where: { providerId: input.providerId } })).toBeNull()
    await maintainEmailDelivery(due)
    expect(await loadEmailDeliveryHistory(input.userId)).toEqual([{ ...row, state: 'delivered' }])
  })
  it.each((['summary', 'watch', 'uptime', 'onboarding'] as const).flatMap(channel =>
    (['invalid timestamp', 'receipt identity conflict'] as const).map(failure => ({ channel, failure }))))(
    'does not let an older $channel $failure starve unrelated accepted mail', async ({ channel, failure }) => {
    const older = await fixture(), later = await fixture()
    later.acceptedAt = new Date(older.acceptedAt.getTime() + 1000)
    const source = await acceptedSource(older, channel, failure === 'invalid timestamp')
    await acceptedSource(later, 'summary')
    if (failure === 'receipt identity conflict') {
      await recordEmailAcceptance({ ...later, providerId: older.providerId })
      expect(await loadEmailDeliveryHistory(older.userId)).toEqual([])
    }
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
    expect(await loadEmailDeliveryHistory(original.userId)).toEqual([
      { id: original.providerId, channel: 'uptime', state: 'accepted', at: original.acceptedAt.toISOString() },
    ])
    expect(await loadEmailDeliveryHistory(current.userId)).toEqual([])
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
