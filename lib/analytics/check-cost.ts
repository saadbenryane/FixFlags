import { prisma } from '@/lib/db'

/**
 * Measured cost per check and per active Site over a window, from recorded run costs.
 * Runs without a recorded cost are counted as missing, never as free.
 */
export type CostDistribution = { count: number; missing: number; medianUsd: number | null; p90Usd: number | null; totalUsd: number }
export type CheckCostSummary = { anonymousFirstCheck: CostDistribution; ownedCheck: CostDistribution; perActiveSite: CostDistribution; windowDays: number }

type CostRow = { userId: string | null; parentId: string | null; projectId: string | null; costUsd: number | null }

function percentile(sorted: number[], ratio: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] : null
}

export function distribution(values: readonly (number | null)[]): CostDistribution {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).toSorted((a, b) => a - b)
  return {
    count: values.length,
    missing: values.length - known.length,
    medianUsd: percentile(known, 0.5),
    p90Usd: percentile(known, 0.9),
    totalUsd: known.reduce((sum, value) => sum + value, 0),
  }
}

export function summarizeCheckCosts(rows: readonly CostRow[], windowDays: number): CheckCostSummary {
  const anonymous = rows.filter(row => row.userId === null && row.parentId === null)
  const owned = rows.filter(row => row.userId !== null)
  const perSite = new Map<string, number | null>()
  for (const row of owned) {
    if (!row.projectId) continue
    const current = perSite.get(row.projectId)
    // A Site with any unmeasured run has an unknown total.
    perSite.set(row.projectId, current === null || row.costUsd === null ? null : (current ?? 0) + row.costUsd)
  }
  return {
    anonymousFirstCheck: distribution(anonymous.map(row => row.costUsd)),
    ownedCheck: distribution(owned.map(row => row.costUsd)),
    perActiveSite: distribution([...perSite.values()]),
    windowDays,
  }
}

export async function loadCheckCostSummary(since: Date, windowDays: number): Promise<CheckCostSummary> {
  const audits = await prisma.audit.findMany({
    where: { createdAt: { gte: since }, status: 'COMPLETED' },
    select: { userId: true, parentId: true, projectId: true, runCost: { select: { estimatedCostUsd: true } } },
    take: 20_000,
  })
  return summarizeCheckCosts(audits.map(audit => ({
    userId: audit.userId, parentId: audit.parentId, projectId: audit.projectId,
    costUsd: audit.runCost?.estimatedCostUsd == null ? null : Number(audit.runCost.estimatedCostUsd),
  })), windowDays)
}
