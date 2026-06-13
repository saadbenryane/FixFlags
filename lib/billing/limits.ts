import { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import { PLAN_LIMITS } from '@/lib/stripe'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

export function scanLimitForPlan(plan: Plan): number {
  return PLAN_LIMITS[plan].audits
}

export async function applyPlanLimits(userId: string, plan: Plan): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, auditsLimit: true },
  })
  if (!user) return

  if (user.role === 'admin') {
    await prisma.user.update({
      where: { id: userId },
      data: { plan, auditsLimit: UNLIMITED_SCAN_LIMIT },
    })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      auditsLimit: scanLimitForPlan(plan),
    },
  })
}
