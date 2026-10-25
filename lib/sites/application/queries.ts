import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { watchAlertDelivery } from '@/lib/audit/watch-notification'
import { prisma } from '@/lib/db'
import { isGithubRepoAccessConfigured } from '@/lib/integrations/github'
import { performanceEvidenceSource } from '@/lib/sites/flag-evidence'
import { isShopifyConfigured } from '@/lib/shopify/config'
import { projectSiteActivity } from '@/lib/sites/activity'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { buildBoardCards,type BoardCardView } from '@/lib/sites/board-card'
import { projectCheckResults } from '@/lib/sites/check-results'
import type { PublicConnection } from '@/lib/sites/connections/match'
import { connectionCardNotes,loadSiteConnectionViews } from '@/lib/sites/connections/read'
import {
isAuditFinished,
isAuditInFlight,
} from '@/lib/sites/coverage'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { walkFinishedFromCoverage } from '@/lib/sites/first-outcome'
import { loadSiteFindings,loadSiteFlagDetail,loadSiteResolvedFlags } from '@/lib/sites/flags'
import { listSiteOutcomes } from '@/lib/sites/outcomes'
import { siteCardHealth } from '@/lib/sites/site-health'
import type { SiteRecord } from '@/lib/sites/types'
import { loadUptimeEvents,loadUptimeSummary } from '@/lib/uptime/queries'
import { loadAccountChecksView } from '../accounts/store'
import { projectHomePresentation } from '../home-presentation'
import type { SiteHomeView } from '../site-home'
import { loadPerformanceEvidence } from './performance-evidence'
import { loadSiteCaptures, loadSiteCheckedPages } from './captures'
import { applyCardEvidence } from './card-evidence'
import { loadCategoryEvidence } from './category-evidence'
import { projectCurrentSiteEvidence } from './current-evidence'
import { hasUnresolvedFlagEvidence } from '@/lib/audit/attention'
import { loadExecutionProgress } from './execution-progress'
import { loadSiteAnalysisSelection } from './legacy-analysis'
import { loadMonitoringHistory } from './monitoring-history'
import { loadActiveSiteRuns,resolveLatestAudit,resolvePriorCompletedAudit } from './site-execution'
import { siteScopeCounts } from '../scope-counts'
import { siteViewerActions } from '../viewer-actions'
import { executionPageCoverage } from '../page-coverage'
import { projectSiteHomeForViewer } from '../viewer-projection'

export type { BoardCardView }

export type { SiteHomeView } from '../site-home'

async function countSitePages(site: SiteRecord): Promise<number> {
  if (site.projectId) {
    return prisma.sitePage.count({ where: { projectId: site.projectId } })
  }
  if (site.provisionalSiteId) {
    return prisma.sitePage.count({ where: { provisionalSiteId: site.provisionalSiteId } })
  }
  return 0
}

async function loadLatestWatchAlert(projectId: string | null | undefined) {
  // Delivery belongs to the most recent Watch alert, independently of the
  // monitoring schedule. Retrying an older receipt cannot make its incident
  // newest or hide a later delivery failure.
  //
  // Guarded on a resolved projectId, like every other tenant-scoped read here. A
  // provisional Site has none, and querying with projectId: null would match
  // other tenants' unscoped Watch alerts.
  return projectId
    ? await prisma.audit.findFirst({
      where: { projectId, recheckTrigger: 'WATCH', watchNotificationStatus: { not: 'NOT_APPLICABLE' } },
      // Delivery retries change updatedAt, not the incident's chronology.
      orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        watchNotificationStatus: true,
        watchNotificationAttempts: true,
        watchNotificationAttemptCeiling:true,
        watchNotificationLeaseUntil: true,
        updatedAt: true,
      },
    })
    : null
}

