import { Plan, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { deepReviewLimitForPlan, scanLimitForPlan } from '@/lib/billing/plans'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

export { deepReviewLimitForPlan, scanLimitForPlan } from '@/lib/billing/plans'

export async function applyPlanLimits(
  userId: string,
  plan: Plan,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, auditsLimit: true, auditsUsed: true, deepReviewsLimit: true, deepReviewsUsed: true },
  })
  if (!user) return

  const update = computePlanLimitUpdate(user, plan)
  if (!update) return

  await client.user.update({
    where: { id: userId },
    data: update,
  })
}

export function computePlanLimitUpdate(
  user: {
    role: string
    auditsUsed: number
    auditsLimit: number
    deepReviewsUsed: number
    deepReviewsLimit: number
  },
  plan: Plan
): {
  plan: Plan
  auditsLimit: number
  auditsUsed: number
  deepReviewsLimit: number
  deepReviewsUsed: number
} | null {
  if (user.role === 'admin') {
    return {
      plan,
      auditsLimit: UNLIMITED_SCAN_LIMIT,
      auditsUsed: user.auditsUsed,
      deepReviewsLimit: UNLIMITED_SCAN_LIMIT,
      deepReviewsUsed: user.deepReviewsUsed,
    }
  }

  const newAuditLimit = scanLimitForPlan(plan)
  const newDeepLimit = deepReviewLimitForPlan(plan)
  const cappedAuditUsed =
    newAuditLimit === UNLIMITED_SCAN_LIMIT
      ? user.auditsUsed
      : Math.min(user.auditsUsed, newAuditLimit)
  const cappedDeepUsed =
    newDeepLimit === UNLIMITED_SCAN_LIMIT
      ? user.deepReviewsUsed
      : Math.min(user.deepReviewsUsed, newDeepLimit)

  return {
    plan,
    auditsLimit: newAuditLimit,
    auditsUsed: cappedAuditUsed,
    deepReviewsLimit: newDeepLimit,
    deepReviewsUsed: cappedDeepUsed,
  }
}
