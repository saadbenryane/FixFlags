import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  ANON_AUDIT_IDS_COOKIE,
  incrementUsageOnCompleteForAudit,
  readAnonAuditIds,
} from '@/lib/audit/usage'
import { remainingAiReportCredits } from '@/lib/audit/ai-report-entitlement'
import { enqueueAiReview } from '@/lib/audit/enqueue-ai-review'
import { hasUnlimitedScans } from '@/lib/auth/permissions'
import {
  canonicalProductHost,
  canonicalProductUrl,
  mergeContractIntoProductIntelligence,
  parseProductIntelligence,
  productNameFromUrl,
} from '@/lib/audit/product-intelligence'
import { parseProductContract } from '@/lib/audit/product-contract'

export async function claimAnonymousAudits(userId: string): Promise<number> {
  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)
  if (ids.length === 0) return 0

  const audits = await prisma.$transaction(
    async (tx) => {
      const claimable = await tx.audit.findMany({
        where: {
          id: { in: ids },
          OR: [{ userId: null }, { userId }],
        },
        select: {
          id: true,
          status: true,
          aiReviewAt: true,
          skipUsageCount: true,
          usageCountedAt: true,
          url: true,
          projectId: true,
          productContract: true,
        },
      })

      for (const audit of claimable) {
        const canonicalHost = canonicalProductHost(audit.url)
        if (!canonicalHost) throw new Error(`Cannot attach Product for audit ${audit.id}`)
        const project = audit.projectId
          ? await tx.project.findUnique({
              where: { id: audit.projectId },
              select: { id: true, productIntelligence: true },
            })
          : await tx.project.upsert({
              where: { userId_canonicalHost: { userId, canonicalHost } },
              create: {
                userId,
                name: productNameFromUrl(audit.url),
                url: canonicalProductUrl(audit.url),
                canonicalHost,
                isManaged: false,
              },
              update: { url: canonicalProductUrl(audit.url) },
              select: { id: true, productIntelligence: true },
            })
        if (!project) throw new Error(`Cannot attach Product for audit ${audit.id}`)

        const contract = parseProductContract(audit.productContract)
        if (contract) {
          const next = mergeContractIntoProductIntelligence(
            parseProductIntelligence(project.productIntelligence),
            contract
          )
          await tx.project.update({
            where: { id: project.id },
            data: {
              productIntelligence: next as unknown as Prisma.InputJsonObject,
              productIntelligenceRevision: { increment: 1 },
            },
          })
        }

        await tx.audit.update({
          where: { id: audit.id },
          data: { userId, projectId: project.id },
        })
      }
      return claimable
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  if (audits.length === 0) {
    cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
    return 0
  }

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
      // Enqueue first. Only mark includeAi after the job is accepted so a dead
      // queue cannot leave the report stuck on "Fix prompts generating".
      await enqueueAiReview(auditId)
      await prisma.audit.update({ where: { id: auditId }, data: { includeAi: true } })
      credits -= 1
    }
  } else if (user && hasUnlimitedScans(user)) {
    for (const audit of audits.filter((a) => a.status === 'COMPLETED' && !a.aiReviewAt)) {
      await enqueueAiReview(audit.id)
      await prisma.audit.update({ where: { id: audit.id }, data: { includeAi: true } })
    }
  }

  // Delete only after every critical stage succeeds. Ownership, usage, and
  // enqueue operations are idempotent, so a queue failure can safely retry.
  cookieStore.delete(ANON_AUDIT_IDS_COOKIE)
  return audits.length
}
