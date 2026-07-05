import { Plan, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { scanLimitForPlan } from '@/lib/billing/plans'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

export { scanLimitForPlan } from '@/lib/billing/plans'

export async function applyPlanLimits(
  userId: string,
  plan: Plan,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, auditsLimit: true, auditsUsed: true },
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
  user: { role: string; auditsUsed: number; auditsLimit: number },
  plan: Plan
): { plan: Plan; auditsLimit: number; auditsUsed: number } | null {
  if (user.role === 'admin') {
    return { plan, auditsLimit: UNLIMITED_SCAN_LIMIT, auditsUsed: user.auditsUsed }
  }

  const newLimit = scanLimitForPlan(plan)
  const cappedUsed =
    newLimit === UNLIMITED_SCAN_LIMIT
      ? user.auditsUsed
      : Math.min(user.auditsUsed, newLimit)

  return {
    plan,
    auditsLimit: newLimit,
    auditsUsed: cappedUsed,
  }
}
