import type { Audit } from '@prisma/client'
import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { watchAlertDelivery } from '@/lib/audit/watch-notification'
import { prisma } from '@/lib/db'
import { emailDeliveryState } from '@/lib/email/delivery-state'
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
import { currentWatchObservationSql } from './scheduled-observation'
import type { SiteHomeView } from '../site-home'
import { loadPerformanceEvidence } from './performance-evidence'
import { loadSiteCaptures, loadSiteCheckedPages } from './captures'
import { siteCaptureAvailability } from '../captures'
import { applyCardEvidence } from './card-evidence'
import { categoryEvidenceBaselines, loadCategoryEvidence } from './category-evidence'
import { projectCurrentSiteEvidence } from './current-evidence'
import { hasUnresolvedFlagEvidence } from '@/lib/audit/attention'
import { loadExecutionProgress } from './execution-progress'
import { loadSiteAnalysisSelection } from './legacy-analysis'
import { loadMonitoringHistory } from './monitoring-history'
import { readSiteEvidence } from './site-evidence-read'
import { loadActiveSiteRuns,resolveLatestAudit,resolvePriorCompletedAudit } from './site-execution'
import { siteScopeCounts } from '../scope-counts'
import { siteViewerActions } from '../viewer-actions'
import { executionPageCoverage, recordedPageEvidenceScope } from '../page-coverage'
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

async function loadLatestWatchAlert(projectId: string | null | undefined, ownerUserId?: string | null) {
  // Delivery belongs to the most recent Watch alert, independently of the
  // monitoring schedule. Retrying an older receipt cannot make its incident
  // newest or hide a later delivery failure.
  //
  // Guarded on a resolved projectId, like every other tenant-scoped read here. A
  // provisional Site has none, and querying with projectId: null would match
  // other tenants' unscoped Watch alerts.
  if (!projectId) return null
  const [alert] = await prisma.$queryRaw<Array<Pick<Audit, 'id' | 'watchNotificationProviderId' | 'watchNotificationStatus' |
    'watchNotificationAttempts' | 'watchNotificationAttemptCeiling' | 'watchNotificationLeaseUntil' | 'completedAt'>>>`
    SELECT a.id, a."watchNotificationProviderId", a."watchNotificationStatus", a."watchNotificationAttempts",
      a."watchNotificationAttemptCeiling", a."watchNotificationLeaseUntil", a."completedAt"
    FROM audits a JOIN projects p ON p.id = a."projectId"
    WHERE p.id = ${projectId} AND a."watchNotificationStatus" <> 'NOT_APPLICABLE' AND ${currentWatchObservationSql}
      AND (a."userId" = p."userId" OR a."watchNotificationStatus" = 'SENT')
    ORDER BY a."completedAt" DESC NULLS LAST, a."createdAt" DESC, a.id DESC LIMIT 1`
  if (!alert) return null
  const delivery = ownerUserId && alert.watchNotificationStatus === 'SENT' && alert.watchNotificationProviderId
    ? await prisma.emailDelivery.findUnique({
      where: { providerId: alert.watchNotificationProviderId, userId: ownerUserId, channel: 'watch', sourceId: alert.id },
      select: { acceptedAt: true, delayedAt: true, deliveredAt: true, failedAt: true, bouncedAt: true, complainedAt: true },
    }) : null
  return { ...alert, providerState: delivery ? emailDeliveryState(delivery) : undefined }
}

type SiteReadOptions = {
  ownerEvidence?: boolean
  viewerAuthenticated?: boolean
  site?: SiteRecord | null
  readScope?: 'overview' | 'settings'
  connections?: Promise<Awaited<ReturnType<typeof loadSiteConnectionViews>> | null>
}

export async function loadSiteHome(siteId: string, options: SiteReadOptions = {}): Promise<SiteHomeView | null> {
  const site = options.site ?? await loadSiteRecord(siteId)
  if (!site) return null
  if (site.siteId !== siteId) throw new Error('Site query identity mismatch')
  return readSiteEvidence(site, () => readSiteHome(site, options))
}

