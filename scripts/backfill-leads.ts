/**
 * Backfill Lead rows from completed audits grouped by domain.
 * Usage: npm run backfill:leads
 */
import { PrismaClient } from '@prisma/client'
import { decimalCost, sumEstimatedCostForDomain } from '../lib/billing/costs'
import { mergeLeadStatusOnBackfill } from '../lib/leads/merge-status'
import { normalizeDomain } from '../lib/leads/normalize-domain'
import { shouldAutoQualifyLead } from '../lib/leads/qualify'

const prisma = new PrismaClient()

async function backfillAuditDomains() {
  const audits = await prisma.audit.findMany({
    where: { status: 'COMPLETED', normalizedDomain: null },
    select: { id: true, url: true },
  })

  let updated = 0
  for (const audit of audits) {
    const domain = normalizeDomain(audit.url)
    if (!domain) continue
    await prisma.audit.update({
      where: { id: audit.id },
      data: { normalizedDomain: domain },
    })
    updated++
  }
  console.log(`Backfilled normalizedDomain on ${updated} audits`)
}

async function main() {
  await backfillAuditDomains()

  const audits = await prisma.audit.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'asc' },
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

  const byDomain = new Map<
    string,
    {
      firstSeenAt: Date
      lastSeenAt: Date
      scanCount: number
      latestScore: number | null
      latestAuditId: string
      latestUrl: string
      linkedUserId: string | null
      source: string | undefined
      totalCostUsd: number
      latestScanCostUsd: number
      auditIds: string[]
    }
  >()

  for (const audit of audits) {
    const domain = audit.normalizedDomain ?? normalizeDomain(audit.url)
    if (!domain) continue

    const lastSeenAt = audit.completedAt ?? audit.createdAt
    const sourceLabel = audit.source !== 'UNKNOWN' ? audit.source.toLowerCase() : undefined
    const scanCostUsd = audit.runCost?.estimatedCostUsd.toNumber() ?? 0
    const existing = byDomain.get(domain)

    if (!existing) {
      byDomain.set(domain, {
        firstSeenAt: audit.createdAt,
        lastSeenAt,
        scanCount: 1,
        latestScore: audit.score,
        latestAuditId: audit.id,
        latestUrl: audit.url,
        linkedUserId: audit.userId,
        source: sourceLabel,
        totalCostUsd: scanCostUsd,
        latestScanCostUsd: scanCostUsd,
        auditIds: [audit.id],
      })
      continue
    }

    existing.scanCount += 1
    existing.totalCostUsd += scanCostUsd
    existing.auditIds.push(audit.id)
    if (lastSeenAt >= existing.lastSeenAt) {
      existing.lastSeenAt = lastSeenAt
      existing.latestScore = audit.score
      existing.latestAuditId = audit.id
      existing.latestUrl = audit.url
      existing.latestScanCostUsd = scanCostUsd
    }
    if (audit.userId && !existing.linkedUserId) {
      existing.linkedUserId = audit.userId
    }
    if (!existing.source && sourceLabel) {
      existing.source = sourceLabel
    }
  }

  let created = 0
  let updated = 0

  for (const [normalizedDomain, data] of byDomain) {
    const existingLead = await prisma.lead.findUnique({
      where: { normalizedDomain },
      select: { status: true },
    })

    const freshStatus = shouldAutoQualifyLead({
      status: 'NEW',
      scanCount: data.scanCount,
      latestScore: data.latestScore,
    })
      ? 'QUALIFIED'
      : 'NEW'

    const status = existingLead
      ? mergeLeadStatusOnBackfill({
          currentStatus: existingLead.status,
          scanCount: data.scanCount,
          latestScore: data.latestScore,
        })
      : freshStatus

    const verifiedCost = await sumEstimatedCostForDomain(normalizedDomain)

    const result = await prisma.lead.upsert({
      where: { normalizedDomain },
      create: {
        normalizedDomain,
        firstSeenAt: data.firstSeenAt,
        lastSeenAt: data.lastSeenAt,
        scanCount: data.scanCount,
        latestScore: data.latestScore,
        latestAuditId: data.latestAuditId,
        latestUrl: data.latestUrl,
        linkedUserId: data.linkedUserId,
        source: data.source,
        status,
        totalCostUsd: decimalCost(verifiedCost || data.totalCostUsd),
        latestScanCostUsd: decimalCost(data.latestScanCostUsd),
      },
      update: {
        firstSeenAt: data.firstSeenAt,
        lastSeenAt: data.lastSeenAt,
        scanCount: data.scanCount,
        latestScore: data.latestScore,
        latestAuditId: data.latestAuditId,
        latestUrl: data.latestUrl,
        linkedUserId: data.linkedUserId,
        source: data.source,
        status,
        totalCostUsd: decimalCost(verifiedCost || data.totalCostUsd),
        latestScanCostUsd: decimalCost(data.latestScanCostUsd),
      },
    })

    await prisma.audit.updateMany({
      where: { id: { in: data.auditIds }, leadSyncedAt: null },
      data: { leadSyncedAt: new Date() },
    })

    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++
    else updated++
  }

  console.log(`Backfill complete: ${created} created, ${updated} updated (${byDomain.size} domains)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
