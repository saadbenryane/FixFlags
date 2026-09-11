import { describe, expect, it } from 'vitest'
import {
  isAttentionCandidate,
  isCustomerFlag,
  isWorthwhileAttentionFlag,
  MIN_ATTENTION_CONFIDENCE,
} from '@/lib/audit/attention'

describe('attention judgment', () => {
  it('keeps confirmed Important and Critical Flags as Attention candidates', () => {
    expect(isAttentionCandidate({ severity: 'CRITICAL' })).toBe(true)
    expect(isAttentionCandidate({ severity: 'IMPORTANT', confidence: 0.9 })).toBe(true)
  })

  it('excludes Polish, resolved, and low-confidence Flags from Attention', () => {
    expect(isAttentionCandidate({ severity: 'POLISH', confidence: 1 })).toBe(false)
    expect(isAttentionCandidate({ severity: 'IMPORTANT', status: 'FIXED' })).toBe(false)
    expect(
      isAttentionCandidate({
        severity: 'IMPORTANT',
        confidence: MIN_ATTENTION_CONFIDENCE - 0.01,
      })
    ).toBe(false)
  })

  it('requires a recommended change before a candidate becomes worthwhile Attention', () => {
    expect(
      isWorthwhileAttentionFlag({
        severity: 'CRITICAL',
        recommendedChange: '',
      })
    ).toBe(false)
    expect(
      isWorthwhileAttentionFlag({
        severity: 'CRITICAL',
        fix: '1. Change the headline\n2. Keep the offer',
      })
    ).toBe(true)
  })
})

describe('customer Flag projector', () => {
  it('treats journey-critical findings as Flags even when severity is POLISH', () => {
    expect(
      isCustomerFlag({
        severity: 'POLISH',
        impactTag: 'CONVERSION',
        checkId: 'form-contact-failed',
        confidence: 0.9,
      })
    ).toBe(true)
  })

  it('treats optional SEO metadata as a Recommendation, not a Flag', () => {
    expect(
      isCustomerFlag({
        severity: 'IMPORTANT',
        impactTag: 'SEO',
        checkId: 'title-too-long',
        confidence: 0.9,
      })
    ).toBe(false)
  })

  it('keeps broken contact and security failures as Flags', () => {
    expect(
      isCustomerFlag({
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        checkId: 'form-contact-submit-failed',
      })
    ).toBe(true)
    expect(
      isCustomerFlag({
        severity: 'CRITICAL',
        impactTag: 'TRUST',
        checkId: 'no-https',
      })
    ).toBe(true)
  })
})
