import { prisma } from '@/lib/db'
import { decimalCost } from '@/lib/billing/costs'
import { normalizeDomain } from '@/lib/leads/normalize-domain'

export function auditPendingLeadSync(audit: { leadSyncedAt: Date | null }): boolean {
  return !audit.leadSyncedAt
}

export async function upsertLeadFromAudit(auditId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const audit = await tx.audit.findUnique({
      where: { id: auditId },
      select: {
        id: true,
        url: true,
        userId: true,
        score: true,
        normalizedDomain: true,
        source: true,
        createdAt: true,
        completedAt: true,
        leadSyncedAt: true,
        runCost: { select: { estimatedCostUsd: true } },
      },
    })
    if (!audit || !auditPendingLeadSync(audit)) return

    const domain = audit.normalizedDomain ?? normalizeDomain(audit.url)
    if (!domain) return

    const scanCostUsd = audit.runCost?.estimatedCostUsd.toNumber() ?? 0
    const now = audit.completedAt ?? new Date()
    const sourceLabel = audit.source !== 'UNKNOWN' ? audit.source.toLowerCase() : undefined

    const existing = await tx.lead.findUnique({
      where: { normalizedDomain: domain },
      select: {
        id: true,
        status: true,
        scanCount: true,
        linkedUserId: true,
        source: true,
        totalCostUsd: true,
      },
    })

    if (!existing) {
      // Status stays NEW; outbound potential is derived at read time from signup + scans.
      await tx.lead.create({
        data: {
          normalizedDomain: domain,
          firstSeenAt: audit.createdAt,
          lastSeenAt: now,
          scanCount: 1,
          status: 'NEW',
          latestScore: audit.score,
          latestAuditId: audit.id,
          latestUrl: audit.url,
          linkedUserId: audit.userId,
          source: sourceLabel,
          totalCostUsd: decimalCost(scanCostUsd),
          latestScanCostUsd: decimalCost(scanCostUsd),
        },
      })
    } else {
      const scanCount = existing.scanCount + 1
      const nextTotal = existing.totalCostUsd.toNumber() + scanCostUsd

      // Preserve existing workflow status; never auto-write QUALIFIED.
      await tx.lead.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          scanCount,
          latestScore: audit.score,
          latestAuditId: audit.id,
          latestUrl: audit.url,
          source: existing.source ?? sourceLabel,
          totalCostUsd: decimalCost(nextTotal),
          latestScanCostUsd: decimalCost(scanCostUsd),
          ...(audit.userId && !existing.linkedUserId ? { linkedUserId: audit.userId } : {}),
        },
      })
    }

    await tx.audit.update({
      where: { id: auditId },
      data: { leadSyncedAt: new Date() },
    })
  })
}
