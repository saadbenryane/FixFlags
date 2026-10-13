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
async function receiptFixture(kind = 'DOWN') {
  const user = await db().user.create({ data: { email: 'alerts@uptime-test.example', role: 'admin', preferredTools: [] } })
  const project = await db().project.create({ data: { userId: user.id, name: 'Example', canonicalHost: 'example.com', url: 'https://example.com/', watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
  const monitor = await db().uptimeMonitor.create({ data: { projectId: project.id, targetUrl: project.url, nextProbeAt: now } })
  const incident = await db().uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: project.url, startedAt: now, confirmedAt: now,
    recoveredAt: kind === 'RECOVERED' ? now : null, reason: 'response_error' } })
  const receipt = await db().uptimeNotification.create({ data: { incidentId: incident.id, kind, nextAttemptAt: now } })
  return { project, monitor, incident, receipt }
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
    expect(fixture.send.mock.calls[0][1]).toEqual({ idempotencyKey: `uptime-${receipt.id}` })
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
    expect(fixture.send.mock.calls[1][1]).toEqual(fixture.send.mock.calls[0][1])
    expect((await db().uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('SENT')
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
