import { prisma } from '@/lib/db'

export interface DomainAuditHistory {
  normalizedDomain: string
  audits: Array<{
    id: string
    url: string
    score: number | null
    completedAt: Date | null
    createdAt: Date
    scoreDelta: number | null
  }>
  latestScore: number | null
  scoreDelta: number | null
}

/** Group a user's completed audits by domain with score-over-time and deltas. */
export async function getDomainHistoryForUser(userId: string): Promise<DomainAuditHistory[]> {
  const audits = await prisma.audit.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      normalizedDomain: { not: null },
    },
    select: {
      id: true,
      url: true,
      score: true,
      normalizedDomain: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const byDomain = new Map<string, typeof audits>()
  for (const audit of audits) {
    const domain = audit.normalizedDomain!
    const list = byDomain.get(domain) ?? []
    list.push(audit)
    byDomain.set(domain, list)
  }

  const history: DomainAuditHistory[] = []
  for (const [normalizedDomain, domainAudits] of byDomain) {
    const withDelta = domainAudits.map((audit, index) => {
      const prev = index > 0 ? domainAudits[index - 1] : null
      const scoreDelta =
        audit.score != null && prev?.score != null ? audit.score - prev.score : null
      return {
        id: audit.id,
        url: audit.url,
        score: audit.score,
        completedAt: audit.completedAt,
        createdAt: audit.createdAt,
        scoreDelta,
      }
    })

    const latest = withDelta[withDelta.length - 1]
    const previous = withDelta.length > 1 ? withDelta[withDelta.length - 2] : null
    history.push({
      normalizedDomain,
      audits: withDelta.reverse(),
      latestScore: latest?.score ?? null,
      scoreDelta:
        latest?.score != null && previous?.score != null
          ? latest.score - previous.score
          : null,
    })
  }

  return history.sort((a, b) => {
    const aTime = a.audits[0]?.createdAt.getTime() ?? 0
    const bTime = b.audits[0]?.createdAt.getTime() ?? 0
    return bTime - aTime
  })
}
