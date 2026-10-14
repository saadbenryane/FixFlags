import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
  afterAll(async () => { vi.useRealTimers(); await fixture.db?.$disconnect() })
  it('claims delivery once across concurrent sweeps and uses a stable provider key', async () => {
    const { receipt } = await receiptFixture()
    await Promise.all([deliverUptimeNotifications(now), deliverUptimeNotifications(now)])
    await deliverUptimeNotifications(now)
    expect(fixture.send).toHaveBeenCalledOnce()
    expect(fixture.send.mock.calls[0][1]).toEqual(expect.objectContaining({ idempotencyKey: `uptime-${receipt.id}`, signal: expect.any(AbortSignal) }))
    expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('SENT')
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
