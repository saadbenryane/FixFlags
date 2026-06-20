import { prisma } from '@/lib/db'
import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { isAtCheckLimit } from '@/lib/audit/check-limit'
import { getTotalAvailableCredits, getPurchasedCreditsRemaining } from '@/lib/billing/credits'
import type { User } from '@prisma/client'

/** Whether a new audit for this user should run the LLM judge stage. */
export async function resolveIncludeAiForNewAudit(userId: string | null): Promise<boolean> {
  if (!userId) return false

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true, role: true, auditsUsed: true, auditsLimit: true },
  })
  if (!user) return false
  if (hasUnlimitedScans(user) || isAdminUser(user)) return true

  const limit = getEffectiveScanLimit(user)
  if (isUnlimitedScanLimit(limit)) return true

  const pendingAi = await prisma.audit.count({
    where: {
      userId: user.id,
      includeAi: true,
      aiReviewAt: null,
      status: { notIn: ['COMPLETED', 'FAILED'] },
    },
  })

  if (!isAtCheckLimit(user.auditsUsed, pendingAi, limit)) return true

  const purchased = await getPurchasedCreditsRemaining(user.id)
  return purchased > pendingAi
}

export async function remainingAiReportCredits(user: Pick<User, 'id' | 'auditsUsed' | 'auditsLimit' | 'role'>): Promise<number> {
  return getTotalAvailableCredits(user)
}