async function readSiteHome(site: SiteRecord, options: SiteReadOptions): Promise<SiteHomeView> {
  const siteId = site.siteId
  const now = new Date()
  const settingsEvidence = options.readScope === 'settings' && options.ownerEvidence

  const selection = await loadSiteAnalysisSelection(site)
  // History only needs the site and its analysis selection, so it overlaps the
  // findings read. The empty catch keeps a rejected read handled if the latest
  // audit read fails before this promise is awaited.
  const monitoringHistoryPromise = loadMonitoringHistory(site, selection)
  void monitoringHistoryPromise.catch(() => undefined)
  const audit = await resolveLatestAudit(site, selection)
  const priorPromise = site.kind === 'project' ? resolvePriorCompletedAudit(site, audit?.id ?? null, selection) : Promise.resolve(null)
  const categoryEvidencePromise = audit?.status === 'COMPLETED'
    ? loadCategoryEvidence(categoryEvidenceBaselines(site.projectId, audit))
    : priorPromise.then(prior => loadCategoryEvidence(categoryEvidenceBaselines(site.projectId, audit, prior)))

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
    priorPromise,
    categoryEvidencePromise,
    monitoringHistoryPromise,
  ])
  const inFlight = isAuditInFlight(audit?.status)
  const { coverage, coverageMaxAgeMs, categoryEvidence, pendingAreas, pageScope, hasLastKnown, assessmentComplete } = projectCurrentSiteEvidence({
    audit: audit ? { ...audit, pages: checkedPages } : null, prior, flags, categories: categoryRuns, now,
    evidenceComplete: !recommendations.some(hasUnresolvedFlagEvidence),
    watchInterval: site.watchInterval, watchEveryMinutes: site.watchEveryMinutes,
  })

  const coverageByArea = new Map(coverage.map((c) => [c.area, c]))

  const finished = isAuditFinished(audit?.status)
  const [
    resultPage, captures, uptime, uptimeEvents, technologyProfile,
    activeRuns, connections, latestAlert, executionProgress, accountChecks, github,
  ] = await Promise.all([
    loadSiteCheckResultPage(site, audit, undefined, categoryEvidence),
    loadSiteCaptures(audit?.id ?? null, prior?.id ?? null, inFlight, audit?.startedAt ?? null),
    options.ownerEvidence && site.projectId ? loadUptimeSummary(site, now) : undefined,
    options.ownerEvidence && site.projectId ? loadUptimeEvents(site) : undefined,
    audit?.id ? loadTechnologyProfile(audit.id) : null,
    loadActiveSiteRuns(site, now),
    options.connections ?? (site.projectId ? loadSiteConnectionViews(site.projectId) : null),
    loadLatestWatchAlert(site.projectId, options.ownerEvidence ? site.userId : null),
    loadExecutionProgress(site, audit?.id ?? null),
    settingsEvidence && site.projectId ? loadAccountChecksView(site.projectId) : undefined,
    settingsEvidence && site.userId ? prisma.githubConnection.findUnique({ where: { userId: site.userId }, select: { githubLogin: true, revokedAt: true } }) : null,
  ])
  const summaryResults = audit ? projectCheckResults(audit.id, audit.verifierExecutions) : []
  const pageCoverage = executionPageCoverage({ auditId: audit?.id, executionSpec: audit?.executionSpec, pages: checkedPages,
    executions: audit?.verifierExecutions, failedModules: audit?.failedModules })
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
  })
  const categoryAreas = new Set<string>(categoryEvidence.keys())
  applyCardEvidence({ cards: cards.filter(card => !categoryAreas.has(card.id)), audit, summaryResults,
    inFlight, pageCount, connectionNotes, now, coverageMaxAgeMs, pendingAreas, pageScope })
  for (const [area, categoryAudit] of categoryEvidence) {
    const card = cards.find(card => card.id === area)
    if (!card) continue
    const categoryInFlight = isAuditInFlight(categoryAudit.status)
    applyCardEvidence({ cards: [card], audit: categoryAudit,
      summaryResults: projectCheckResults(categoryAudit.id, categoryAudit.verifierExecutions), inFlight: categoryInFlight,
      pageCount, connectionNotes, now, coverageMaxAgeMs, pageScope: recordedPageEvidenceScope(categoryAudit) })
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
    providerState: latestAlert?.providerState,
    now,
  })

  // A completed partial report starts a new check through the existing retry
  // action. Task-level configuration limits describe the saved run, not a live
  // execution that still owns its recovery. Keep this aligned with Site summaries.
  if (audit?.status !== 'COMPLETED' && presentation.run.recoveryAction === 'retry' &&
      executionProgress?.recovery && executionProgress.recovery.action !== 'retry')
    presentation.run.recoveryAction = 'view_details'

  return projectSiteHomeForViewer({
    schemaVersion: 2,
    readAt: now.getTime(),
    readScope: options.readScope ?? 'overview',
    actions: siteViewerActions(Boolean(options.ownerEvidence && site.projectId), options.viewerAuthenticated),
    counts: siteScopeCounts(flags, checkedPages, pageCount),
    captures, captureAvailability: siteCaptureAvailability(captures, audit), uptime,
    uptimeEvents: uptimeEvents?.map(event => ({ ...event, startedAt: event.startedAt.toISOString(), confirmedAt: event.confirmedAt.toISOString(), recoveredAt: event.recoveredAt?.toISOString() ?? null, supersededAt: event.supersededAt?.toISOString() ?? null })),
    inventoryPageCount: pageCount,
    activeRuns,
    site,
    executionProgress,
    activity: projectSiteActivity({ status: audit?.status ?? null, startedAt: audit?.startedAt ?? null, failureCode: audit?.failureCode ?? null,
      failureStage: audit?.failureStage, reportCompleteness: audit?.reportCompleteness,
      failedModules: audit?.failedModules, evidenceCoverage: audit?.evidenceCoverage,
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
      // Delivery history and current monitoring coverage are independent facts.
      alert: {
        state: alertState,
        status: latestAlert?.watchNotificationStatus ?? null,
        attempts: latestAlert?.watchNotificationAttempts ?? 0,
        leaseUntil: latestAlert?.watchNotificationLeaseUntil?.toISOString() ?? null,
        at: latestAlert?.completedAt?.toISOString() ?? null,
      },
    },
    settings: {
      ...(settingsEvidence ? { github: { configured: isGithubRepoAccessConfigured(), status: github ? github.revokedAt ? 'revoked' as const : 'connected' as const : 'not_connected' as const, login: github?.githubLogin ?? null } } : {}),
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

export async function loadSiteBoardFlag(siteId: string, flagId: string, resolvedSite?: SiteRecord) {
  const site = resolvedSite ?? await loadSiteRecord(siteId)
  if (site && site.siteId !== siteId) throw new Error('Site query identity mismatch')
  if (!site) return null
  return readSiteEvidence(site, () => readSiteBoardFlag(site, flagId))
}

async function readSiteBoardFlag(site: SiteRecord, flagId: string) {
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
