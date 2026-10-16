import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { watchAlertDelivery } from '@/lib/audit/watch-notification'
import { prisma } from '@/lib/db'
import { performanceEvidenceSource } from '@/lib/sites/flag-evidence'
import { isShopifyConfigured } from '@/lib/shopify/config'
import { projectSiteActivity } from '@/lib/sites/activity'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { buildBoardCards,type BoardCardView } from '@/lib/sites/board-card'
import { projectCheckResults } from '@/lib/sites/check-results'
import type { PublicConnection } from '@/lib/sites/connections/match'
import { connectionCardNotes,loadSiteConnectionViews } from '@/lib/sites/connections/read'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import {
buildCoverageFacts,
isAuditFinished,
isAuditInFlight,
type CoverageFact,
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
import { applicableCategoryEvidence,loadCategoryEvidence,overlayCategoryCoverage } from './category-evidence'
import { loadExecutionProgress } from './execution-progress'
import { loadSiteAnalysisSelection } from './legacy-analysis'
import { loadMonitoringHistory } from './monitoring-history'
import { loadActiveSiteRuns,resolveLatestAudit,resolvePriorCompletedAudit } from './site-execution'
import { siteScopeCounts } from '../scope-counts'
import { siteViewerActions } from '../viewer-actions'

export type { BoardCardView }

export type { SiteHomeView } from '../site-home'

function factsFromAudit(
  audit: {
    status: string
    completedAt: Date | null
    evidenceCoverage: unknown
    failedModules?: unknown
    failureCode?: string | null
    triageAt?: Date | null
    aiReviewAt?: Date | null
    verifierExecutions?: Array<{ targetKey: string; status: string; workKind?: string | null; pageUrl?: string | null; detail?: unknown }>
  } | null,
  flags: SiteFlagSeed[],
  now: Date,
  lastKnown?: CoverageFact[] | null,
  retainLastKnownWhileChecking?: boolean
) {
  return buildCoverageFacts({
    auditStatus: audit?.status ?? 'QUEUED',
    completedAt: audit?.completedAt ?? null,
    now,
    evidenceCoverage: audit?.evidenceCoverage,
    failedModules: audit?.failedModules,
    failureCode: audit?.failureCode,
    triageCompleted: Boolean(audit?.triageAt),
    extraReviewCompleted: Boolean(audit?.aiReviewAt),
    verifierExecutions: audit?.verifierExecutions,
    flags: flags.map((f) => ({
      checkId: f.checkId,
      rubric: f.rubric,
      severity: f.severity,
      impactTag: f.impactTag,
      status: 'OPEN',
    })),
    lastKnown,
    retainLastKnownWhileChecking,
  })
}

async function countSitePages(site: SiteRecord): Promise<number> {
  if (site.projectId) {
    return prisma.sitePage.count({ where: { projectId: site.projectId } })
  }
  if (site.provisionalSiteId) {
    return prisma.sitePage.count({ where: { provisionalSiteId: site.provisionalSiteId } })
  }
  return 0
}

export async function loadSiteHome(siteId: string, options: { ownerEvidence?: boolean; viewerAuthenticated?: boolean } = {}): Promise<SiteHomeView | null> {
  const site = await loadSiteRecord(siteId)
  if (!site) return null
  const now = new Date()

  const selection = await loadSiteAnalysisSelection(site)
  const audit = await resolveLatestAudit(site, selection)

  const [{ flags, recommendations }, outcomes, pageCount, checkedPages, projectSettings, resolvedFlags] = await Promise.all([
    loadSiteFindings(site),
    listSiteOutcomes(site),
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
  ])

  const inFlight = isAuditInFlight(audit?.status)
  const prior =
    site.kind === 'project'
      ? await resolvePriorCompletedAudit(site, audit?.id ?? null, selection)
      : null

  const lastKnownFacts =
    prior != null
      ? factsFromAudit(prior, flags, now)
      : null

  const categoryEvidence = applicableCategoryEvidence(await loadCategoryEvidence(site.projectId ? [site.projectId] : []), audit)
  const coverage = overlayCategoryCoverage(factsFromAudit(
    audit,
    flags,
    now,
    lastKnownFacts,
    Boolean(lastKnownFacts)
  ), categoryEvidence, now, flags)

  const coverageByArea = new Map(coverage.map((c) => [c.area, c]))

  const finished = isAuditFinished(audit?.status)
  const resultPage = await loadSiteCheckResultPage(site, audit, undefined, categoryEvidence)
  const summaryResults = audit ? projectCheckResults(audit.id, audit.verifierExecutions) : []
  const health = siteCardHealth({
    inFlight,
    finished,
    hasLastKnown: Boolean(lastKnownFacts),
    flags,
    coverage,
    now,
    executionSpec: audit?.executionSpec,
    pagesComplete: checkedPages.length > 0 && checkedPages.every(page => page.status === 'COMPLETED'),
    outcomes: outcomes.map((outcome) => ({ state: outcome.state, enabled: outcome.enabled })),
  })
  const captures = await loadSiteCaptures(audit?.id ?? null, prior?.id ?? null, inFlight, audit?.startedAt ?? null)
  const capture = captures.find(item => item.device === 'desktop')
  const [uptime, uptimeEvents] = options.ownerEvidence && site.projectId ? await Promise.all([
    loadUptimeSummary(site.projectId, now), loadUptimeEvents(site.projectId),
  ]) : [undefined, undefined]

  const technologyProfile = audit?.id ? await loadTechnologyProfile(audit.id) : null
  const trackingAudit = categoryEvidence.get('tracking')
  const trackingProfile = trackingAudit ? await loadTechnologyProfile(trackingAudit.id) : null
  const analytics = (trackingProfile && trackingProfile.status !== 'not_captured' ? trackingProfile : technologyProfile)?.technologies
    .filter((tech) => tech.category === 'analytics')
    .map((tech) => tech.name) ?? []
  const { timeline: monitoringHistory, trend: monitoringTrend } = await loadMonitoringHistory(site, selection)
  const activeRuns = await loadActiveSiteRuns(site, now)

  const connections = site.projectId ? await loadSiteConnectionViews(site.projectId) : null
  const connectionNotes = connectionCardNotes(connections?.facts ?? [])
  const cards: BoardCardView[] = buildBoardCards({
    siteId,
    inFlight,
    hasLastKnown: Boolean(lastKnownFacts),
    health,
    coverageByArea,
    flags,
    outcomes,
    pageCount,
    captureUrl: capture?.url ?? null,
    checkedAt: (finished ? audit : prior)?.completedAt?.toISOString() ?? null,
    detected: { analytics },
  })
  applyCardEvidence({ cards, audit, summaryResults, inFlight, pageCount, connections, connectionNotes, now })
  for (const [area, categoryAudit] of categoryEvidence) {
    const card = cards.find(card => card.id === area)
    if (!card) continue
    const categoryInFlight = isAuditInFlight(categoryAudit.status)
    applyCardEvidence({ cards: [card], audit: { ...audit!, ...categoryAudit },
      summaryResults: projectCheckResults(categoryAudit.id, categoryAudit.verifierExecutions), inFlight: categoryInFlight,
      pageCount, connections, connectionNotes, now })
    if (categoryInFlight) card.activity = 'checking'
  }

  const { presentation, watchState, watching, monitoring } = projectHomePresentation({
    siteId, site, cards, flags, health, coverage, checkedPages, capture, audit, prior, finished, now,
  })

  // Delivery belongs to the most recent Watch alert, independently of the
  // monitoring schedule. Retrying an older receipt cannot make its incident
  // newest or hide a later delivery failure.
  //
  // Guarded on a resolved projectId, like every other tenant-scoped read here. A
  // provisional Site has none, and querying with projectId: null would match
  // other tenants' unscoped Watch alerts.
  const latestAlert = site.projectId
    ? await prisma.audit.findFirst({
      where: { projectId: site.projectId, recheckTrigger: 'WATCH', watchNotificationStatus: { not: 'NOT_APPLICABLE' } },
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
  const alertState = watchAlertDelivery({
    status: latestAlert?.watchNotificationStatus ?? null,
    attempts: latestAlert?.watchNotificationAttempts ?? 0,
    attemptCeiling:latestAlert?.watchNotificationAttemptCeiling,
    leaseUntil: latestAlert?.watchNotificationLeaseUntil ?? null,
  })

  const executionProgress = await loadExecutionProgress(site, audit?.id ?? null)
  // A completed partial report starts a new check through the existing retry
  // action. Task-level configuration limits describe the saved run, not a live
  // execution that still owns its recovery. Keep this aligned with Site summaries.
  if (audit?.status !== 'COMPLETED' && presentation.run.recoveryAction === 'retry' &&
      executionProgress?.recovery && executionProgress.recovery.action !== 'retry')
    presentation.run.recoveryAction = 'view_details'

  return {
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
      ...(site.projectId ? { accountChecks: await loadAccountChecksView(site.projectId) } : {}),
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
  }
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
