import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { ANON_AUDIT_IDS_COOKIE } from '@/lib/audit/usage'
import { remainingAiReportCredits } from '@/lib/audit/ai-report-entitlement'
import { enqueueAiReview } from '@/lib/audit/enqueue-ai-review'
import { hasUnlimitedScans } from '@/lib/auth/permissions'

function readAnonAuditIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export async function claimAnonymousAudits(userId: string): Promise<number> {
  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length === 0) return 0

  const audits = await prisma.audit.findMany({
    where: {
      id: { in: ids },
      userId: null,
    },
    select: { id: true, status: true, aiReviewAt: true },
  })

  if (audits.length === 0) {
    cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
    return 0
  }

  await prisma.audit.updateMany({
    where: { id: { in: audits.map((a) => a.id) } },
    data: { userId },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, auditsUsed: true, auditsLimit: true },
  })

  if (user && !hasUnlimitedScans(user)) {
    let credits = remainingAiReportCredits(user)
    const unlockCandidates = audits
      .filter((a) => a.status === 'COMPLETED' && !a.aiReviewAt)
      .map((a) => a.id)

    for (const auditId of unlockCandidates) {
      if (credits <= 0) break
      try {
        await enqueueAiReview(auditId)
        credits -= 1
      } catch {
        // queue unavailable or duplicate job; skip
      }
    }
  } else if (user && hasUnlimitedScans(user)) {
    for (const audit of audits.filter((a) => a.status === 'COMPLETED' && !a.aiReviewAt)) {
      try {
        await enqueueAiReview(audit.id)
      } catch {
        // skip
      }
    }
  }

  cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
  return audits.length
}
