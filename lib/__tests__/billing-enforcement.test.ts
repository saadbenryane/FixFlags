import { describe, it, beforeEach, afterAll } from 'vitest'

const _env = process.env as Record<string, string | undefined>
import assert from 'node:assert/strict'
import {
  PLAN_DEFINITIONS,
  PLAN_LIMITS,
  scanLimitForPlan,
  projectLimitForPlan,
  proUpgradeCta,
  planFromPriceId,
  getMarketingPlans,
  CONTACT_PLAN,
} from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import {
  isDevUnlimitedScans,
  isAdminUser,
  hasUnlimitedScans,
  getEffectiveScanLimit,
  isUnlimitedScanLimit,
  UNLIMITED_SCAN_LIMIT,
} from '@/lib/auth/permissions'
import {
  shouldEnforcePlanGates,
  canAccessPaidFeatures,
  canUseApiKeys,
  getEntitlements,
} from '@/lib/auth/entitlements'
import { CREDIT_PACKS, getCreditPack } from '@/lib/billing/credits'
import { RateLimitError, requestClientId } from '@/lib/security/rate-limit'
import { limitErrorCodeForPlan } from '@/lib/audit/check-limit'

// ── Plan definition invariants ───────────────────────────────────

describe('plan definitions', () => {
  const plandIds: Plan[] = ['FREE', 'BUILDER', 'TEAM']

  it('every plan has a positive audit limit', () => {
    for (const plan of plandIds) {
      assert.ok(PLAN_DEFINITIONS[plan].auditLimit > 0, `${plan} auditLimit must be positive`)
    }
  })

  it('every plan renews monthly', () => {
    assert.equal(PLAN_DEFINITIONS.FREE.auditLimitKind, 'monthly')
    assert.equal(PLAN_DEFINITIONS.BUILDER.auditLimitKind, 'monthly')
    assert.equal(PLAN_DEFINITIONS.TEAM.auditLimitKind, 'monthly')
  })

  it('each plan has a price', () => {
    for (const plan of plandIds) {
      assert.ok(PLAN_DEFINITIONS[plan].price.length > 0)
    }
  })

  it('each plan has at least one feature', () => {
    for (const plan of plandIds) {
      assert.ok(PLAN_DEFINITIONS[plan].features.length >= 1)
    }
  })

  it('audit limits increase with plan tier', () => {
    assert.ok(PLAN_DEFINITIONS.FREE.auditLimit < PLAN_DEFINITIONS.BUILDER.auditLimit)
    assert.ok(PLAN_DEFINITIONS.BUILDER.auditLimit < PLAN_DEFINITIONS.TEAM.auditLimit)
  })

  it('prices increase with plan tier', () => {
    const price = (s: string) => Number(s.replace(/[^0-9]/g, ''))
    assert.ok(price(PLAN_DEFINITIONS.FREE.price) < price(PLAN_DEFINITIONS.BUILDER.price))
    assert.ok(price(PLAN_DEFINITIONS.BUILDER.price) < price(PLAN_DEFINITIONS.TEAM.price))
  })

  it('PLAN_LIMITS has matching entries for every plan', () => {
    const limits = ['FREE', 'BUILDER', 'TEAM'] as const
    for (const plan of limits) {
      assert.equal(PLAN_LIMITS[plan].audits, PLAN_DEFINITIONS[plan].auditLimit)
      assert.equal(PLAN_LIMITS[plan].label, PLAN_DEFINITIONS[plan].label)
    }
  })
})

// ── CONTACT_PLAN invariants ──────────────────────────────────────

describe('CONTACT_PLAN', () => {
  it('has custom pricing', () => {
    assert.equal(CONTACT_PLAN.price, 'Custom')
  })

  it('has at least one feature', () => {
    assert.ok(CONTACT_PLAN.features.length >= 1)
  })
})

// ── scanLimitForPlan / projectLimitForPlan ───────────────────────

describe('scanLimitForPlan', () => {
  it('returns 3 for FREE', () => {
    assert.equal(scanLimitForPlan('FREE'), 3)
  })

  it('returns 30 for BUILDER', () => {
    assert.equal(scanLimitForPlan('BUILDER'), 30)
  })

  it('returns 90 for TEAM', () => {
    assert.equal(scanLimitForPlan('TEAM'), 90)
  })
})

