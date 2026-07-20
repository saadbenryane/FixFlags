import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import {
  ANON_AUDIT_IDS_COOKIE,
  incrementUsageOnCompleteForAudit,
  readAnonAuditIds,
} from '@/lib/audit/usage'
import { remainingAiReportCredits } from '@/lib/audit/ai-report-entitlement'
import { enqueueAiReview } from '@/lib/audit/enqueue-ai-review'
import { hasUnlimitedScans } from '@/lib/auth/permissions'

export async function claimAnonymousAudits(userId: string): Promise<number> {
  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length === 0) return 0

  const audits = await prisma.audit.findMany({
    where: {
      id: { in: ids },
      userId: null,
    },
    select: {
      id: true,
      status: true,
      aiReviewAt: true,
      skipUsageCount: true,
      usageCountedAt: true,
    },
  })

  if (audits.length === 0) {
    cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
    return 0
  }

  await prisma.audit.updateMany({
    where: { id: { in: audits.map((a) => a.id) } },
    data: { userId },
  })

  // Claimed teasers count toward Free lifetime quota (idempotent via usageCountedAt).
  for (const audit of audits) {
    if (audit.skipUsageCount || audit.usageCountedAt) continue
    if (audit.status === 'COMPLETED') {
      await incrementUsageOnCompleteForAudit(audit.id, userId)
    }
    // In-flight audits: finalize will count when COMPLETED with userId set.
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, auditsUsed: true, auditsLimit: true },
  })

  if (user && !hasUnlimitedScans(user)) {
    let credits = await remainingAiReportCredits(user)
    const unlockCandidates = audits
      .filter((a) => a.status === 'COMPLETED' && !a.aiReviewAt)
      .map((a) => a.id)

    for (const auditId of unlockCandidates) {
      if (credits <= 0) break
      try {
        // Enqueue first. Only mark includeAi after the job is accepted so a dead
        // queue cannot leave the report stuck on "Fix prompts generating".
        await enqueueAiReview(auditId)
        await prisma.audit.update({
          where: { id: auditId },
          data: { includeAi: true },
        })
        credits -= 1
      } catch {
        // queue unavailable or duplicate job; skip
      }
    }
  } else if (user && hasUnlimitedScans(user)) {
    for (const audit of audits.filter((a) => a.status === 'COMPLETED' && !a.aiReviewAt)) {
      try {
        await enqueueAiReview(audit.id)
        await prisma.audit.update({
          where: { id: audit.id },
          data: { includeAi: true },
        })
      } catch {
        // skip
      }
    }
  }

  cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
  return audits.length
}
