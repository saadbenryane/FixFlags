import { describe, expect, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import {
  planFromPriceId,
  planLabel,
  PLAN_DEFINITIONS,
  usageAllowanceForPriceId,
} from '@/lib/billing/plans'

describe('planLabel', () => {
  // Paying customers must always see the name they bought. The internal enum
  // codes (BUILDER, TEAM) are not customer-facing: rendering "Builder plan" or
  // "Team plan" reads as a billing bug to someone who paid for "Pro" / "Studio".
  it('maps internal plan codes to customer-facing names', () => {
    assert.equal(planLabel('FREE'), 'Free')
    assert.equal(planLabel('BUILDER'), 'Pro')
    assert.equal(planLabel('TEAM'), 'Studio')
  })

  it('never leaks a raw enum code as a label', () => {
    for (const plan of Object.keys(PLAN_DEFINITIONS)) {
      const label = planLabel(plan)
      assert.notEqual(label, plan, `label for ${plan} must not be the raw code`)
      assert.doesNotMatch(label, /builder|team/i, `label for ${plan} leaks an internal code`)
    }
  })

  it('falls back to Free for an unknown plan instead of throwing', () => {
    assert.equal(planLabel('SOMETHING_ELSE'), 'Free')
  })
})

describe('usage plan ladder', () => {
  it('keeps enum codes while exposing the canonical monthly limits and prices', () => {
    expect(PLAN_DEFINITIONS.FREE).toMatchObject({
      price: '$0',
      auditLimit: 3,
      projectLimit: 1,
      deepReviewLimit: -1,
    })
    expect(PLAN_DEFINITIONS.BUILDER).toMatchObject({
      price: '$29',
      auditLimit: 30,
      projectLimit: 5,
      deepReviewLimit: -1,
      deepReviewLimitLabel: 'Path depth included',
    })
    expect(PLAN_DEFINITIONS.TEAM).toMatchObject({
      price: '$79',
      auditLimit: 90,
      projectLimit: null,
      deepReviewLimit: -1,
    })
    expect(Object.values(PLAN_DEFINITIONS).every((plan) => plan.auditLimitKind === 'monthly')).toBe(true)
  })

  it('maps configured legacy prices for grandfathered subscribers', () => {
    vi.stubEnv('STRIPE_LEGACY_BUILDER_PRICE_IDS', 'price_old_pro, price_older_pro')
    vi.stubEnv('STRIPE_LEGACY_TEAM_PRICE_IDS', 'price_old_studio')
    expect(planFromPriceId('price_older_pro')).toBe('BUILDER')
    expect(planFromPriceId('price_old_studio')).toBe('TEAM')
    expect(usageAllowanceForPriceId('price_older_pro')).toEqual({
      plan: 'BUILDER',
      auditLimit: 25,
      deepReviewLimit: -1,
      legacy: true,
    })
    expect(usageAllowanceForPriceId('price_old_studio')).toEqual({
      plan: 'TEAM',
      auditLimit: 80,
      deepReviewLimit: -1,
      legacy: true,
    })
    vi.unstubAllEnvs()
  })
})