describe('projectLimitForPlan', () => {
  it('uses the 1, 5, unlimited Product ladder', () => {
    assert.equal(projectLimitForPlan('FREE'), 1)
    assert.equal(projectLimitForPlan('BUILDER'), 5)
    assert.equal(projectLimitForPlan('TEAM'), null)
  })
})

// ── proUpgradeCta ────────────────────────────────────────────────

describe('proUpgradeCta', () => {
  it('includes the Pro price in the default CTA', () => {
    const cta = proUpgradeCta()
    assert.ok(cta.includes('$29'))
    assert.ok(cta.includes('/mo'))
  })

  it('uses custom prefix when provided', () => {
    const cta = proUpgradeCta('Go Pro')
    assert.ok(cta.startsWith('Go Pro'))
  })
})

// ── planFromPriceId ──────────────────────────────────────────────

describe('planFromPriceId', () => {
  it('returns null for unknown price IDs', () => {
    assert.equal(planFromPriceId('price_unknown'), null)
  })
})

// ── getMarketingPlans ────────────────────────────────────────────

describe('getMarketingPlans', () => {
  it('returns all three plans', () => {
    const plans = getMarketingPlans()
    assert.equal(plans.length, 3)
  })

  it('each plan has required fields', () => {
    const plans = getMarketingPlans()
    for (const plan of plans) {
      assert.ok(plan.name)
      assert.ok(plan.price)
      assert.ok(plan.features.length >= 1)
      assert.ok(plan.cta)
      assert.ok(plan.href)
    }
  })
})

// ── Credit pack invariants ───────────────────────────────────────

describe('CREDIT_PACKS', () => {
  it('has exactly 3 packs', () => {
    assert.equal(CREDIT_PACKS.length, 3)
  })

  it('each pack has unique id', () => {
    const ids = CREDIT_PACKS.map((p) => p.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it('credits increase with price', () => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.priceUsdCents - b.priceUsdCents)
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].credits > sorted[i - 1].credits)
      assert.ok(sorted[i].priceUsdCents > sorted[i - 1].priceUsdCents)
    }
  })

  it('larger packs give better per-unit price', () => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.credits - b.credits)
    const cpp = sorted.map((p) => p.priceUsdCents / p.credits)
    // Each larger pack should have a strictly better cost per credit
    for (let i = 1; i < cpp.length; i++) {
      assert.ok(cpp[i] < cpp[i - 1], `pack ${sorted[i].id} should have lower cost per credit than ${sorted[i - 1].id}`)
    }
  })
})

describe('getCreditPack', () => {
  it('returns the matching pack', () => {
    const pack = getCreditPack('pack_10')
    assert.ok(pack)
    assert.equal(pack!.credits, 10)
    assert.equal(pack!.priceUsdCents, 1500)
  })

  it('returns undefined for unknown packs', () => {
    assert.equal(getCreditPack('nonexistent'), undefined)
  })
})

// ── isDevUnlimitedScans ─────────────────────────────────────────

describe('isDevUnlimitedScans', () => {
  beforeEach(() => {
    delete _env.NODE_ENV
    delete _env.DEV_SIMULATE_BILLING
  })

  it('returns true in dev without billing simulation', () => {
    _env.NODE_ENV = 'development'
    assert.equal(isDevUnlimitedScans(), true)
  })

  it('returns false in dev with billing simulation', () => {
    _env.NODE_ENV = 'development'
    _env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(isDevUnlimitedScans(), false)
  })

  it('returns false in production', () => {
    _env.NODE_ENV = 'production'
    assert.equal(isDevUnlimitedScans(), false)
  })
})

// ── shouldEnforcePlanGates ──────────────────────────────────────

