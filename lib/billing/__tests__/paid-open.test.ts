import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isBatchReleased,
  isPaidCheckoutGatedClient,
  isPaidOpenClient,
  isPaidOpenServer,
  openBatch,
} from '@/lib/billing/paid-open'

const BILLING_ENV_KEYS = [
  'STRIPE_PAID_OPEN',
  'NEXT_PUBLIC_PAID_OPEN',
  'WAITLIST_OPEN_BATCH',
] as const

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('paid-open gates', () => {
  it('mirrors the paid-open master switch across server and client env', () => {
    vi.stubEnv('STRIPE_PAID_OPEN', 'true')
    vi.stubEnv('NEXT_PUBLIC_PAID_OPEN', 'true')
    expect(isPaidOpenServer()).toBe(true)
    expect(isPaidOpenClient()).toBe(true)
    expect(isPaidCheckoutGatedClient()).toBe(false)
  })

  it('gates checkout when the client flag is not set', () => {
    for (const key of BILLING_ENV_KEYS) vi.stubEnv(key, '')
    expect(isPaidOpenServer()).toBe(false)
    expect(isPaidOpenClient()).toBe(false)
    expect(isPaidCheckoutGatedClient()).toBe(true)
  })
})

describe('openBatch', () => {
  it('returns 0 when unset or invalid', () => {
    for (const key of BILLING_ENV_KEYS) vi.stubEnv(key, '')
    expect(openBatch()).toBe(0)
    vi.stubEnv('WAITLIST_OPEN_BATCH', 'abc')
    expect(openBatch()).toBe(0)
    vi.stubEnv('WAITLIST_OPEN_BATCH', '0')
    expect(openBatch()).toBe(0)
    vi.stubEnv('WAITLIST_OPEN_BATCH', '-3')
    expect(openBatch()).toBe(0)
  })

  it('parses a positive released batch', () => {
    vi.stubEnv('WAITLIST_OPEN_BATCH', '2')
    expect(openBatch()).toBe(2)
  })
})

describe('isBatchReleased', () => {
  it('never releases members without a batch number', () => {
    vi.stubEnv('WAITLIST_OPEN_BATCH', '2')
    expect(isBatchReleased(null)).toBe(false)
    expect(isBatchReleased(undefined)).toBe(false)
    expect(isBatchReleased(0)).toBe(false)
    expect(isBatchReleased(-1)).toBe(false)
  })

  it('releases members whose batch is at or below the open batch', () => {
    vi.stubEnv('WAITLIST_OPEN_BATCH', '2')
    expect(isBatchReleased(1)).toBe(true)
    expect(isBatchReleased(2)).toBe(true)
    expect(isBatchReleased(3)).toBe(false)
  })

  it('keeps everyone locked when no batch is open', () => {
    vi.stubEnv('WAITLIST_OPEN_BATCH', '')
    expect(isBatchReleased(1)).toBe(false)
  })
})
