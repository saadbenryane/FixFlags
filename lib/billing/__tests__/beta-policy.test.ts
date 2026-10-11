import { beforeEach, describe, expect, it, vi } from 'vitest'

const account = vi.hoisted(() => ({ id: 'beta-user', role: 'user', plan: 'FREE' as const, subscriptionStatus: 'NONE', auditsLimit: 3, auditsUsed: 1000 }))
const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $executeRaw: vi.fn(),
  user: { findUnique: vi.fn(), update: vi.fn() },
  audit: { count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  project: { count: vi.fn() },
  creditPurchase: { aggregate: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  siteLifecycleEvent: { upsert: vi.fn() },
  chatUsagePeriod: { upsert: vi.fn(), update: vi.fn() },
  chatUsageReservation: { aggregate: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))
vi.mock('@/lib/env', () => ({ getEnv: () => ({ ADMIN_USER_IDS: [] }) }))
vi.mock('@/lib/billing/usage-period', () => ({ rollUserUsagePeriod: vi.fn(async () => account) }))

import { hasOpenBetaAccess } from '@/lib/billing/beta-policy'
import { hasUnlimitedScans, getCheckUsage, getPlanDisplayLimit } from '@/lib/auth/permissions'
import { getEntitlements, allowedWatchIntervals } from '@/lib/auth/entitlements'
import { siteCarePolicy } from '@/lib/sites/application/care-policy'
import { reviewDepthForPlan, PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { isPaidOpenClient, isPaidOpenServer } from '@/lib/billing/paid-open'
import { resolveIncludeAiForNewAudit } from '@/lib/audit/ai-report-entitlement'
import { wouldBlockNewCheckWithCredits } from '@/lib/billing/credits'
import { incrementUsageOnCompleteForAudit } from '@/lib/audit/usage'
import { assertCanCreateProduct, ProductLimitReached } from '@/lib/billing/product-capacity'
import { reserveChatUsage, finalizeChatUsage } from '@/lib/billing/chat-usage'

const period = { id: 'period', userId: account.id, periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-11-01'), limitTokens: -1, inputTokens: 10_000_000, outputTokens: 2_000_000, reservedTokens: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  db.$transaction.mockImplementation(async callback => callback(db))
  db.$executeRaw.mockResolvedValue(1)
  db.user.findUnique.mockResolvedValue(account)
  db.audit.count.mockResolvedValue(1000)
  db.creditPurchase.aggregate.mockResolvedValue({ _sum: { creditsRemaining: 7 } })
  db.siteLifecycleEvent.upsert.mockResolvedValue({})
  db.chatUsagePeriod.upsert.mockResolvedValue(period)
  db.chatUsagePeriod.update.mockResolvedValue(period)
  db.chatUsageReservation.aggregate.mockResolvedValue({ _sum: { reservedTokens: 0 } })
  db.chatUsageReservation.create.mockResolvedValue({ id: 'reservation' })
})

describe('unrestricted one-website open beta', () => {
  it('requires an account for beta access', () => {
    expect(hasOpenBetaAccess(null)).toBe(false)
    expect(hasOpenBetaAccess(undefined)).toBe(false)
    expect(hasOpenBetaAccess(account)).toBe(true)
  })
  it('grants Free all released capability gates, schedules, and full depth', () => {
    expect(getEntitlements(account)).toEqual({ canExportSummary: true, canAccessPaidFeatures: true, canMonitor: true, canWatchProduct: true, canUseMcp: true, canAccessBasicMcp: true, canScanRepositories: true })
    expect(allowedWatchIntervals(account)).toEqual(['weekly', 'daily', 'hourly', 'custom'])
    expect(reviewDepthForPlan('FREE')).toBe(3)
    expect(siteCarePolicy(account).maxSites).toBe(1)
  })
  it('keeps beta access independent of subscription status', () => {
    const canceled = { ...account, plan: 'TEAM' as const, subscriptionStatus: 'CANCELED' as const }
    expect(getEntitlements(canceled).canScanRepositories).toBe(true)
    expect(siteCarePolicy(canceled).maxSites).toBe(1)
    expect(allowedWatchIntervals(canceled)).toContain('hourly')
  })
  it('ignores exhausted analysis allowances and pending work without spending purchased credits', async () => {
    expect(hasUnlimitedScans(account)).toBe(true)
    expect(getPlanDisplayLimit(account)).toBeNull()
    await expect(wouldBlockNewCheckWithCredits(account, 1000)).resolves.toEqual({ allowed: true })
    await expect(resolveIncludeAiForNewAudit(account.id)).resolves.toBe(true)
    expect(db.creditPurchase.aggregate).not.toHaveBeenCalled()
    expect(db.audit.count).not.toHaveBeenCalled()
    await expect(getCheckUsage(account)).resolves.toMatchObject({ isUnlimited: true, limit: null, totalAvailable: null })
  })
  it('records completed analysis usage without consuming historical credit packs', async () => {
    db.audit.findUnique.mockResolvedValue({ userId: account.id, usageCountedAt: null, skipUsageCount: false })
    await incrementUsageOnCompleteForAudit('audit', account.id)
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: account.id }, data: { auditsUsed: { increment: 1 } } })
    expect(db.audit.update).toHaveBeenCalledWith({ where: { id: 'audit' }, data: { usageCountedAt: expect.any(Date) } })
    expect(db.creditPurchase.findFirst).not.toHaveBeenCalled()
    db.audit.findUnique.mockResolvedValue({ userId: account.id, usageCountedAt: new Date(), skipUsageCount: false })
    await incrementUsageOnCompleteForAudit('audit', account.id)
    expect(db.user.update).toHaveBeenCalledTimes(1)
  })
  it('reserves AI work above old allowances and persists real token consumption', async () => {
    const result = await reserveChatUsage(account, 50_000)
    expect(result).toMatchObject({ reservationId: 'reservation', allowance: { limit: null, remaining: null, used: 12_000_000 } })
    expect(db.chatUsagePeriod.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ limitTokens: -1 }) }))
    db.chatUsageReservation.findUnique.mockResolvedValue({ id: 'reservation', periodId: period.id, reservedTokens: 50_000, status: 'RESERVED', period })
    await finalizeChatUsage('reservation', { inputTokens: 123, outputTokens: 45, model: 'gpt-4o-mini' })
    expect(db.chatUsageReservation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inputTokens: 123, outputTokens: 45 }) }))
    expect(db.siteLifecycleEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ name: 'agent_usage_recorded', properties: expect.objectContaining({ inputTokens: 123, outputTokens: 45, model: 'gpt-4o-mini', estimatedCostUsd: expect.any(Number) }) }) }))
  })
  it('locks capacity before counting websites and records a refused second Site', async () => {
    db.project.count.mockResolvedValue(1)
    await expect(assertCanCreateProduct(db as never, account.id)).rejects.toBeInstanceOf(ProductLimitReached)
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(db.project.count.mock.invocationCallOrder[0])
    expect(db.project.count).toHaveBeenCalledWith({ where: { userId: account.id, deletedAt: null } })
    expect(db.siteLifecycleEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ name: 'site_capacity_reached' }) }))
  })
  it('preserves subscriber allowances and larger purchased Site caps', () => {
    expect(PLAN_DEFINITIONS.FREE.auditLimit).toBe(3)
    expect(siteCarePolicy({ ...account, plan: 'BUILDER', subscriptionStatus: 'ACTIVE' }).maxSites).toBe(5)
    expect(siteCarePolicy({ ...account, plan: 'TEAM', subscriptionStatus: 'ACTIVE' }).maxSites).toBeNull()
  })
  it('keeps server and client paid checkout closed even when old flags are enabled', () => {
    vi.stubEnv('STRIPE_PAID_OPEN', 'true')
    vi.stubEnv('NEXT_PUBLIC_PAID_OPEN', 'true')
    expect(isPaidOpenServer()).toBe(false)
    expect(isPaidOpenClient()).toBe(false)
    vi.unstubAllEnvs()
  })
})