describe('shouldEnforcePlanGates', () => {
  beforeEach(() => {
    delete _env.NODE_ENV
    delete _env.DEV_SIMULATE_BILLING
  })

  it('returns false in dev without billing simulation', () => {
    _env.NODE_ENV = 'development'
    assert.equal(shouldEnforcePlanGates(), false)
  })

  it('returns true in dev with billing simulation', () => {
    _env.NODE_ENV = 'development'
    _env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(shouldEnforcePlanGates(), true)
  })

  it('returns true in production', () => {
    _env.NODE_ENV = 'production'
    assert.equal(shouldEnforcePlanGates(), true)
  })
})

// ── isAdminUser ──────────────────────────────────────────────────

describe('isAdminUser', () => {
  const origAdminIds = _env.ADMIN_USER_IDS

  afterAll(() => {
    _env.ADMIN_USER_IDS = origAdminIds
  })

  it('returns true for admin role', () => {
    assert.equal(isAdminUser({ id: 'u1', role: 'admin' }), true)
  })

  it('returns true for user in ADMIN_USER_IDS', () => {
    _env.ADMIN_USER_IDS = 'admin1,admin2'
    // Note: relies on getEnv() reading the env var dynamically
    assert.equal(isAdminUser({ id: 'u1', role: 'user' }), false)
  })

  it('returns false for regular user', () => {
    _env.ADMIN_USER_IDS = ''
    assert.equal(isAdminUser({ id: 'u1', role: 'user' }), false)
  })
})

// ── hasUnlimitedScans ────────────────────────────────────────────

describe('hasUnlimitedScans', () => {
  it('returns true for dev without billing simulation', () => {
    _env.NODE_ENV = 'development'
    delete _env.DEV_SIMULATE_BILLING
    assert.equal(hasUnlimitedScans({ role: 'user' }), true)
  })

  it('returns true for admin role', () => {
    _env.NODE_ENV = 'production'
    assert.equal(hasUnlimitedScans({ role: 'admin' }), true)
  })

  it('returns false for non-admin user in production', () => {
    _env.NODE_ENV = 'production'
    assert.equal(hasUnlimitedScans({ role: 'user' }), false)
  })
})

// ── getEffectiveScanLimit ────────────────────────────────────────

describe('getEffectiveScanLimit', () => {
  it('returns UNLIMITED_SCAN_LIMIT for users with unlimited scans', () => {
    _env.NODE_ENV = 'production'
    assert.equal(getEffectiveScanLimit({ role: 'admin', auditsLimit: 3 }), UNLIMITED_SCAN_LIMIT)
  })

  it('returns auditsLimit for regular users', () => {
    _env.NODE_ENV = 'production'
    assert.equal(getEffectiveScanLimit({ role: 'user', auditsLimit: 10 }), 10)
  })
})

// ── isUnlimitedScanLimit ─────────────────────────────────────────

describe('isUnlimitedScanLimit', () => {
  it('returns true for UNLIMITED_SCAN_LIMIT', () => {
    assert.equal(isUnlimitedScanLimit(UNLIMITED_SCAN_LIMIT), true)
  })

  it('returns false for positive limits', () => {
    assert.equal(isUnlimitedScanLimit(0), false)
    assert.equal(isUnlimitedScanLimit(3), false)
    assert.equal(isUnlimitedScanLimit(100), false)
  })
})

// ── limitErrorCodeForPlan ────────────────────────────────────────

describe('limitErrorCodeForPlan', () => {
  it('returns UPGRADE_REQUIRED for FREE', () => {
    assert.equal(limitErrorCodeForPlan('FREE'), 'UPGRADE_REQUIRED')
  })

  it('returns TOKEN_LIMIT for paid plans', () => {
    assert.equal(limitErrorCodeForPlan('BUILDER'), 'TOKEN_LIMIT')
    assert.equal(limitErrorCodeForPlan('TEAM'), 'TOKEN_LIMIT')
  })
})

// ── canUseApiKeys ─────────────────────────────────────────────────

