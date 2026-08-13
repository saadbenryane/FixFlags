import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isBillingFullyConfigured,
  isAnyStripeEnvSet,
  missingStripeEnvVars,
  validateStripeBillingEnv,
  STRIPE_ALL_ENV_KEYS,
} from '@/lib/billing/config'
import { envPriceId, envPriceUsd } from '@/lib/billing/env'

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

describe('billing env helpers', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('STRIPE_BUILDER_PRICE_ID', '')
    vi.stubEnv('STRIPE_TEAM_PRICE_ID', '')
    vi.stubEnv('STRIPE_BUILDER_PRICE_USD', '')
    vi.stubEnv('STRIPE_TEAM_PRICE_USD', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('envPriceId', () => {
    it('returns undefined for missing env var', () => {
      expect(envPriceId('STRIPE_BUILDER_PRICE_ID')).toBeUndefined()
    })

    it('returns undefined for empty string env var', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_ID', '')
      expect(envPriceId('STRIPE_BUILDER_PRICE_ID')).toBeUndefined()
    })

    it('returns the value when set', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_ID', 'price_builder_123')
      expect(envPriceId('STRIPE_BUILDER_PRICE_ID')).toBe('price_builder_123')
    })
  })

  describe('envPriceUsd', () => {
    it('returns fallback for missing env var', () => {
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(29)
    })

    it('returns fallback for empty string env var', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_USD', '')
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(29)
    })

    it('returns fallback for non-numeric value', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_USD', 'not-a-number')
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(29)
    })

    it('returns fallback for zero', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_USD', '0')
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(29)
    })

    it('returns fallback for negative number', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_USD', '-5')
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(29)
    })

    it('returns parsed value when valid', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_USD', '49')
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(49)
    })

    it('returns parsed float value', () => {
      vi.stubEnv('STRIPE_BUILDER_PRICE_USD', '29.99')
      expect(envPriceUsd('STRIPE_BUILDER_PRICE_USD', 29)).toBe(29.99)
    })
  })
})
