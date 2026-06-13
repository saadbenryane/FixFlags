import { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import { scanLimitForPlan } from '@/lib/billing/plans'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

export { scanLimitForPlan } from '@/lib/billing/plans'

export async function applyPlanLimits(userId: string, plan: Plan): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, auditsLimit: true, auditsUsed: true },
  })
  if (!user) return

  if (user.role === 'admin') {
    await prisma.user.update({
      where: { id: userId },
      data: { plan, auditsLimit: UNLIMITED_SCAN_LIMIT },
    })
    return
  }

  const newLimit = scanLimitForPlan(plan)
  const cappedUsed =
    newLimit === UNLIMITED_SCAN_LIMIT
      ? user.auditsUsed
      : Math.min(user.auditsUsed, newLimit)

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      auditsLimit: newLimit,
      auditsUsed: cappedUsed,
    },
  })
}
