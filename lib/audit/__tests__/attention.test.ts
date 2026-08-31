import { describe, expect, it } from 'vitest'
import {
  isAttentionCandidate,
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
