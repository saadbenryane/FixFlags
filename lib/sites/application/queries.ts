import type { UptimeSummary, UptimeIncidentView } from '@/lib/uptime/domain'
import { loadUptimeSummary, loadUptimeEvents } from '@/lib/uptime/queries'
import type { SiteCapture } from '@/lib/sites/captures'
import { loadAccountChecksView } from '../accounts/store'
import type { AccountChecksView } from '../accounts/contracts'
import { loadSiteAnalysisSelection } from './legacy-analysis'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { resolveLatestAudit, resolvePriorCompletedAudit } from './site-execution'
import { loadCategoryEvidence, applicableCategoryEvidence, overlayCategoryCoverage } from './category-evidence'
import { prisma } from '@/lib/db'
import { projectCheckResults, type SiteCheckResult } from '@/lib/sites/check-results'
import type { MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import { loadMonitoringHistory } from './monitoring-history'
import { loadActiveSiteRuns, type ActiveSiteRun } from './site-execution'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { loadExecutionProgress, type ExecutionProgress } from './execution-progress'
import {
  buildCoverageFacts,
  isAuditFinished,
  isAuditInFlight,
  type CoverageFact,
} from '@/lib/sites/coverage'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail, loadSiteFindings, loadSiteResolvedFlags } from '@/lib/sites/flags'
import { walkFinishedFromCoverage } from '@/lib/sites/first-outcome'
import { listSiteOutcomes } from '@/lib/sites/outcomes'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteRecord } from '@/lib/sites/types'
import { siteCardHealth } from '@/lib/sites/site-health'
import {
  watchBoardState,
  watchIsCovered,
  type WatchBoardState,
} from '@/lib/sites/watch-state'
import { watchAlertDelivery, type WatchAlertDeliveryState } from '@/lib/audit/watch-notification'
import { applyCardEvidence } from './card-evidence'
import { buildBoardCards, type BoardCardView } from '@/lib/sites/board-card'
import { connectionCardNotes, loadSiteConnectionViews } from '@/lib/sites/connections/read'
import type { PublicConnection } from '@/lib/sites/connections/match'
import { loadSiteCaptures } from './captures'
import { loadTechnologyProfile, type TechnologyProfileStatus, type VisibleTechnology } from '@/lib/audit/technology-profile'
import { isShopifyConfigured } from '@/lib/shopify/config'
import { projectSiteActivity, type SiteActivity } from '@/lib/sites/activity'
import {
  categoryPresentation,
  flagCountLabel,
  freshnessLabel,
  monitoringPresentation,
  pageCoverageLabel,
  pagesCardPresentation,
  resultPresentation,
  runPresentation,
  type SitePresentation,
} from '@/lib/sites/presentation'

export type { BoardCardView }

