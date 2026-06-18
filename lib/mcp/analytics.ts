import { prisma } from '@/lib/db'

export interface McpAnalyticsSnapshot {
  total: number
  last7d: number
  last30d: number
  successful: number
  failed: number
  successRate: number
  avgDuration: number | null
  recentFailures: Array<{
    method: string
    tool: string | null
    errorCode: string | null
    createdAt: Date
    durationMs: number | null
  }>
  toolCounts: Array<{ tool: string | null; count: number; pct: number }>
}

export function computeSuccessRate(successful: number, failed: number): number {
  const total = successful + failed
  if (total === 0) return 0
  return Math.round((successful / total) * 100)
}

export function computeToolUsagePct(count: number, maxCount: number): number {
  if (maxCount <= 0) return 0
  return Math.round((count / maxCount) * 100)
}

export async function loadMcpAnalytics(userId: string): Promise<McpAnalyticsSnapshot> {
  const now = new Date()
  const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [total, last7d, last30d, successful, failed, recentFailures, toolCounts] =
    await Promise.all([
      prisma.mcpInteraction.count({ where: { userId } }),
      prisma.mcpInteraction.count({ where: { userId, createdAt: { gte: days7 } } }),
      prisma.mcpInteraction.count({ where: { userId, createdAt: { gte: days30 } } }),
      prisma.mcpInteraction.count({ where: { userId, success: true } }),
      prisma.mcpInteraction.count({ where: { userId, success: false } }),
      prisma.mcpInteraction.findMany({
        where: { userId, success: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { method: true, tool: true, errorCode: true, createdAt: true, durationMs: true },
      }),
      prisma.mcpInteraction.groupBy({
        by: ['tool'],
        where: { userId, tool: { not: null } },
        _count: true,
        orderBy: { _count: { tool: 'desc' } },
      }),
    ])

  const avgDurationResult = await prisma.mcpInteraction.aggregate({
    where: { userId, durationMs: { not: null } },
    _avg: { durationMs: true },
  })

  const maxToolCount = Math.max(...toolCounts.map((t) => t._count), 1)

  return {
    total,
    last7d,
    last30d,
    successful,
    failed,
    successRate: computeSuccessRate(successful, failed),
    avgDuration: avgDurationResult._avg.durationMs
      ? Math.round(avgDurationResult._avg.durationMs)
      : null,
    recentFailures,
    toolCounts: toolCounts.map((t) => ({
      tool: t.tool,
      count: t._count,
      pct: computeToolUsagePct(t._count, maxToolCount),
    })),
  }
}
