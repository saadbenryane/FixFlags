import { prisma } from '@/lib/db'

export const REPORT_HISTORY_PAGE_SIZE = 20

export type ReportHistoryItem = {
  id: string
  url: string
  hostname: string
  createdAt: string
  completedAt: string | null
  status: string
  score: number | null
  unresolvedFlagCount: number
  reviewKind: 'product_review' | 'update_review'
  parentId: string | null
  projectId: string | null
}

export class InvalidReportHistoryCursorError extends Error {}

export async function loadReportHistory(input: {
  userId: string
  cursor?: string | null
  limit?: number
}): Promise<{ items: ReportHistoryItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? REPORT_HISTORY_PAGE_SIZE, 1), 50)
  if (input.cursor) {
    const cursor = await prisma.audit.findFirst({
      where: { id: input.cursor, userId: input.userId },
      select: { id: true },
    })
    if (!cursor) throw new InvalidReportHistoryCursorError('Invalid report history cursor')
  }
  const rows = await prisma.audit.findMany({
    where: { userId: input.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      url: true,
      createdAt: true,
      completedAt: true,
      status: true,
      score: true,
      parentId: true,
      projectId: true,
      _count: {
        select: {
          flags: { where: { status: { in: ['OPEN', 'REGRESSED'] } } },
        },
      },
    },
  })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return {
    items: page.map((row) => ({
      id: row.id,
      url: row.url,
      hostname: safeHostname(row.url),
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      status: row.status,
      score: row.score,
      unresolvedFlagCount: row._count.flags,
      reviewKind: row.parentId ? 'update_review' : 'product_review',
      parentId: row.parentId,
      projectId: row.projectId,
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
