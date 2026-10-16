import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/billing/beta-policy', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/billing/beta-policy')>(), OPEN_BETA_ACCESS: false, hasOpenBetaAccess: () => false,
}))
import type { PrismaClient } from '@prisma/client'

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

const now = new Date('2026-10-12T12:00:00Z')
const db = () => fixture.db!
async function receiptFixture(kind = 'DOWN', label = 'alerts') {
  const user = await db().user.create({ data: { email: label + '@uptime-test.example', role: 'admin', preferredTools: [] } })
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
  it('claims delivery once across concurrent sweeps and uses a stable provider key', async () => {
    const { receipt } = await receiptFixture()
    await Promise.all([deliverUptimeNotifications(now), deliverUptimeNotifications(now)])
    await deliverUptimeNotifications(now)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(fixture.send.mock.calls[0][1]).toEqual(expect.objectContaining({ idempotencyKey: `uptime-${receipt.id}`, signal: expect.any(AbortSignal) }))
    expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('SENT')
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
    fixture.send.mockImplementation(async () => {
      const call = fixture.send.mock.calls.length
      if (call <= 4) {
        vi.setSystemTime(Date.now() + 19_000)
        return { data: { id: 'accepted-' + call }, error: null }
      }
      if (call === 5) return new Promise<Acceptance>(resolve => { finish = resolve })
      return { data: { id: 'overlapping-acceptance' }, error: null }
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
  it('defers an interrupted later claim from the failure time without consuming an attempt', async () => {
    const first = await receiptFixture('DOWN', 'slow-before-deferral')
    const second = await receiptFixture('DOWN', 'slow-deferral')
    await db().uptimeNotification.update({ where: { id: first.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 1) } })
    fixture.send.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 19_000)
      return { data: { id: 'first-acceptance' }, error: null }
    })
    const update = db().uptimeNotification.updateMany.bind(db().uptimeNotification)
    const failure = vi.spyOn(db().uptimeNotification, 'updateMany').mockImplementation(args => {
      if (args.where?.id === second.receipt.id && args.data.status === 'SENDING') throw new Error('Controlled delayed claim failure')
      return update(args)
    })
    try {
      await deliverUptimeNotifications(now, 2)
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: second.receipt.id } })).toMatchObject({
        status: 'PENDING', attempts: 0, leaseUntil: null, sentAt: null, nextAttemptAt: new Date(Date.now() + 30_000) })
    } finally { failure.mockRestore() }
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledOnce()
    vi.setSystemTime(Date.now() + 30_000)
    await deliverUptimeNotifications(new Date())
    expect(fixture.send).toHaveBeenCalledTimes(2)
    expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: second.receipt.id } })).toMatchObject({ status: 'SENT', attempts: 1 })
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
    if (stage === 'retry-write') fixture.send.mockResolvedValueOnce({ data: null, error: { message: 'Provider unavailable' } })
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

  it.each(['preferences', 'recipient', 'account', 'site', 'target', 'version', 'ceiling', 'owner', 'recovery'] as const)(
    'rejects stale batch permission after a %s change', async change => {
      const first = await receiptFixture('DOWN', 'first')
      const second = await receiptFixture(change === 'recovery' ? 'RECOVERED' : 'DOWN', 'second')
      await db().uptimeNotification.update({ where: { id: first.receipt.id }, data: { nextAttemptAt: new Date(now.getTime() - 1) } })
      // The batch has already loaded both recipients when its first send changes
      // the second one's permission. The database claim must reject that snapshot.
      fixture.send.mockImplementationOnce(async () => {
        if (change === 'preferences') await db().project.update({ where: { id: second.project.id }, data: { notificationLevel: 'OFF' } })
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
        return { data: { id: 'first-acceptance' }, error: null }
      })
      await deliverUptimeNotifications(now)
      expect(fixture.send).toHaveBeenCalledOnce()
      expect(await db().uptimeNotification.findUniqueOrThrow({ where: { id: second.receipt.id } })).toMatchObject({
        status: 'PENDING', attempts: 0, leaseUntil: null, deliveryPayload: null, providerId: null })
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
})