export type SiteHomeView = {
  schemaVersion: 2
  captures?: SiteCapture[]
  uptime?: UptimeSummary | null
  uptimeEvents?: UptimeIncidentView[]
  inventoryPageCount: number
  activeRuns: ActiveSiteRun[]
  monitoringTrend: MonitoringHistoryEntry[]
  site: SiteRecord
  presentation: SitePresentation
  activity?: SiteActivity
  recoveryUnavailable?: boolean
  executionProgress?: ExecutionProgress | null
  audit: {
    id: string | null
    status: string | null
    progress: number
    walkFinished: boolean
    failureCode: string | null
  }
  cards: BoardCardView[]
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
  resolvedFlags: SiteFlagSeed[]
  outcomes: SiteOutcomeView[]
  checkResults?: SiteCheckResult[]
  checkResultsNextCursor?: string | null
  technology?: {
    status: TechnologyProfileStatus
    detectedAt: string | null
    items: Array<Pick<VisibleTechnology, 'slug' | 'name' | 'category' | 'confidenceBand'>>
  }
  monitoringHistory: MonitoringHistoryEntry[]
  watch: {
    state: WatchBoardState
    interval: WatchInterval | null
    everyMinutes?: number | null
    nextRunAt: string | null
    lastRunAt: string | null
    lastError: string | null
    covered: boolean
    label: string
    /** Provider acceptance is separate from confirmed inbox delivery. */
    alert: {
      state: WatchAlertDeliveryState
      status: 'NOT_APPLICABLE' | 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | null
      attempts: number
      leaseUntil?: string | null
      at: string | null
    }
  }
  checkedPages?: Array<{ url: string; title: string | null; status: string; checkedAt: string }>
  settings: {
    accountChecks?: AccountChecksView
    notificationLevel: 'FLAGS' | 'CRITICAL_ONLY' | 'OFF' | null
    notifyOnRecovery: boolean | null
    shopify: { configured: boolean; state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
    searchConsole: PublicConnection
    analytics: PublicConnection
  }
}


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

export async function loadSiteHome(siteId: string, options: { ownerEvidence?: boolean } = {}): Promise<SiteHomeView | null> {
  const site = await loadSiteRecord(siteId)
  if (!site) return null
  const now = new Date()

  const selection = await loadSiteAnalysisSelection(site)
  const audit = await resolveLatestAudit(site, selection)

  const [{ flags, recommendations }, outcomes, pageCount, checkedPages, projectSettings, resolvedFlags] = await Promise.all([
    loadSiteFindings(site),
    listSiteOutcomes(site),
    countSitePages(site),
    audit ? prisma.auditPage.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' }, select: { url: true, title: true, status: true, updatedAt: true } }) : [],
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
  const siteCardState = health.state
  const captures = await loadSiteCaptures(audit?.id ?? null, prior?.id ?? null, inFlight, audit?.startedAt ?? null)
  const capture = captures.find(item => item.device === 'desktop')
  const [uptime, uptimeEvents] = options.ownerEvidence && site.projectId ? await Promise.all([
    loadUptimeSummary(site.projectId, now), loadUptimeEvents(site.projectId),
  ]) : [undefined, undefined]

  const technologyProfile = audit?.id ? await loadTechnologyProfile(audit.id) : null
  const analytics = technologyProfile?.technologies
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

  const watchState = watchBoardState({
    interval: site.watchInterval,
    nextRunAt: site.watchNextRunAt,
    lastError: site.watchLastError,
    consecutiveFailures: site.watchConsecutiveFailures,
  })
  const watching = watchIsCovered(watchState)
  const completedAt = (isAuditFinished(audit?.status) ? audit : prior)?.completedAt?.toISOString() ?? null
  const pagesReached = checkedPages.filter((page) => page.status === 'COMPLETED').length
  const pagesExpected = checkedPages.length
  const evidenceFacts = coverage.filter((fact) => fact.evidenced)
  const stale = evidenceFacts.length > 0 && evidenceFacts.every((fact) => fact.stale === true)
  const result = resultPresentation({
    auditStatus: audit?.status ?? null,
    healthState: siteCardState,
    flagCount: flags.length,
    stale,
    hasCurrentEvidence: finished && evidenceFacts.some((fact) => !fact.stale),
    assessmentResult: health.assessment.result,
  })
  const monitoring = monitoringPresentation(watchState, site.watchInterval, site.watchEveryMinutes)
  const projectedRun = runPresentation({
    auditId: audit?.id ?? null,
    auditStatus: audit?.status ?? null,
    startedAt: audit?.startedAt ?? null,
    failureCode: audit?.failureCode ?? null,
    reportCompleteness: audit?.reportCompleteness ?? null,
    failedModules: audit?.failedModules,
  })
  const presentation: SitePresentation = {
    identity: {
      siteId,
      name: site.name,
      host: site.canonicalHost,
      preview: capture ? {
        url: capture.url,
        pageUrl: capture.pageUrl,
        viewport: capture.viewport,
        recordedAt: capture.recordedAt,
      } : null,
    },
    result,
    monitoring,
    coverage: {
      pagesReached,
      pagesExpected,
      label: pageCoverageLabel(pagesReached, pagesExpected),
      complete: pagesExpected > 0 && pagesReached === pagesExpected,
    },
    freshness: {
      checkedAt: completedAt,
      stale,
      label: freshnessLabel(completedAt, now),
    },
    flags: {
      count: flags.length,
      label: flagCountLabel(flags.length),
      fixFirstCount: flags.filter((flag) => flag.priorityBand === 'fix_first').length,
    },
    run: projectedRun,
    categories: [],
  }
  const pagesCategory = pagesCardPresentation(presentation)
  presentation.categories = cards.map((card) => categoryPresentation({
    id: card.id,
    name: card.name,
    state: card.id === 'site' ? pagesCategory.state : card.state,
    answer: card.id === 'site' ? presentation.coverage.label : card.answer,
    status: card.id === 'site' ? pagesCategory.status : card.status,
    flagCount: card.openFlagCount,
    fixFirstCount: flags.filter((flag) => flag.area === card.id && flag.priorityBand === 'fix_first').length,
    checkedAt: card.checkedAt,
    coverageLimitation: card.incompleteReason,
    siteId,
    now,
  })).sort((left, right) => left.rank - right.rank)

  // Delivery is read from the most recent Watch alert rather than from the
  // Project, because delivery is a property of one alert and not of the
  // schedule. An older undelivered alert stays visible until a later alert is
  // actually delivered, so a customer is never told they were warned about a
  // change nobody reached them about.
  //
  // Guarded on a resolved projectId, like every other tenant-scoped read here. A
  // provisional Site has none, and querying with projectId: null would match
  // other tenants' unscoped Watch alerts.
  const latestAlert = site.projectId
    ? await prisma.audit.findFirst({
      where: { projectId: site.projectId, recheckTrigger: 'WATCH', watchNotificationStatus: { not: 'NOT_APPLICABLE' } },
      orderBy: { updatedAt: 'desc' },
      select: {
        watchNotificationStatus: true,
        watchNotificationAttempts: true,
        watchNotificationLeaseUntil: true,
        updatedAt: true,
      },
    })
    : null
  const alertState = watchAlertDelivery({
    status: latestAlert?.watchNotificationStatus ?? null,
    attempts: latestAlert?.watchNotificationAttempts ?? 0,
    leaseUntil: latestAlert?.watchNotificationLeaseUntil ?? null,
  })

  return {
    schemaVersion: 2,
    captures, uptime,
    uptimeEvents: uptimeEvents?.map(event => ({ ...event, startedAt: event.startedAt.toISOString(), confirmedAt: event.confirmedAt.toISOString(), recoveredAt: event.recoveredAt?.toISOString() ?? null, supersededAt: event.supersededAt?.toISOString() ?? null })),
    inventoryPageCount: pageCount,
    activeRuns,
    site,
    executionProgress: await loadExecutionProgress(site, audit?.id ?? null),
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
