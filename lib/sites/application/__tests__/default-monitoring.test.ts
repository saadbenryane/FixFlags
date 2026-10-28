import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { ensureDefaultMonitoring, MONITORING_SCHEDULE_UNAVAILABLE } from '../default-monitoring'

const now = new Date('2026-10-11T10:00:00Z')
const project = { id: 'site', url: 'http://example.com:8080', watchInterval: null, watchNextRunAt: null, watchPausedAt: null,
  watchEveryMinutes: null, watchLastAttemptAt: null, watchLastRunAt: null, watchLastError: null,
  user: { id: 'owner', role: 'user', plan: 'FREE', subscriptionStatus: 'NONE', lifecycleStatus: 'ACTIVE',
    auditsLimit: 3, deepReviewsLimit: 1, licensedSiteQuantity: 0, entitlementGrants: [] } }
const tx = { project: { findFirst: vi.fn(), updateMany: vi.fn() }, siteOutcome: { upsert: vi.fn() } }

beforeEach(() => {
  vi.clearAllMocks()
  tx.project.findFirst.mockResolvedValue(project)
  tx.project.updateMany.mockResolvedValue({ count: 1 })
})
const ensure = () => ensureDefaultMonitoring(tx as unknown as Prisma.TransactionClient, 'site', 'owner', now)
const grant = { id: 'grant', userId: 'owner', operationId: 'grant-operation', grantedBy: 'operator', plan: 'TEAM',
  siteAllowance: null, scanAllowance: null, deepReviewAllowance: null, allowedWatchIntervals: [],
  expiresAt: new Date(now.getTime() + 60_000), revokedAt: null, createdAt: now }

describe('automatic public monitoring defaults', () => {
  it('retains an explicit pause even when its displayed error was cleared', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, watchInterval: 'WEEKLY', watchPausedAt: now })
    expect(await ensure()).toBe(false)
    expect(tx.project.updateMany).not.toHaveBeenCalled()
    expect(tx.siteOutcome.upsert).not.toHaveBeenCalled()
  })
  it('restarts a permitted policy-halted cadence without changing its history or custom timing', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, watchInterval: 'CUSTOM', watchEveryMinutes: 180,
      watchLastError: MONITORING_SCHEDULE_UNAVAILABLE, watchLastAttemptAt: now, watchLastRunAt: now,
      watchLeaseUntil: new Date(now.getTime() - 1) })
    expect(await ensure()).toBe(true)
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ watchInterval: 'CUSTOM', watchEveryMinutes: 180,
        watchLastError: MONITORING_SCHEDULE_UNAVAILABLE, watchLastAttemptAt: now, watchLastRunAt: now }),
      data: { watchInterval: 'CUSTOM', watchNextRunAt: now, watchPausedAt: null, watchLeaseUntil: null, watchLastError: null },
    }))
  })
  it.each([
    { watchPausedAt: now },
    { watchLeaseUntil: new Date(now.getTime() + 60_000) },
    { watchLastError: 'Paused.' },
    { watchLastError: 'Unknown operational failure' },
  ])('does not restart a halted clock with changed authority or an unrelated reason: %j', async changed => {
    tx.project.findFirst.mockResolvedValue({ ...project, watchInterval: 'DAILY',
      watchLastError: MONITORING_SCHEDULE_UNAVAILABLE, ...changed })
    await ensure()
    expect(tx.project.updateMany).not.toHaveBeenCalled()
  })
  it('creates an executable default in the Site transaction, retains its actual origin and schedules the first check now', async () => {
    expect(await ensure()).toBe(true)
    expect(tx.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'site', userId: 'owner', deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } }))
    expect(tx.siteOutcome.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_slug: { projectId: 'site', slug: 'page-loads' } }, update: {},
      create: expect.objectContaining({ kind: 'AVAILABILITY', inferenceSource: 'automatic', confirmedAt: now,
        bindings: { create: { key: 'page-availability-v1', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: 'http://example.com:8080', expectedSelector: 'body' } } } }),
    }))
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { watchInterval: 'WEEKLY', watchNextRunAt: now, watchPausedAt: null } }))
  })

  it('uses the paid cadence without changing subscriptions or exceeding the available policy', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, plan: 'BUILDER', subscriptionStatus: 'ACTIVE' } })
    await ensure()
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { watchInterval: 'DAILY', watchNextRunAt: now, watchPausedAt: null } }))
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' } })
    await ensure()
    expect(tx.project.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { watchInterval: 'WEEKLY', watchNextRunAt: now, watchPausedAt: null } }))
  })

  it('keeps an existing cadence, next check, lease and Outcome intact while adding missing default coverage', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchNextRunAt: now,
      user: { ...project.user, entitlementGrants: [{ ...grant, plan: null, allowedWatchIntervals: ['custom'] }] } })
    await ensure()
    expect(tx.siteOutcome.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {},
      create: expect.objectContaining({ staleAfterMinutes: 900 }) }))
    expect(tx.project.updateMany).not.toHaveBeenCalled()
  })
  it('uses an active granted plan for its automatic cadence without changing the subscription', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, entitlementGrants: [grant] } })
    expect(await ensure()).toBe(true)
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { watchInterval: 'DAILY', watchNextRunAt: now, watchPausedAt: null } }))
  })
  it.each([{ revokedAt: now }, { expiresAt: now }])('ignores an inactive grant: %j', inactive => {
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, entitlementGrants: [{ ...grant, ...inactive }] } })
    return ensure().then(() => expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { watchInterval: 'WEEKLY', watchNextRunAt: now, watchPausedAt: null } })))
  })
  it.each(['SUSPENDED', 'DELETING'])('does not initialize monitoring for a %s account even with a plan grant', async lifecycleStatus => {
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, lifecycleStatus, entitlementGrants: [grant] } })
    expect(await ensure()).toBe(false)
    expect(tx.siteOutcome.upsert).not.toHaveBeenCalled(); expect(tx.project.updateMany).not.toHaveBeenCalled()
  })

  it.each([{ watchLastError: 'Paused. This Site is not on a check schedule.' }, { watchLastRunAt: now }, { watchLastAttemptAt: now }])('honors previous monitoring control %j', async history => {
    tx.project.findFirst.mockResolvedValue({ ...project, ...history })
    expect(await ensure()).toBe(false)
    expect(tx.siteOutcome.upsert).not.toHaveBeenCalled()
    expect(tx.project.updateMany).not.toHaveBeenCalled()
  })

  it('does not initialize a missing, deleted or foreign Site', async () => {
    tx.project.findFirst.mockResolvedValue(null)
    expect(await ensure()).toBe(false)
    expect(tx.siteOutcome.upsert).not.toHaveBeenCalled()
  })
})
