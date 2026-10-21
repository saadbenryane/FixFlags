import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteHome } from '../queries'
import { siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site Watch delivery projection with migrated PostgreSQL', () => {
  let userId: string, projectId: string
  const url = 'https://example.com/'
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  beforeEach(async () => {
    userId = 'watch-view-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', preferredTools: [] } })
    projectId = (await prisma.project.create({ data: { userId, name: 'Watch projection fixture', url, canonicalHost: 'example.com' } })).id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })
  afterAll(() => prisma.$disconnect())

  it('does not expose owned or unscoped Watch alerts to a provisional Site', async () => {
    const foreignAlert = await prisma.audit.create({ data: { url, userId, status: 'COMPLETED',
      recheckTrigger: 'WATCH', completedAt: new Date(), watchNotificationStatus: 'FAILED',
      watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
    const anonymous = await prisma.audit.create({ data: { url, status: 'COMPLETED', completedAt: new Date() } })
    const provisional = await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(),
      canonicalHost: 'example.com', url, primaryAuditId: anonymous.id } })
    try {
      await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED',
        recheckTrigger: 'WATCH', completedAt: new Date(), watchNotificationStatus: 'FAILED',
        watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
      const home = await loadSiteHome(`p_${provisional.id}`)
      expect(home).not.toBeNull()
      expect(home?.watch.alert).toMatchObject({ state: 'none', status: null, attempts: 0, at: null })
    } finally {
      await prisma.provisionalSite.delete({ where: { id: provisional.id } })
      await prisma.audit.deleteMany({ where: { id: { in: [anonymous.id, foreignAlert.id] } } })
    }
  })

  it('does not let delivery activity on an older alert hide a newer undelivered alert', async () => {
    const older = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      completedAt: new Date('2026-09-01T12:00:00Z'), updatedAt: new Date('2026-10-10T12:00:00Z'),
      watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationAttemptCeiling: 5 } })
    const latest = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH',
      completedAt: new Date('2026-09-02T12:00:00Z'), updatedAt: new Date('2026-10-09T12:00:00Z'),
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 5, watchNotificationAttemptCeiling: 5 } })
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'undelivered', status: 'FAILED', attempts: 5,
      at: latest.updatedAt.toISOString() })
    await prisma.audit.update({ where: { id: older.id }, data: { watchNotificationAttempts: 3 } })
    expect((await loadSiteHome(projectId))?.watch.alert).toMatchObject({ state: 'undelivered', status: 'FAILED', attempts: 5 })
    await prisma.audit.update({ where: { id: latest.id }, data: { watchNotificationStatus: 'SENT' } })
    const accepted = await loadSiteHome(projectId)
    expect(accepted?.watch.alert.state).toBe('accepted')
    expect(siteWatchAlertNotice(accepted!.watch.alert)).toBeNull()
  })

  it('uses the projected saved attempt ceiling in the customer notice', async () => {
    const alert = await prisma.audit.create({ data: { url, userId, projectId, status: 'COMPLETED', recheckTrigger: 'WATCH', completedAt: new Date(),
      watchNotificationStatus: 'FAILED', watchNotificationAttempts: 6, watchNotificationAttemptCeiling: 10 } })
    const home = await loadSiteHome(projectId)
    expect(home?.watch.alert.state).toBe('delivering')
    expect(siteWatchAlertNotice(home!.watch.alert)).toBeNull()
    await prisma.audit.update({ where: { id: alert.id }, data: { watchNotificationAttempts: 10 } })
    const exhausted = await loadSiteHome(projectId)
    expect(exhausted?.watch.alert.state).toBe('undelivered')
    expect(siteWatchAlertNotice(exhausted!.watch.alert)).not.toBeNull()
  })
})
