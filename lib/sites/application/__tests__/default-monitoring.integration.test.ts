import { fixedClock, systemClock } from '@/lib/time/clock'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as transactions from '@/lib/billing/product-transaction'
import { prisma } from '@/lib/db'
import { ensureProductProject } from '@/lib/audit/ensure-product-project'
import { ensureDefaultMonitoring, initializeDefaultMonitoring, MONITORING_SCHEDULE_UNAVAILABLE } from '../default-monitoring'
import { removeSite } from '../settings-commands'
import * as betaPolicy from '@/lib/billing/beta-policy'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip

run('automatic monitoring with migrated PostgreSQL', () => {
  const userId = 'monitoring-test-' + randomUUID()
  const now = new Date('2026-10-11T12:00:00Z')

  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.includes('test'))
      throw new Error('This test requires a disposable local test database')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.com', preferredTools: [] } })
  })
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('admits one Site and one executable availability Outcome under concurrent URL admissions', async () => {
    const admissions = await Promise.all([
      ensureProductProject(userId, 'http://example.com:8080/pricing'),
      ensureProductProject(userId, 'http://example.com:8080/contact'),
    ])
    expect(admissions[0].id).toBe(admissions[1].id)
    const site = await prisma.project.findUniqueOrThrow({ where: { id: admissions[0].id }, include: {
      siteOutcomes: { include: { bindings: true } },
    } })
    expect(site.url).toBe('http://example.com:8080')
    expect(site.watchInterval).toBe('WEEKLY')
    expect(site.watchNextRunAt).toBeInstanceOf(Date)
    expect(site.siteOutcomes).toHaveLength(1)
    expect(site.siteOutcomes[0].confirmedAt).toBeInstanceOf(Date)
    expect(site.siteOutcomes[0].bindings).toHaveLength(1)
    expect(site.siteOutcomes[0].bindings[0]).toMatchObject({ mechanism: 'HTTP_AVAILABILITY', required: true, enabled: true,
      config: { startUrl: 'http://example.com:8080', expectedSelector: 'body' } })
  })

  it('preserves existing Outcome identity, custom name, confirmation, binding and schedule on repeated setup', async () => {
    const site = await prisma.project.findFirstOrThrow({ where: { userId } })
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: site.id } })
    const binding = await prisma.outcomeExecutionBinding.findFirstOrThrow({ where: { outcomeId: outcome.id } })
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { name: 'Keep my website reachable', inferenceSource: 'user' } })
    await prisma.outcomeExecutionBinding.update({ where: { id: binding.id }, data: { version: 3 } })
    await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, site.id, userId, now))
    const current = await prisma.project.findUniqueOrThrow({ where: { id: site.id } })
    const saved = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id }, include: { bindings: true } })
    expect(current.watchNextRunAt).toEqual(site.watchNextRunAt)
    expect(saved.name).toBe('Keep my website reachable')
    expect(saved.confirmedAt).toEqual(outcome.confirmedAt)
    expect(saved.bindings[0]).toMatchObject({ id: binding.id, version: 3 })
    expect(await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, site.id, 'foreign-user', now))).toBe(false)
  })

  it('rechecks an expiring grant for each Site after delayed setup', async () => {
    const start = new Date('2026-10-16T12:00:00Z')
    const sites = await Promise.all(['earlier-clock', 'later-clock'].map((host, index) => prisma.project.create({ data: {
      userId, name: host, url: 'https://' + host + '.example.com/', canonicalHost: host + '.example.com', createdAt: new Date(100 + index),
    } })))
    const grant = await prisma.entitlementGrant.create({ data: { userId, operationId: 'clock-grant-' + randomUUID(),
      grantedBy: 'local-fixture-operator', plan: 'TEAM', expiresAt: new Date(start.getTime() + 60_000) } })
    const transact = transactions.productTransaction
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(start)
    const delay = vi.spyOn(transactions, 'productTransaction').mockImplementation(async write => {
      const result = await transact(write)
      vi.setSystemTime(new Date(Date.now() + 2 * 60_000))
      return result
    })
    try {
      await initializeDefaultMonitoring(2, systemClock)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ watchInterval: 'DAILY', watchNextRunAt: start })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[1].id } })).toMatchObject({ watchInterval: 'WEEKLY',
        watchNextRunAt: new Date(start.getTime() + 2 * 60_000) })
    } finally {
      delay.mockRestore(); vi.useRealTimers()
      await prisma.entitlementGrant.delete({ where: { id: grant.id } })
      await prisma.project.deleteMany({ where: { id: { in: sites.map(site => site.id) } } })
    }
  })

  it('restores default public monitoring through URL admission while retaining Outcome identity and historical assessment dates', async () => {
    const restoreOwner = userId + '-restore'
    await prisma.user.create({ data: { id: restoreOwner, email: restoreOwner + '@example.test' } })
    try {
    const site = await ensureProductProject(restoreOwner, 'https://restored-origin.example.com/')
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: site.id } })
    const lastRunAt = new Date(now.getTime() - 86_400_000)
    await prisma.project.update({ where: { id: site.id }, data: { watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchLastRunAt: lastRunAt } })
    await prisma.siteOutcome.update({ where: { id: outcome.id }, data: { staleAfterMinutes: 900 } })
    const audit = await prisma.audit.create({ data: { userId: restoreOwner, projectId: site.id, url: 'https://restored-origin.example.com/', status: 'COMPLETED', completedAt: lastRunAt } })
    const run = await prisma.runRequest.create({ data: { projectId: site.id, requestedByUserId: restoreOwner, source: 'WATCH', idempotencyKey: randomUUID(),
      auditId: audit.id, status: 'COMPLETED', completedAt: lastRunAt } })
    const assessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: run.id, auditId: audit.id,
      state: 'CLEAR', summary: 'Historical fixture assessment', assessedAt: lastRunAt, validUntil: new Date(lastRunAt.getTime() + 900 * 60_000) } })
    await removeSite({ projectId: site.id, userId: restoreOwner })
    expect((await ensureProductProject(restoreOwner, 'https://restored-origin.example.com/again')).id).toBe(site.id)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({ deletedAt: null, watchInterval: 'WEEKLY',
      watchNextRunAt: expect.any(Date), watchLastRunAt: lastRunAt, accountChecksEnabled: false })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ staleAfterMinutes: 11520, confirmedAt: outcome.confirmedAt })
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toMatchObject({ state: 'CLEAR', assessedAt: assessment.assessedAt, validUntil: assessment.validUntil })
    } finally { await prisma.user.delete({ where: { id: restoreOwner } }) }
  })

  it('backfills untouched Sites without reactivating an explicit pause', async () => {
    // The existing Site is explicitly paused; upkeep must leave it alone.
    const existing = await prisma.project.findFirstOrThrow({ where: { userId } })
    await prisma.project.update({ where: { id: existing.id }, data: { watchInterval: null, watchNextRunAt: null, watchLastError: 'Paused.' } })
    const legacy = await prisma.project.create({ data: { userId, name: 'Legacy', url: 'https://legacy.example.com', canonicalHost: 'legacy.example.com' } })
    await initializeDefaultMonitoring(20, fixedClock(now))
    expect(await prisma.project.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: now })
    expect(await prisma.siteOutcome.count({ where: { projectId: legacy.id, slug: 'page-loads', bindings: { some: { mechanism: 'HTTP_AVAILABILITY' } } } })).toBe(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ watchInterval: null, watchNextRunAt: null, watchLastError: 'Paused.' })
  })
  it('honors active, expired and revoked plan grants while preserving the account subscription', async () => {
    const policyNow = new Date()
    const grant = await prisma.entitlementGrant.create({ data: { userId, operationId: 'local-monitoring-grant-' + randomUUID(),
      grantedBy: 'local-fixture-operator', plan: 'TEAM', expiresAt: new Date(policyNow.getTime() + 60 * 60_000) } })
    try {
      for (const phase of ['active', 'expired', 'revoked'] as const) {
        await prisma.entitlementGrant.update({ where: { id: grant.id }, data: {
          expiresAt: new Date(policyNow.getTime() + (phase === 'expired' ? -1 : 60 * 60_000)), revokedAt: phase === 'revoked' ? policyNow : null,
        } })
        const site = await prisma.project.create({ data: { userId, name: 'Grant policy fixture',
          url: 'https://' + phase + '.example.com/', canonicalHost: phase + '.example.com' } })
        expect(await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, site.id, userId, policyNow))).toBe(true)
        expect(await prisma.project.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({
          watchInterval: phase === 'active' ? 'DAILY' : 'WEEKLY', watchNextRunAt: policyNow })
      }
      expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ plan: 'FREE', subscriptionStatus: 'NONE' })
    } finally { await prisma.entitlementGrant.delete({ where: { id: grant.id } }) }
  })
  it('advances a bounded setup batch past a persistent failure without treating it as an explicit pause', async () => {
    const sites = await Promise.all(['failed-setup', 'following-setup'].map((host, index) => prisma.project.create({ data: {
      userId, name: host, url: 'https://' + host + '.example.com/', canonicalHost: host + '.example.com',
      createdAt: new Date('2000-01-0' + (index + 1) + 'T00:00:00Z'),
    } })))
    // A real per-Site write failure inside the serializable transaction.
    if (!/^[a-z0-9]+$/.test(sites[0].id)) throw new Error('Unexpected fixture identity')
    await prisma.$executeRawUnsafe(`ALTER TABLE site_outcomes ADD CONSTRAINT fixture_failed_monitoring_setup CHECK ("projectId" <> '${sites[0].id}') NOT VALID`)
    try {
      await initializeDefaultMonitoring(1, fixedClock(now))
      await initializeDefaultMonitoring(1, fixedClock(now))
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[1].id } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: now })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ watchInterval: null, watchLastError: null,
        watchLastAttemptAt: null, monitoringSetupRetryAt: new Date(now.getTime() + 60_000) })
      await prisma.$executeRawUnsafe('ALTER TABLE site_outcomes DROP CONSTRAINT fixture_failed_monitoring_setup')
      const later = new Date(now.getTime() + 120_000)
      await prisma.project.update({ where: { id: sites[0].id }, data: { watchLastError: 'Paused.' } })
      await initializeDefaultMonitoring(1, fixedClock(later))
      expect(await prisma.siteOutcome.count({ where: { projectId: sites[0].id } })).toBe(0)
      await prisma.project.update({ where: { id: sites[0].id }, data: { watchLastError: null } })
      await initializeDefaultMonitoring(1, fixedClock(later))
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[0].id } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: later,
        monitoringSetupRetryAt: null })
      expect(await prisma.siteOutcome.count({ where: { projectId: sites[0].id } })).toBe(1)
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE site_outcomes DROP CONSTRAINT IF EXISTS fixture_failed_monitoring_setup')
      await prisma.project.deleteMany({ where: { id: { in: sites.map(site => site.id) } } })
    }
  })
  it('excludes inactive accounts before applying the backfill batch limit', async () => {
    const inactiveUser = 'inactive-monitoring-' + randomUUID(), policyNow = new Date()
    await prisma.user.create({ data: { id: inactiveUser, email: inactiveUser + '@example.test', lifecycleStatus: 'SUSPENDED' } })
    try {
      const paused = await prisma.project.create({ data: { userId: inactiveUser, name: 'Inactive fixture',
        url: 'https://inactive.example.com/', canonicalHost: 'inactive.example.com', createdAt: new Date(0) } })
      const active = await prisma.project.create({ data: { userId, name: 'Eligible fixture',
        url: 'https://eligible.example.com/', canonicalHost: 'eligible.example.com' } })
      expect(await transactions.productTransaction(tx => ensureDefaultMonitoring(tx, paused.id, inactiveUser, policyNow))).toBe(false)
      await initializeDefaultMonitoring(1, fixedClock(policyNow))
      expect(await prisma.project.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: policyNow })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: paused.id } })).toMatchObject({ watchInterval: null, watchNextRunAt: null })
      expect(await prisma.siteOutcome.count({ where: { projectId: paused.id } })).toBe(0)
    } finally { await prisma.user.delete({ where: { id: inactiveUser } }) }
  })
  it('moves past a still-disallowed cadence while preserving paused, leased and unrelated halted clocks', async () => {
    const beta = vi.spyOn(betaPolicy, 'hasOpenBetaAccess').mockReturnValue(false)
    const states = ['disallowed', 'allowed', 'paused', 'leased', 'unrelated'] as const
    const sites = await Promise.all(states.map((state, index) => prisma.project.create({ data: {
      userId, name: state, url: 'https://' + state + '.example.test/', canonicalHost: state + '.example.test',
      createdAt: new Date(1000 + index), watchInterval: state === 'disallowed' ? 'DAILY' : 'WEEKLY',
      watchLastAttemptAt: now, watchLastRunAt: now, watchNextRunAt: null,
      watchLastError: state === 'unrelated' ? 'Unknown operational failure' : MONITORING_SCHEDULE_UNAVAILABLE,
      ...(state === 'paused' ? { watchPausedAt: now } : {}),
      ...(state === 'leased' ? { watchLeaseUntil: new Date(now.getTime() + 600_000) } : {}),
    } })))
    try {
      await initializeDefaultMonitoring(1, fixedClock(now))
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[0].id } }))
        .toMatchObject({ watchNextRunAt: null, monitoringSetupRetryAt: new Date(now.getTime() + 60_000) })
      await initializeDefaultMonitoring(1, fixedClock(now))
      expect(await prisma.project.findUniqueOrThrow({ where: { id: sites[1].id } }))
        .toMatchObject({ watchNextRunAt: now, watchLastError: null, watchLastAttemptAt: now, watchLastRunAt: now })
      for (const site of sites.slice(2)) expect(await prisma.project.findUniqueOrThrow({ where: { id: site.id } })).toEqual(site)
    } finally {
      beta.mockRestore()
      await prisma.project.deleteMany({ where: { id: { in: sites.map(site => site.id) } } })
    }
  })
})
