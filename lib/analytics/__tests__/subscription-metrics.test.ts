import { describe, expect, it } from 'vitest'
import { subscriptionMetrics } from '@/lib/analytics/subscription-metrics'

describe('subscriptionMetrics', () => {
  it('separates activation, expansion, and churn without counting repeated status events', () => {
    const metrics = subscriptionMetrics([
      { userId: 'new', previousPlan: 'FREE', plan: 'BUILDER' },
      { userId: 'new', previousPlan: 'BUILDER', plan: 'BUILDER' },
      { userId: 'upgraded', previousPlan: 'BUILDER', plan: 'TEAM' },
      { userId: 'churned', previousPlan: 'TEAM', plan: 'FREE' },
    ], 2, true)

    expect(metrics).toMatchObject({
      newMrr: 39,
      expansionMrr: 90,
      churnedMrr: 129,
      activatedUsers: 1,
      churnedUsers: 1,
    })
    expect(metrics.churnRate).toBe(50)
  })

  it('does not invent churn before a complete collection window exists', () => {
    const metrics = subscriptionMetrics([
      { userId: 'churned', previousPlan: 'BUILDER', plan: 'FREE' },
    ], 0, false)

    expect(metrics.churnRate).toBeNull()
    expect(metrics.churnedMrr).toBe(39)
  })
})
