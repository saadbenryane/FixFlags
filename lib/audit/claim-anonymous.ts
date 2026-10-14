import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  clearAnonymousAuditCookie,
  incrementUsageOnCompleteForAudit,
  readClaimedAnonymousIds,
} from '@/lib/audit/usage'
import { remainingAiReportCredits } from '@/lib/audit/ai-report-entitlement'
import { enqueueAiReview } from '@/lib/audit/enqueue-ai-review'
import { hasUnlimitedScans } from '@/lib/auth/permissions'
import {
  canonicalProductHost,
  mergeContractIntoProductIntelligence,
  parseProductIntelligence,
  productNameFromUrl,
} from '@/lib/audit/product-intelligence'
import { parseProductContract } from '@/lib/audit/product-contract'
import { assertCanCreateProduct } from '@/lib/billing/product-capacity'
import { claimProvisionalSitesForProject, migrateProvisionalSiteDataToProject } from '@/lib/sites/ensure-site'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { productTransaction } from '@/lib/billing/product-transaction'
import { ensureDefaultMonitoring } from '@/lib/sites/application/default-monitoring'

async function unlockClaimedAudit(audit: {
  id: string
  status: string
  aiReviewAt: Date | null
}): Promise<void> {
  if (audit.aiReviewAt) return

  if (audit.status === 'COMPLETED') {
    // Enqueue first for completed audits. A queue failure leaves includeAi
    // unchanged, so the claim remains safely retryable.
    await enqueueAiReview(audit.id)
    await prisma.audit.update({ where: { id: audit.id }, data: { includeAi: true } })
    return
  }

  // The runner may already have copied includeAi into memory. Persist the
  // entitlement now, then let finalization re-read it before enqueueing.
  await prisma.audit.update({ where: { id: audit.id }, data: { includeAi: true } })

  // Close the race where this audit completed between the transaction above
  // and the includeAi update. Queue job IDs are stable, so this remains
  // idempotent with the finalizer.
  const latest = await prisma.audit.findUnique({
    where: { id: audit.id },
    select: { status: true, aiReviewAt: true },
  })
  if (latest?.status === 'COMPLETED' && !latest.aiReviewAt) {
    await enqueueAiReview(audit.id)
  }
}

export async function claimAnonymousAudits(userId: string): Promise<number> {
  const ids = await readClaimedAnonymousIds()
  if (ids.length === 0) return 0

  const { audits, claimedProjects } = await productTransaction(
    async (tx) => {
      const claimable = await tx.audit.findMany({
        where: {
          id: { in: ids },
          OR: [{ userId: null }, { userId }],
        },
        select: {
          id: true,
          userId: true,
          status: true,
          aiReviewAt: true,
          skipUsageCount: true,
          usageCountedAt: true,
          url: true,
          projectId: true,
          productContract: true,
        },
      })

      const projects = new Map<string, { id: string; canonicalHost: string; auditIds: string[] }>()
      for (const audit of claimable) {
        const canonicalHost = canonicalProductHost(audit.url)
        if (!canonicalHost) throw new Error(`Cannot attach Product for audit ${audit.id}`)
        let project = audit.projectId
          ? await tx.project.findUnique({
              where: { id: audit.projectId },
              select: { id: true, userId: true, productIntelligence: true, deletedAt: true },
            })
          : await tx.project.findUnique({
              where: { userId_canonicalHost: { userId, canonicalHost } },
              select: { id: true, userId: true, productIntelligence: true, deletedAt: true },
            })
        // A report claim proves possession of this report, not authority over
        // a linked Site whose ownership may have changed since the first claim.
        if (audit.projectId && project?.userId !== userId) {
          throw new Error('Site is no longer owned by this account')
        }
        if (project?.deletedAt) {
          await assertCanCreateProduct(tx, userId)
          await tx.project.update({ where: { id: project.id }, data: { deletedAt: null } })
        }
        if (!project) {
          await assertCanCreateProduct(tx, userId)
          project = await tx.project.upsert({
              where: { userId_canonicalHost: { userId, canonicalHost } },
              create: {
                userId,
                name: productNameFromUrl(audit.url),
                url: new URL(audit.url).origin,
                canonicalHost,
                isManaged: false,
              },
              update: { deletedAt: null },
              select: { id: true, userId: true, productIntelligence: true, deletedAt: true },
            })
        }
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
        const claimed = projects.get(project.id) ?? { id: project.id, canonicalHost, auditIds: [] }
        claimed.auditIds.push(audit.id)
        projects.set(project.id, claimed)
      }
      for (const project of projects.values()) {
        const input = { userId, projectId: project.id, canonicalHost: project.canonicalHost, primaryAuditIds: project.auditIds }
        await claimProvisionalSitesForProject(input, tx)
        await migrateProvisionalSiteDataToProject(input, tx)
        // Identity, bindings and defaults become visible together. An interrupted
        // migration rolls back the claim rather than publishing an empty Site.
        await ensureDefaultMonitoring(tx, project.id, userId)
      }
      return { audits: claimable, claimedProjects: [...projects.values()] }
    }
  )

  const newlyClaimedIds = new Set(audits.filter((audit) => audit.userId === null).map((audit) => audit.id))
  for (const project of claimedProjects) {
    for (const auditId of project.auditIds) {
      // A retry of an older claim cannot establish its original transition time.
      if (!newlyClaimedIds.has(auditId)) continue
      await recordSiteLifecycleEvent({
        name: 'analysis_claimed',
        idempotencyKey: `analysis_claimed:${auditId}`,
        userId,
        projectId: project.id,
      }).catch(() => undefined)
    }
    await recordSiteLifecycleEvent({
      name: 'site_claimed',
      idempotencyKey: `site_claimed:${userId}:${project.id}`,
      userId,
      projectId: project.id,
      properties: { auditCount: project.auditIds.length },
    }).catch(() => undefined)
  }

  if (audits.length === 0) {
    await clearAnonymousAuditCookie()
    return 0
  }


  // Claimed teasers count once toward the active monthly quota (idempotent via usageCountedAt).
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
    const unlockCandidates = audits.filter((audit) => !audit.aiReviewAt)

    for (const audit of unlockCandidates) {
      if (credits <= 0) break
      await unlockClaimedAudit(audit)
      credits -= 1
    }
  } else if (user && hasUnlimitedScans(user)) {
    for (const audit of audits.filter((candidate) => !candidate.aiReviewAt)) {
      await unlockClaimedAudit(audit)
    }
  }

  // Delete only after every critical stage succeeds. Ownership, usage, and
  // enqueue operations are idempotent, so a queue failure can safely retry.
  await clearAnonymousAuditCookie()
  return audits.length
}