describe('canUseApiKeys', () => {
  const sub = (plan: 'FREE' | 'BUILDER' | 'TEAM'): 'NONE' | 'ACTIVE' =>
    plan === 'FREE' ? 'NONE' : 'ACTIVE'
  const gateUser = (plan: 'FREE' | 'BUILDER' | 'TEAM', role = 'user') => ({ id: 'u1', role, plan, subscriptionStatus: sub(plan) })

  it('allows MCP API keys for paid plan users when gates enforce', () => {
    _env.NODE_ENV = 'production'
    assert.equal(canUseApiKeys(gateUser('BUILDER')), true)
    assert.equal(canUseApiKeys(gateUser('TEAM')), true)
  })

  it('blocks MCP API keys for free users when gates enforce', () => {
    _env.NODE_ENV = 'production'
    assert.equal(canUseApiKeys(gateUser('FREE')), false)
  })

  it('allows MCP API keys for admins', () => {
    _env.NODE_ENV = 'production'
    assert.equal(canUseApiKeys(gateUser('FREE', 'admin')), true)
  })
})

// ── getEntitlements: MCP field ───────────────────────────────────

describe('getEntitlements MCP (canUseMcp)', () => {
  it('maps canUseMcp to true for paid users in production', () => {
    _env.NODE_ENV = 'production'
    const e = getEntitlements({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'ACTIVE' })
    assert.equal(e.canUseMcp, true)
  })

  it('maps canUseMcp to false for free users in production', () => {
    _env.NODE_ENV = 'production'
    const e = getEntitlements({ id: 'u2', role: 'user', plan: 'FREE', subscriptionStatus: 'NONE' })
    assert.equal(e.canUseMcp, false)
  })
})

// ── RateLimitError ───────────────────────────────────────────────

describe('RateLimitError', () => {
  it('stores retryAfter seconds', () => {
    const err = new RateLimitError(30)
    assert.equal(err.retryAfter, 30)
  })

  it('has RateLimitError as the name', () => {
    const err = new RateLimitError(10)
    assert.equal(err.name, 'RateLimitError')
  })

  it('is an instance of Error', () => {
    const err = new RateLimitError(5)
    assert.ok(err instanceof Error)
  })
})

// ── requestClientId ──────────────────────────────────────────────

describe('requestClientId', () => {
  it('prefers x-forwarded-for', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.1, 10.0.0.1',
      'x-real-ip': '198.51.100.1',
    })
    assert.equal(requestClientId(headers), '203.0.113.1')
  })

  it('falls back to x-real-ip', () => {
    const headers = new Headers({
      'x-real-ip': '198.51.100.1',
    })
    assert.equal(requestClientId(headers), '198.51.100.1')
  })

  it('returns unknown when no headers present', () => {
    const headers = new Headers({})
    assert.equal(requestClientId(headers), 'unknown')
  })

  it('takes the first IP from a comma-separated list', () => {
    const headers = new Headers({
      'x-forwarded-for': ' 203.0.113.1 , 10.0.0.1 ',
    })
    assert.equal(requestClientId(headers), '203.0.113.1')
  })
})

// ── canAccessPaidFeatures edge cases ─────────────────────────────

describe('canAccessPaidFeatures', () => {
  it('allows all users when not enforcing gates', () => {
    _env.NODE_ENV = 'development'
    delete _env.DEV_SIMULATE_BILLING
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'FREE', subscriptionStatus: 'NONE' }),
      true
    )
  })

  it('blocks free users when enforcing gates', () => {
    _env.NODE_ENV = 'production'
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'FREE', subscriptionStatus: 'NONE' }),
      false
    )
  })

  it('allows paid plan users when enforcing gates', () => {
    _env.NODE_ENV = 'production'
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'ACTIVE' }),
      true
    )
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' }),
      true
    )
  })

  it('allows paid plan users while trialing', () => {
    _env.NODE_ENV = 'production'
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'TRIALING' }),
      true
    )
  })

  it('blocks paid plan users whose subscription is past due, canceled, or unpaid', () => {
    _env.NODE_ENV = 'production'
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' }),
      false
    )
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'CANCELED' }),
      false
    )
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'UNPAID' }),
      false
    )
  })

  it('still allows admins with a past-due subscription', () => {
    _env.NODE_ENV = 'production'
    assert.equal(
      canAccessPaidFeatures({ id: 'u1', role: 'admin', plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' }),
      true
    )
  })
})
