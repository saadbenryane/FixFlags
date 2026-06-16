import { prisma } from '@/lib/db'
import { decimalCost } from '@/lib/billing/costs'
import { normalizeDomain } from '@/lib/leads/normalize-domain'
import { shouldAutoQualifyLead } from '@/lib/leads/qualify'

export async function upsertLeadFromAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
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
      runCost: { select: { estimatedCostUsd: true } },
    },
  })
  if (!audit) return

  const domain = audit.normalizedDomain ?? normalizeDomain(audit.url)
  if (!domain) return

  const scanCostUsd = audit.runCost?.estimatedCostUsd.toNumber() ?? 0
  const now = audit.completedAt ?? new Date()
  const sourceLabel = audit.source !== 'UNKNOWN' ? audit.source.toLowerCase() : undefined

  const existing = await prisma.lead.findUnique({
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
    const scanCount = 1
    const status = shouldAutoQualifyLead({ status: 'NEW', scanCount, latestScore: audit.score })
      ? 'QUALIFIED'
      : 'NEW'

    await prisma.lead.create({
      data: {
        normalizedDomain: domain,
        firstSeenAt: audit.createdAt,
        lastSeenAt: now,
        scanCount,
        status,
        latestScore: audit.score,
        latestAuditId: audit.id,
        latestUrl: audit.url,
        linkedUserId: audit.userId,
        source: sourceLabel,
        totalCostUsd: decimalCost(scanCostUsd),
        latestScanCostUsd: decimalCost(scanCostUsd),
      },
    })
    return
  }

  const scanCount = existing.scanCount + 1
  const nextStatus = shouldAutoQualifyLead({
    status: existing.status,
    scanCount,
    latestScore: audit.score,
  })
    ? 'QUALIFIED'
    : existing.status

  const nextTotal = existing.totalCostUsd.toNumber() + scanCostUsd

  await prisma.lead.update({
    where: { id: existing.id },
    data: {
      lastSeenAt: now,
      scanCount,
      status: nextStatus,
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