export async function loadSiteHome(siteId: string, options: { ownerEvidence?: boolean; viewerAuthenticated?: boolean; site?: SiteRecord | null } = {}): Promise<SiteHomeView | null> {
  const site = options.site ?? await loadSiteRecord(siteId)
  if (!site) return null
  const now = new Date()

  const selection = await loadSiteAnalysisSelection(site)
  // History only needs the site and its analysis selection, so it overlaps the
  // findings read. The empty catch keeps a rejected read handled if the latest
  // audit read fails before this promise is awaited.
  const monitoringHistoryPromise = loadMonitoringHistory(site, selection)
  void monitoringHistoryPromise.catch(() => undefined)
  const audit = await resolveLatestAudit(site, selection)

  const [
    { flags, recommendations }, outcomes, pageCount, checkedPages,
    projectSettings, resolvedFlags, prior, categoryRuns, monitoringHistoryView,
  ] = await Promise.all([
    loadSiteFindings(site),
    listSiteOutcomes(site, now),
    countSitePages(site),
    audit ? loadSiteCheckedPages(audit.id) : [],
    site.projectId ? prisma.project.findUnique({
      where: { id: site.projectId },
      select: {
        notificationLevel: true,
        notifyOnRecovery: true,
        shopifyShops: { take: 1, select: { shopDomain: true, uninstalledAt: true } },
      },
    }) : null,
    loadSiteResolvedFlags(site),
    site.kind === 'project' ? resolvePriorCompletedAudit(site, audit?.id ?? null, selection) : null,
    loadCategoryEvidence(site.projectId && audit ? [{ projectId: site.projectId, auditId: audit.id }] : []),
    monitoringHistoryPromise,
  ])
  const inFlight = isAuditInFlight(audit?.status)
  const { coverage, coverageMaxAgeMs, categoryEvidence, hasLastKnown, assessmentComplete } = projectCurrentSiteEvidence({
    audit, prior, flags, categories: categoryRuns, now, evidenceComplete: !recommendations.some(hasUnresolvedFlagEvidence),
    watchInterval: site.watchInterval, watchEveryMinutes: site.watchEveryMinutes,
  })

  const coverageByArea = new Map(coverage.map((c) => [c.area, c]))

  const finished = isAuditFinished(audit?.status)
  const trackingAudit = categoryEvidence.get('tracking')
  const [
    resultPage, captures, uptime, uptimeEvents, technologyProfile, trackingProfile,
    activeRuns, connections, latestAlert, executionProgress, accountChecks, github,
  ] = await Promise.all([
    loadSiteCheckResultPage(site, audit, undefined, categoryEvidence),
    loadSiteCaptures(audit?.id ?? null, prior?.id ?? null, inFlight, audit?.startedAt ?? null),
    options.ownerEvidence && site.projectId ? loadUptimeSummary(site.projectId, now) : undefined,
    options.ownerEvidence && site.projectId ? loadUptimeEvents(site.projectId) : undefined,
    audit?.id ? loadTechnologyProfile(audit.id) : null,
    trackingAudit ? loadTechnologyProfile(trackingAudit.id) : null,
    loadActiveSiteRuns(site, now),
    site.projectId ? loadSiteConnectionViews(site.projectId) : null,
    loadLatestWatchAlert(site.projectId),
    loadExecutionProgress(site, audit?.id ?? null),
    site.projectId ? loadAccountChecksView(site.projectId) : undefined,
    options.ownerEvidence && site.userId ? prisma.githubConnection.findUnique({ where: { userId: site.userId }, select: { githubLogin: true, revokedAt: true } }) : null,
  ])
  const summaryResults = audit ? projectCheckResults(audit.id, audit.verifierExecutions) : []
  const pageCoverage = executionPageCoverage({ executionSpec: audit?.executionSpec, pages: checkedPages, executions: audit?.verifierExecutions })
  const health = siteCardHealth({
    inFlight,
    finished,
    hasLastKnown,
    assessmentComplete,
    flags,
    coverage,
    coverageMaxAgeMs,
    now,
    executionSpec: audit?.executionSpec,
    pagesComplete: pageCoverage.complete,
    outcomes: outcomes.map((outcome) => ({ id: outcome.id, state: outcome.state, enabled: outcome.enabled,
      validUntil: outcome.validUntil ? new Date(outcome.validUntil) : null })),
    uptime,
  })
  const capture = captures.find(item => item.device === 'desktop')
  const analytics = (trackingProfile && trackingProfile.status !== 'not_captured' ? trackingProfile : technologyProfile)?.technologies
    .filter((tech) => tech.category === 'analytics')
    .map((tech) => tech.name) ?? []
  const { timeline: monitoringHistory, trend: monitoringTrend } = monitoringHistoryView
  const connectionNotes = connectionCardNotes(connections?.facts ?? [])
  const cards: BoardCardView[] = buildBoardCards({
    siteId,
    inFlight,
    hasLastKnown,
    health,
    coverageByArea,
    flags,
    outcomes,
    pageCount,
    captureUrl: capture?.url ?? null,
    checkedAt: (finished ? audit : prior)?.completedAt?.toISOString() ?? null,
    detected: { analytics },
  })
  applyCardEvidence({ cards, audit, summaryResults, inFlight, pageCount, connections, connectionNotes, now, coverageMaxAgeMs })
  for (const [area, categoryAudit] of categoryEvidence) {
    const card = cards.find(card => card.id === area)
    if (!card) continue
    const categoryInFlight = isAuditInFlight(categoryAudit.status)
    applyCardEvidence({ cards: [card], audit: { ...audit!, ...categoryAudit },
      summaryResults: projectCheckResults(categoryAudit.id, categoryAudit.verifierExecutions), inFlight: categoryInFlight,
      pageCount, connections, connectionNotes, now, coverageMaxAgeMs })
    if (categoryInFlight) card.activity = 'checking'
  }

  const { presentation, watchState, watching, monitoring } = projectHomePresentation({
    siteId, site, cards, flags, health, coverage, pageCoverage, capture, audit, prior, finished, now,
  })

  const alertState = watchAlertDelivery({
    status: latestAlert?.watchNotificationStatus ?? null,
    attempts: latestAlert?.watchNotificationAttempts ?? 0,
    attemptCeiling:latestAlert?.watchNotificationAttemptCeiling,
    leaseUntil: latestAlert?.watchNotificationLeaseUntil ?? null,
  })

  // A completed partial report starts a new check through the existing retry
  // action. Task-level configuration limits describe the saved run, not a live
  // execution that still owns its recovery. Keep this aligned with Site summaries.
  if (audit?.status !== 'COMPLETED' && presentation.run.recoveryAction === 'retry' &&
      executionProgress?.recovery && executionProgress.recovery.action !== 'retry')
    presentation.run.recoveryAction = 'view_details'

  return projectSiteHomeForViewer({
    schemaVersion: 2,
    actions: siteViewerActions(Boolean(options.ownerEvidence && site.projectId), options.viewerAuthenticated),
    counts: siteScopeCounts(flags, checkedPages, pageCount),
    captures, uptime,
    uptimeEvents: uptimeEvents?.map(event => ({ ...event, startedAt: event.startedAt.toISOString(), confirmedAt: event.confirmedAt.toISOString(), recoveredAt: event.recoveredAt?.toISOString() ?? null, supersededAt: event.supersededAt?.toISOString() ?? null })),
    inventoryPageCount: pageCount,
    activeRuns,
    site,
    executionProgress,
    activity: projectSiteActivity({ status: audit?.status ?? null, startedAt: audit?.startedAt ?? null, failureCode: audit?.failureCode ?? null,
      pages: checkedPages, events: [...(audit?.pipelineEvents ?? [])].reverse() }),
    checkedPages: checkedPages.map((page) => ({ ...page, checkedAt: page.updatedAt.toISOString() })),
    presentation,
    audit: {
      id: audit?.id ?? null,
      status: audit?.status ?? null,
      progress: audit?.progress ?? 0,
      walkFinished: walkFinishedFromCoverage(audit?.status, audit?.evidenceCoverage),
      failureCode: audit?.failureCode ?? null,
    },
    cards,
    flags,
    recommendations,
    resolvedFlags,
    outcomes,
    checkResults: resultPage.results,
    checkResultsNextCursor: resultPage.nextCursor,
    technology: technologyProfile ? {
      status: technologyProfile.status,
      detectedAt: technologyProfile.detectedAt,
      items: technologyProfile.technologies.map(({ slug, name, category, confidenceBand }) => ({ slug, name, category, confidenceBand })),
    } : undefined,
    monitoringHistory,
    monitoringTrend,
    watch: {
      state: watchState,
      interval: site.watchInterval,
      everyMinutes: site.watchEveryMinutes ?? null,
      nextRunAt: site.watchNextRunAt?.toISOString() ?? null,
      lastRunAt: site.watchLastRunAt?.toISOString() ?? null,
      lastError: site.watchLastError,
      covered: watching,
      label: monitoring.label,
      // Reported beside coverage rather than inside it, so an undelivered alert
      // can never remove the honest fact that the Site is still being checked.
      alert: {
        state: alertState,
        status: latestAlert?.watchNotificationStatus ?? null,
        attempts: latestAlert?.watchNotificationAttempts ?? 0,
        leaseUntil: latestAlert?.watchNotificationLeaseUntil?.toISOString() ?? null,
        at: latestAlert?.updatedAt.toISOString() ?? null,
      },
    },
    settings: {
      ...(options.ownerEvidence ? { github: { configured: isGithubRepoAccessConfigured(), status: github ? github.revokedAt ? 'revoked' as const : 'connected' as const : 'not_connected' as const, login: github?.githubLogin ?? null } } : {}),
      ...(accountChecks ? { accountChecks } : {}),
      notificationLevel: projectSettings?.notificationLevel ?? null,
      notifyOnRecovery: projectSettings?.notifyOnRecovery ?? null,
      shopify: {
        configured: isShopifyConfigured() || Boolean(projectSettings?.shopifyShops[0]),
        ...(projectSettings?.shopifyShops[0]
          ? {
              state: projectSettings.shopifyShops[0].uninstalledAt ? 'unavailable' as const : 'connected' as const,
              domain: projectSettings.shopifyShops[0].shopDomain,
            }
          : { state: 'not_connected' as const, domain: null }),
      },
      searchConsole: connections?.searchConsole ?? emptyConnection('SEARCH_CONSOLE'),
      analytics: connections?.analytics ?? emptyConnection('ANALYTICS'),
    },
  })
}

