import { describe, expect, it } from 'vitest'
import {
  resolveProductCapabilities,
  resolveReviewCapabilities,
} from '@/lib/auth/access-policy'

describe('access policy', () => {
  it('keeps anonymous evidence visible while prompt bodies and Agent are gated', () => {
    expect(resolveReviewCapabilities({
      visibility: 'anonymous_teaser',
      isAuthenticated: false,
    })).toMatchObject({
      canViewEvidence: true,
      canViewPromptBodies: false,
      canUseAgent: false,
      canClaim: true,
    })
  })

  it('grants lifecycle operations only to the owner', () => {
    expect(resolveReviewCapabilities({
      visibility: 'owner',
      isAuthenticated: true,
    })).toMatchObject({
      canViewPromptBodies: true,
      canUseAgent: true,
      canRunUpdateReview: true,
      canMutateLifecycle: true,
    })
    expect(resolveReviewCapabilities({
      visibility: 'share_grant',
      isAuthenticated: true,
    }).canMutateLifecycle).toBe(false)
  })

  it('allows one curated demonstration without enabling live Agent operations', () => {
    expect(resolveReviewCapabilities({
      visibility: 'curated_sample',
      isAuthenticated: false,
    })).toMatchObject({
      canViewEvidence: true,
      canViewPromptBodies: true,
      canUseAgent: false,
      canClaim: true,
    })
  })

  it('keeps Watch separate from basic Product ownership', () => {
    const free = resolveProductCapabilities({
      role: 'user',
      plan: 'FREE',
      subscriptionStatus: 'NONE',
    } as never)
    const team = resolveProductCapabilities({
      role: 'user',
      plan: 'TEAM',
      subscriptionStatus: 'ACTIVE',
    } as never)
    expect(free).toMatchObject({ canView: true, canUseWatch: false })
    expect(team).toMatchObject({ canView: true, canUseWatch: true })
  })
})
