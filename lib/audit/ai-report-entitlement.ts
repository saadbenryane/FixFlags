import { prisma } from '@/lib/db'
import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { isAtCheckLimit } from '@/lib/audit/check-limit'
import { getTotalAvailableCredits, getPurchasedCreditsRemaining } from '@/lib/billing/credits'
import type { User } from '@prisma/client'

/** Whether a new audit for this user should run the LLM judge stage. */
export async function resolveIncludeAiForNewAudit(userId: string | null): Promise<boolean> {
  if (!userId) return false

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      role: true,
      auditsUsed: true,
      auditsLimit: true,
      subscriptionStatus: true,
    },
  })
  if (!user) return false
  if (hasUnlimitedScans(user) || isAdminUser(user)) return true

  const pendingAi = await prisma.audit.count({
    where: {
      userId: user.id,
      includeAi: true,
      aiReviewAt: null,
      status: { notIn: ['COMPLETED', 'FAILED'] },
    },
  })

  // A payment failure only sets subscriptionStatus (see handleInvoicePaymentFailed
  // in app/api/webhooks/stripe/route.ts) - auditsLimit can still reflect the paid
  // plan's larger quota until a separate subscription.updated event resyncs it.
  // Without this, a user with a declined card keeps getting full LLM-judge audits
  // (real per-call cost) at zero subscription revenue for however long that lag lasts.
  // A revoked subscription forfeits the plan's included AI quota entirely (matches
  // canAccessPaidFeatures / canSharePublicly, which also revoke access on a lapsed
  // subscription) - but credit packs the user separately paid real money for
  // (lib/billing/credits.ts) are a distinct transaction and remain spendable
  // regardless of subscription state, same as for a FREE-plan user below.
  const revoked = user.plan !== 'FREE' && hasRevokedSubscriptionStatus(user.subscriptionStatus)
  if (!revoked) {
    const limit = getEffectiveScanLimit(user)
    if (isUnlimitedScanLimit(limit)) return true
    if (!isAtCheckLimit(user.auditsUsed, pendingAi, limit)) return true
  }

  const purchased = await getPurchasedCreditsRemaining(user.id)
  return purchased > pendingAi
}

export async function remainingAiReportCredits(user: Pick<User, 'id' | 'auditsUsed' | 'auditsLimit' | 'role'>): Promise<number> {
  return getTotalAvailableCredits(user)
}
