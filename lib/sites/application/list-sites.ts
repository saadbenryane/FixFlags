import { fromStoredWatchInterval } from '@/lib/audit/watch-interval'
import { loadLegacySiteAnalysisIds } from './legacy-analysis'
import { includeLegacySiteAnalyses } from './analysis-scope'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { buildCoverageFacts, isAuditFinished, isAuditInFlight } from '@/lib/sites/coverage'
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
import { siteCardHealth } from '@/lib/sites/site-health'
import { siteCoverageExecutionSelect } from './site-execution'
import { currentOutcomeState } from '../outcome-state'
import { assessmentIsComparable } from '../domain/assessment-comparability'
import { loadOutcomeBindingRevisions } from './outcome-binding-revisions'
import { loadCategoryEvidence, applicableCategoryEvidence, overlayCategoryCoverage } from './category-evidence'
import { currentImprovementFlags, currentUnboundFindings, incidentAffectedPaths } from '../flag-resolution'
import { currentImprovementWhere, loadIncidentRecoveryProofs, unboundSiteFindingWhere } from './incident-proofs'

export type SiteSummary = {
  id: string
  name: string
  hostname: string
  presentation: SitePresentation
  /** Application-only ordering fact. Not rendered as a second status. */
  lastUsefulChangeAt: string
}

