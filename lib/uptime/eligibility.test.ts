import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntitlementGrant } from '@prisma/client'
import { uptimeEligible, type MonitoringProject } from './eligibility'

const policy = vi.hoisted(() => ({ beta: false }))
vi.mock('@/lib/billing/beta-policy', () => ({ hasOpenBetaAccess: () => policy.beta }))
const now = new Date('2026-10-16T12:00:00Z')
const grant: EntitlementGrant = { id: 'grant', userId: 'owner', operationId: 'operation', grantedBy: 'fixture', plan: 'TEAM',
  siteAllowance: null, scanAllowance: null, deepReviewAllowance: null, allowedWatchIntervals: [],
  expiresAt: new Date(now.getTime() + 60_000), revokedAt: null, createdAt: now }
function project(grants: EntitlementGrant[] = []): MonitoringProject {
  return { id: 'site', url: 'https://example.com/', deletedAt: null, watchInterval: 'DAILY', watchNextRunAt: now, watchPausedAt: null,
    user: { id: 'owner', role: 'user', plan: 'FREE', subscriptionStatus: 'NONE', lifecycleStatus: 'ACTIVE',
      auditsLimit: 5, deepReviewsLimit: 1, licensedSiteQuantity: 0, entitlementGrants: grants } } as MonitoringProject
}
beforeEach(() => { policy.beta = false; vi.stubEnv('DEV_SIMULATE_BILLING', 'true') })
afterEach(() => vi.unstubAllEnvs())
describe('uptime included independently of analysis entitlements', () => {
  it('includes uptime for a Free account with an active analysis grant', () => {
    const site = project([grant])
    expect(uptimeEligible(site)).toBe(true)
  })
  it('does not require a paid plan for a schedule-only grant', () => {
    expect(uptimeEligible(project([{ ...grant, plan: null, allowedWatchIntervals: ['daily'] }]))).toBe(true)
  })
  it('keeps basic uptime when an analysis grant expires or is revoked', () => {
    expect(uptimeEligible(project([{ ...grant, expiresAt: now }]))).toBe(true)
    expect(uptimeEligible(project([{ ...grant, revokedAt: now }]))).toBe(true)
    expect(uptimeEligible(project())).toBe(true)
  })
  it('retains open-beta access while honoring pauses and account lifecycle', () => {
    policy.beta = true
    const site = project()
    expect(uptimeEligible(site)).toBe(true)
    expect(uptimeEligible({ ...site, watchNextRunAt: null })).toBe(true)
    expect(uptimeEligible({ ...site, watchPausedAt: now })).toBe(false)
    expect(uptimeEligible({ ...site, watchInterval: null, watchNextRunAt: null })).toBe(false)
    expect(uptimeEligible({ ...site, deletedAt: now })).toBe(false)
    expect(uptimeEligible({ ...site, user: { ...site.user, lifecycleStatus: 'SUSPENDED' } })).toBe(false)
  })
})
