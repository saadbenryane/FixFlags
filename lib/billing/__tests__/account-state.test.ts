import { describe, expect, it } from 'vitest'
import { billingAccountState } from '@/lib/billing/account-state'

const base = {
  plan: 'FREE',
  subscriptionStatus: 'NONE' as const,
  paidCheckoutOpen: false,
  waitlisted: false,
}

describe('billing account state', () => {
  it('uses persisted subscription facts and never a navigation hint', () => {
    expect(billingAccountState(base)).toBe('free')
    expect(billingAccountState({ ...base, waitlisted: true })).toBe('waitlisted')
    expect(billingAccountState({ ...base, paidCheckoutOpen: true })).toBe('checkout_available')
    expect(billingAccountState({ ...base, paidCheckoutOpen: true, waitlisted: true })).toBe('checkout_available')
    expect(billingAccountState({ ...base, activationPending: true })).toBe('pending_activation')
    expect(billingAccountState({ ...base, plan: 'BUILDER', subscriptionStatus: 'ACTIVE' })).toBe('active')
    expect(billingAccountState({ ...base, plan: 'BUILDER', subscriptionStatus: 'TRIALING' })).toBe('active')
    expect(billingAccountState({ ...base, plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' })).toBe('past_due')
    expect(billingAccountState({ ...base, plan: 'BUILDER', subscriptionStatus: 'UNPAID', waitlisted: true })).toBe('past_due')
    expect(billingAccountState({ ...base, plan: 'BUILDER', subscriptionStatus: 'CANCELED' })).toBe('canceled')
    expect(billingAccountState({ ...base, plan: 'BUILDER', subscriptionStatus: 'NONE' })).toBe('free')
  })
})