/**
 * Website rows need a summary, not a complete Site home. These batched reads
 * keep query count constant as the account grows and deliberately omit
 * connections, settings, alert history, and full task artifacts. Watched
 * assessment state is read in one batch because it contributes to Site health.
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
  const siteWideWhere = includeLegacySiteAnalyses(await loadLegacySiteAnalysisIds(projectIds))
  const [latestAudits, latestCompletedAudits, improvements, outcomes, categoryAudits] = await Promise.all([
    prisma.audit.findMany({
      where: { projectId: { in: projectIds }, ...siteWideWhere },
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
        verifierExecutions: siteCoverageExecutionSelect,
        failedModules: true,
        reportCompleteness: true,
        updatedAt: true,
        createdAt: true,
        executionSpec: true,
      },
    }),
    prisma.audit.findMany({
      where: { projectId: { in: projectIds }, status: 'COMPLETED', ...siteWideWhere },
      orderBy: [{ projectId: 'asc' }, { completedAt: 'desc' }],
      distinct: ['projectId'],
      select: { id: true, projectId: true, status: true, completedAt: true, evidenceCoverage: true, executionSpec: true,
        verifierExecutions: siteCoverageExecutionSelect, failedModules: true },
    }),
    prisma.improvement.findMany({
      where: { projectId: { in: projectIds }, ...currentImprovementWhere },
      select: {
        projectId: true,
        outcomeId: true,
        status: true,
        fingerprint: true,
        attempts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12, select: {
          outcome: true, comparable: true, sourceAuditId: true, handoffReference: true, verificationAuditId: true,
          verificationAudit: { select: { id: true, projectId: true, parentId: true, status: true } },
        } },
        occurrences: {
          orderBy: { createdAt: 'desc' },
          select: {
            flag: {
              select: {
                status: true,
                id: true,
                auditId: true,
                fingerprint: true,
                resolvedInId: true,
                affectedPaths: true,
                severity: true,
                confidence: true,
                pageUrl: true,
                checkId: true,
                verificationRule: true,
                supportingObservations: true,
                evidenceTargets: true,
                attentionPolicy: true,
                rubric: true,
                impactTag: true,
              },
            },
          },
        },
      },
    }),
    prisma.siteOutcome.findMany({
      where: { projectId: { in: projectIds }, enabled: true },
      select: { projectId: true, enabled: true, environment: true,
        bindings: { where: { enabled: true }, select: { key: true, required: true, mechanism: true, version: true, config: true } },
        assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 1,
          select: { state: true, validUntil: true, coverage: true } },
      },
    }),
    loadCategoryEvidence(projectIds),
  ])

  const bindingRevisions = await loadOutcomeBindingRevisions(outcomes)

  const latestByProject = new Map(latestAudits.flatMap((audit) => audit.projectId ? [[audit.projectId, audit] as const] : []))
  const completedByProject = new Map(latestCompletedAudits.flatMap((audit) => audit.projectId ? [[audit.projectId, audit] as const] : []))
  const auditIds = [...new Set([...latestAudits, ...latestCompletedAudits].map((audit) => audit.id))]
  const [auditPages, screenshots, unboundFlags] = await Promise.all([
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
      where: unboundSiteFindingWhere(projectIds),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        resolvedInId: true,
        audit: { select: { projectId: true } },
        auditId: true,
        fingerprint: true,
        severity: true,
        confidence: true,
        pageUrl: true,
        checkId: true,
        rubric: true,
        impactTag: true,
        verificationRule: true,
                supportingObservations: true,
        affectedPaths: true,
        evidenceTargets: true,
        attentionPolicy: true,
      },
    }),
  ])

  const pagesByAudit = groupBy(auditPages, (page) => page.auditId)
  const shotsByAudit = groupBy(screenshots, (shot) => shot.auditId)
  const unboundByProject = groupBy(unboundFlags, flag => flag.audit.projectId ?? '')
  const improvementsByProject = groupBy(improvements, (improvement) => improvement.projectId)
  const recoveryIds = await loadIncidentRecoveryProofs([
    ...improvements.map(improvement => ({ projectId: improvement.projectId, flags: improvement.occurrences.map(occurrence => occurrence.flag) })),
    ...[...unboundByProject].map(([projectId, flags]) => ({ projectId, flags })),
  ])
  const outcomesByProject = groupBy(outcomes, outcome => outcome.projectId)
  const now = new Date()
  const currentStates = new Map(outcomes.map((outcome, index) => {
    const assessment = outcome.assessments[0] ?? null
    return [outcome, assessment && !assessmentIsComparable(assessment.coverage, bindingRevisions[index], outcome.environment)
      ? 'COULD_NOT_VERIFY' as const : currentOutcomeState(assessment, now)] as const
  }))

  return projects.map((project): SiteSummary => {
    const watchInterval = fromStoredWatchInterval(project.watchInterval)
    const latest = latestByProject.get(project.id) ?? null
    const completed = latest?.status === 'COMPLETED' ? latest : completedByProject.get(project.id) ?? null
    const pages = latest ? pagesByAudit.get(latest.id) ?? [] : []
    const pagesReached = pages.filter((page) => page.status === 'COMPLETED').length
    const pagesExpected = pages.length

    const durable = improvementsByProject.get(project.id) ?? []
    const represented = new Set(durable.filter(improvement => improvement.occurrences?.length).map(improvement => improvement.fingerprint))
    const durableFlags = durable.flatMap((improvement) => {
      const active = currentImprovementFlags(improvement.occurrences.map(occurrence => occurrence.flag), recoveryIds.get(project.id) ?? new Set<string>(),
        improvement.status, improvement.attempts ?? [], project.id)
      const occurrence = active[0]
      if (!occurrence || !isCustomerFlag(occurrence)) return []
      const affectedPageCount = incidentAffectedPaths(active).length
      return [{ severity: occurrence.severity, priority: flagPriority({ severity: occurrence.severity, confidence: occurrence.confidence, affectedPageCount, outcomeId: improvement.outcomeId }) }]
    })
    const unprojected = currentUnboundFindings(unboundByProject.get(project.id) ?? [], recoveryIds.get(project.id) ?? new Set<string>())
      .filter((flag) => (!flag.fingerprint || !represented.has(flag.fingerprint)) && isCustomerFlag(flag))
      .map((flag) => ({ severity: flag.severity, priority: flagPriority({ severity: flag.severity, confidence: flag.confidence, affectedPageCount: flag.pageUrl ? 1 : 0 }) }))
    const customerFlags = [...durableFlags, ...unprojected]

    const facts = overlayCategoryCoverage(completed ? buildCoverageFacts({
      auditStatus: completed.status,
      completedAt: completed.completedAt,
      now,
      evidenceCoverage: completed.evidenceCoverage,
      verifierExecutions: completed.verifierExecutions,
      failedModules: completed.failedModules,
      flags: [],
    }) : [], applicableCategoryEvidence(categoryAudits.filter(audit => audit.projectId === project.id), latest), now)
    const evidenced = facts.filter((fact) => fact.evidenced)
    const stale = evidenced.length > 0 && evidenced.every((fact) => fact.stale === true)
    const hasCurrentEvidence = isAuditFinished(completed?.status) && evidenced.some((fact) => !fact.stale)
    const watched = (outcomesByProject.get(project.id) ?? []).map(outcome => ({ enabled: outcome.enabled,
      state: currentStates.get(outcome)!, validUntil: outcome.assessments[0]?.validUntil }))
    const health = siteCardHealth({ inFlight: isAuditInFlight(latest?.status), finished: isAuditFinished(latest?.status),
      hasLastKnown: Boolean(completed), flags: customerFlags, coverage: facts, now,
      executionSpec: latest?.executionSpec,
      outcomes: watched,
      pagesComplete: pagesExpected > 0 && pagesReached === pagesExpected })
    const result = resultPresentation({
      auditStatus: latest?.status ?? null,
      healthState: health.state,
      flagCount: customerFlags.length,
      stale,
      hasCurrentEvidence,
      assessmentResult: health.assessment.result,
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
        reportCompleteness: latest?.reportCompleteness ?? null,
        failedModules: latest?.failedModules,
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
