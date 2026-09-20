import type { Plan, SubscriptionStatus } from '@prisma/client'

type CareUser = {
  role: string
  plan: Plan
  subscriptionStatus: SubscriptionStatus
}

export type SiteCarePolicy = {
  maxSites: number | null
  watchIntervals: Array<'weekly' | 'daily'>
  targetedVerify: boolean
}

/** Product-level care policy. Review-credit counters never govern Watch or Verify. */
export function siteCarePolicy(user: CareUser): SiteCarePolicy {
  if (user.role === 'admin') {
    return { maxSites: null, watchIntervals: ['weekly', 'daily'], targetedVerify: true }
  }
  const revoked = ['PAST_DUE', 'CANCELED', 'UNPAID'].includes(user.subscriptionStatus)
  const effectivePlan = revoked ? 'FREE' : user.plan
  if (effectivePlan === 'FREE') {
    return { maxSites: 1, watchIntervals: ['weekly'], targetedVerify: true }
  }
  return { maxSites: null, watchIntervals: ['weekly', 'daily'], targetedVerify: true }
}
