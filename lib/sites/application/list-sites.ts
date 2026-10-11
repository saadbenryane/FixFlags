import { fromStoredWatchInterval } from '@/lib/audit/watch-interval'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { buildCoverageFacts, isAuditFinished } from '@/lib/sites/coverage'
import {
  flagCountLabel,
  flagPriority,
  freshnessLabel,
  monitoringPresentation,
  pageCoverageLabel,
  resultPresentation,
  runPresentation,
  siteSortRank,
  type SitePresentation,
} from '@/lib/sites/presentation'
import { watchBoardState } from '@/lib/sites/watch-state'

export type SiteSummary = {
  id: string
  name: string
  hostname: string
  presentation: SitePresentation
  /** Application-only ordering fact. Not rendered as a second status. */
  lastUsefulChangeAt: string
}

const openImprovementStates = ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'UNVERIFIED'] as const

/**
 * Website rows need a summary, not a complete Site home. These batched reads
 * keep query count constant as the account grows and deliberately omit
 * Outcomes, connections, settings, alert history, and category-card evidence.
 */
export async function loadSiteSummaries(userId: string): Promise<SiteSummary[]> {
  const projects = await prisma.project.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      canonicalHost: true,
      updatedAt: true,
      watchInterval: true,
      watchEveryMinutes: true,
      watchNextRunAt: true,
      watchLastError: true,
      watchConsecutiveFailures: true,
    },
  })
  if (projects.length === 0) return []

  const projectIds = projects.map((project) => project.id)
  const [latestAudits, latestCompletedAudits, improvements] = await Promise.all([
    prisma.audit.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ projectId: 'asc' }, { createdAt: 'desc' }],
      distinct: ['projectId'],
      select: {
        id: true,
        projectId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        failureCode: true,
        evidenceCoverage: true,
        updatedAt: true,
      },
    }),
    prisma.audit.findMany({
      where: { projectId: { in: projectIds }, status: 'COMPLETED' },
      orderBy: [{ projectId: 'asc' }, { completedAt: 'desc' }],
      distinct: ['projectId'],
      select: { id: true, projectId: true, status: true, completedAt: true, evidenceCoverage: true },
    }),
    prisma.improvement.findMany({
      where: { projectId: { in: projectIds }, status: { in: [...openImprovementStates] } },
      select: {
        projectId: true,
        outcomeId: true,
        fingerprint: true,
        occurrences: {
          orderBy: { createdAt: 'desc' },
          select: {
            flag: {
              select: {
                severity: true,
                confidence: true,
                pageUrl: true,
                checkId: true,
                rubric: true,
                impactTag: true,
              },
            },
          },
        },
      },
    }),
  ])

  const latestByProject = new Map(latestAudits.flatMap((audit) => audit.projectId ? [[audit.projectId, audit] as const] : []))
  const completedByProject = new Map(latestCompletedAudits.flatMap((audit) => audit.projectId ? [[audit.projectId, audit] as const] : []))
  const auditIds = [...new Set([...latestAudits, ...latestCompletedAudits].map((audit) => audit.id))]
  const [auditPages, screenshots, latestAuditFlags] = await Promise.all([
    prisma.auditPage.findMany({
      where: { auditId: { in: auditIds } },
      select: { auditId: true, status: true },
    }),
    prisma.screenshot.findMany({
      where: { auditId: { in: auditIds }, device: 'DESKTOP' },
      orderBy: { id: 'desc' },
      select: {
        auditId: true,
        url: true,
        width: true,
        height: true,
        audit: { select: { url: true, completedAt: true } },
        page: { select: { url: true, updatedAt: true } },
      },
    }),
    prisma.flag.findMany({
      where: { auditId: { in: latestAudits.map((audit) => audit.id) }, status: { in: ['OPEN', 'REGRESSED'] } },
      select: {
        auditId: true,
        fingerprint: true,
        severity: true,
        confidence: true,
        pageUrl: true,
        checkId: true,
        rubric: true,
        impactTag: true,
      },
    }),
  ])

  const pagesByAudit = groupBy(auditPages, (page) => page.auditId)
  const shotsByAudit = groupBy(screenshots, (shot) => shot.auditId)
  const flagsByAudit = groupBy(latestAuditFlags, (flag) => flag.auditId)
  const improvementsByProject = groupBy(improvements, (improvement) => improvement.projectId)
  const now = new Date()

  return projects.map((project): SiteSummary => {
    const watchInterval = fromStoredWatchInterval(project.watchInterval)
    const latest = latestByProject.get(project.id) ?? null
    const completed = latest?.status === 'COMPLETED' ? latest : completedByProject.get(project.id) ?? null
    const pages = latest ? pagesByAudit.get(latest.id) ?? [] : []
    const pagesReached = pages.filter((page) => page.status === 'COMPLETED').length
    const pagesExpected = pages.length

    const durable = improvementsByProject.get(project.id) ?? []
    const represented = new Set(durable.map((improvement) => improvement.fingerprint))
    const durableFlags = durable.flatMap((improvement) => {
      const occurrence = improvement.occurrences[0]?.flag
      if (!occurrence || !isCustomerFlag(occurrence)) return []
      const affectedPageCount = new Set(improvement.occurrences.map((item) => item.flag.pageUrl).filter(Boolean)).size
      return [{ priority: flagPriority({ severity: occurrence.severity, confidence: occurrence.confidence, affectedPageCount, outcomeId: improvement.outcomeId }) }]
    })
    const unprojected = (latest ? flagsByAudit.get(latest.id) ?? [] : [])
      .filter((flag) => (!flag.fingerprint || !represented.has(flag.fingerprint)) && isCustomerFlag(flag))
      .map((flag) => ({ priority: flagPriority({ severity: flag.severity, confidence: flag.confidence, affectedPageCount: flag.pageUrl ? 1 : 0 }) }))
    const customerFlags = [...durableFlags, ...unprojected]

    const facts = completed ? buildCoverageFacts({
      auditStatus: completed.status,
      completedAt: completed.completedAt,
      now,
      evidenceCoverage: completed.evidenceCoverage,
      flags: [],
    }) : []
    const evidenced = facts.filter((fact) => fact.evidenced)
    const stale = evidenced.length > 0 && evidenced.every((fact) => fact.stale === true)
    const hasCurrentEvidence = isAuditFinished(completed?.status) && evidenced.some((fact) => !fact.stale)
    const result = resultPresentation({
      auditStatus: latest?.status ?? null,
      healthState: customerFlags.length > 0 ? 'problem' : hasCurrentEvidence ? 'healthy' : 'unknown',
      flagCount: customerFlags.length,
      stale,
      hasCurrentEvidence,
    })
    const watchState = watchBoardState({
      interval: watchInterval ?? null,
      nextRunAt: project.watchNextRunAt,
      lastError: project.watchLastError,
      consecutiveFailures: project.watchConsecutiveFailures,
    })
    const previewAudit = latest ?? completed
    const shot = previewAudit ? shotsByAudit.get(previewAudit.id)?.[0] ?? null : null
    const checkedAt = completed?.completedAt?.toISOString() ?? null
    const presentation: SitePresentation = {
      identity: {
        siteId: project.id,
        name: project.name,
        host: project.canonicalHost,
        preview: shot ? {
          url: normalizeInternalScreenshotUrl(shot.url),
          pageUrl: shot.page?.url ?? shot.audit.url,
          viewport: `${shot.width} × ${shot.height}`,
          recordedAt: (shot.audit.completedAt ?? shot.page?.updatedAt)?.toISOString() ?? null,
        } : null,
      },
      result,
      monitoring: monitoringPresentation(watchState, watchInterval ?? null, project.watchEveryMinutes),
      coverage: {
        pagesReached,
        pagesExpected,
        label: pageCoverageLabel(pagesReached, pagesExpected),
        complete: pagesExpected > 0 && pagesReached === pagesExpected,
      },
      freshness: { checkedAt, stale, label: freshnessLabel(checkedAt, now) },
      flags: {
        count: customerFlags.length,
        label: flagCountLabel(customerFlags.length),
        fixFirstCount: customerFlags.filter((flag) => flag.priority.band === 'fix_first').length,
      },
      run: runPresentation({
        auditId: latest?.id ?? null,
        auditStatus: latest?.status ?? null,
        startedAt: latest?.startedAt ?? null,
        failureCode: latest?.failureCode ?? null,
      }),
      categories: [],
    }

    return {
      id: project.id,
      name: project.name,
      hostname: project.canonicalHost,
      presentation,
      lastUsefulChangeAt: presentation.identity.preview?.recordedAt ?? checkedAt ?? project.updatedAt.toISOString(),
    }
  }).sort((left, right) => {
    const byRank = siteSortRank(left.presentation) - siteSortRank(right.presentation)
    if (byRank !== 0) return byRank
    if (left.presentation.flags.count !== right.presentation.flags.count) return right.presentation.flags.count - left.presentation.flags.count
    return right.lastUsefulChangeAt.localeCompare(left.lastUsefulChangeAt)
  })
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>()
  for (const row of rows) {
    const value = key(row)
    grouped.set(value, [...(grouped.get(value) ?? []), row])
  }
  return grouped
}
