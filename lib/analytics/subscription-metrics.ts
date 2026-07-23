import type { Plan } from '@prisma/client'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'

interface SubscriptionTransition {
  userId: string
  previousPlan: Plan | null
  plan: Plan
}

function planMrr(plan: Plan): number {
  return Number(PLAN_DEFINITIONS[plan].price.replace(/[^0-9.]/g, '')) || 0
}

export function subscriptionMetrics(
  transitions: SubscriptionTransition[],
  currentPaidUsers: number,
  hasCompleteWindow: boolean,
) {
  const priced = transitions
    .filter((event): event is SubscriptionTransition & { previousPlan: Plan } =>
      event.previousPlan !== null && event.previousPlan !== event.plan,
    )
    .map((event) => ({
      ...event,
      previousMrr: planMrr(event.previousPlan),
      nextMrr: planMrr(event.plan),
    }))
  const activations = priced.filter(
    (event) => event.previousPlan === 'FREE' && event.plan !== 'FREE',
  )
  const cancellations = priced.filter(
    (event) => event.previousPlan !== 'FREE' && event.plan === 'FREE',
  )
  const newMrr = activations.reduce((sum, event) => sum + event.nextMrr, 0)
  const expansionMrr = priced
    .filter((event) => event.previousPlan !== 'FREE' && event.plan !== 'FREE')
    .reduce((sum, event) => sum + Math.max(0, event.nextMrr - event.previousMrr), 0)
  const churnedMrr = cancellations.reduce((sum, event) => sum + event.previousMrr, 0)
  const activatedUsers = new Set(activations.map((event) => event.userId)).size
  const churnedUsers = new Set(cancellations.map((event) => event.userId)).size
  const openingPaidUsers = Math.max(0, currentPaidUsers - activatedUsers + churnedUsers)

  return {
    newMrr,
    expansionMrr,
    churnedMrr,
    activatedUsers,
    churnedUsers,
    churnRate: hasCompleteWindow && openingPaidUsers > 0
      ? (churnedUsers / openingPaidUsers) * 100
      : null,
  }
}
