import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isBillingFullyConfigured,
  isAnyStripeEnvSet,
  missingStripeEnvVars,
  validateStripeBillingEnv,
  STRIPE_ALL_ENV_KEYS,
} from '@/lib/billing/config'

const SAMPLE: Record<(typeof STRIPE_ALL_ENV_KEYS)[number], string> = {
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_BUILDER_PRICE_ID: 'price_builder',
  STRIPE_TEAM_PRICE_ID: 'price_team',
}

function clearStripeEnv() {
  for (const key of STRIPE_ALL_ENV_KEYS) {
    vi.stubEnv(key, '')
  }
  vi.stubEnv('BILLING_REQUIRED', '')
}

beforeEach(() => {
  clearStripeEnv()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('billing config', () => {
  it('reports missing vars when empty', () => {
    expect(isAnyStripeEnvSet()).toBe(false)
    expect(isBillingFullyConfigured()).toBe(false)
    expect(missingStripeEnvVars()).toEqual([...STRIPE_ALL_ENV_KEYS])
  })

  it('is fully configured when all vars present', () => {
    for (const [key, value] of Object.entries(SAMPLE)) {
      vi.stubEnv(key, value)
    }
    expect(isBillingFullyConfigured()).toBe(true)
    expect(missingStripeEnvVars()).toEqual([])
  })

  it('throws on partial Stripe config', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('BILLING_REQUIRED', 'false')
    expect(() => validateStripeBillingEnv()).toThrow(/partially configured/)
  })

  it('throws when BILLING_REQUIRED and incomplete', () => {
    vi.stubEnv('BILLING_REQUIRED', 'true')
    expect(() => validateStripeBillingEnv()).toThrow(/Billing is required/)
  })

  it('allows empty Stripe when billing not required', () => {
    vi.stubEnv('BILLING_REQUIRED', 'false')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => validateStripeBillingEnv()).not.toThrow()
  })
})