function emptyConnection(provider: PublicConnection['provider']): PublicConnection {
  return {
    provider,
    configured: false,
    status: 'not_connected',
    propertyLabel: null,
    detail: null,
    lastSyncedAt: null,
  }
}

export async function loadSiteBoardFlag(siteId: string, flagId: string) {
  const site = await loadSiteRecord(siteId)
  if (!site) return null
  const flag = await loadSiteFlagDetail(site, flagId)
  if (!flag) return null
  flag.performanceEvidenceSource = flag.evidenceContext?.source === 'DETERMINISTIC' ? performanceEvidenceSource(flag.checkId) : null
  if (flag.performanceEvidenceSource === 'lab' && flag.pageUrl)
    flag.performanceEvidence = await loadPerformanceEvidence(site, flag.sourceAuditId, flag.pageUrl)
  const finding = await prisma.journeyFinding.findFirst({
    where: {
      flagId: flag.sourceFlagId ?? flag.id,
      journeyReview: { auditId: flag.sourceAuditId, audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } },
    },
    select: { screenshotUrl: true, createdAt: true },
  })
  // Only the exact persisted finding owns this image. The newest Site capture
  // may show a different page, device or later repair.
  let capture = null
  if (finding?.screenshotUrl) {
    try {
      const url = new URL(finding.screenshotUrl, 'https://fixflags.com')
      if (url.pathname.startsWith('/api/integrity-assets/') || url.pathname.startsWith('/api/screenshots/')) {
        capture = { url: `${url.pathname}${url.search}`, recordedAt: finding.createdAt.toISOString() }
      }
    } catch { /* An unusable reference is not visual evidence. */ }
  }
  return { site, flag, capture }
}
