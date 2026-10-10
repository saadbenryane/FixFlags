import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { SiteCheckResult } from '@/lib/sites/check-results'
import { loadSiteCheckResults } from '@/lib/sites/application/check-results'
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
import { buildBoardCards, incompleteCardReason, type BoardCardView } from '@/lib/sites/board-card'
import { connectionCardNotes, loadSiteConnectionViews } from '@/lib/sites/connections/read'
import type { PublicConnection } from '@/lib/sites/connections/match'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { recoverAuditJobOnPoll } from '@/lib/audit/recover-audit-job'
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
  site: SiteRecord
  presentation: SitePresentation
  activity?: SiteActivity
  recoveryUnavailable?: boolean
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
  watch: {
    state: WatchBoardState
    interval: 'weekly' | 'daily' | null
    nextRunAt: string | null
    lastRunAt: string | null
    lastError: string | null
    covered: boolean
    label: string
    /**
     * Whether the last warranted Watch alert actually reached the customer.
     * Carries the raw evidence as well as the verdict, so the notice is derived
     * in one place rather than decided twice.
     */
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
    notificationLevel: 'FLAGS' | 'CRITICAL_ONLY' | 'OFF' | null
    notifyOnRecovery: boolean | null
    shopify: { configured: boolean; state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
    searchConsole: PublicConnection
    analytics: PublicConnection
  }
}

const auditSelect = {
  id: true,
  status: true,
  progress: true,
  reviewDepth: true,
  triageAt: true,
  aiReviewAt: true,
  failedModules: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  pipelineEvents: { orderBy: { occurredAt: 'desc' }, take: 100, select: { stage: true, event: true, status: true, occurredAt: true } },
  failureCode: true,
  evidenceCoverage: true,
  verifierExecutions: {
    where: { targetKey: { startsWith: 'module:' } },
    select: { id: true, targetKey: true, status: true, pageUrl: true, detail: true, updatedAt: true },
  },
  url: true,
} as const

async function resolveLatestAudit(site: SiteRecord) {
  if (site.kind === 'project' && site.projectId) {
    return prisma.audit.findFirst({
      where: { projectId: site.projectId },
      orderBy: { createdAt: 'desc' },
      select: auditSelect,
    })
  }
  if (!site.primaryAuditId) return null
  return prisma.audit.findUnique({
    where: { id: site.primaryAuditId },
    select: auditSelect,
  })
}

async function resolvePriorCompletedAudit(site: SiteRecord, currentId: string | null) {
  if (site.kind === 'project' && site.projectId) {
    return prisma.audit.findFirst({
      where: {
        projectId: site.projectId,
        status: 'COMPLETED',
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      orderBy: { completedAt: 'desc' },
      select: auditSelect,
    })
  }
  return null
}

function factsFromAudit(
  audit: {
    status: string
    completedAt: Date | null
    evidenceCoverage: unknown
    verifierExecutions?: Array<{ targetKey: string; status: string }>
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

type SitePreview = NonNullable<SitePresentation['identity']['preview']> & { auditId: string }

async function latestDesktopCapture(auditId: string | null): Promise<SitePreview | null> {
  if (!auditId) return null
  const shot = await prisma.screenshot.findFirst({
    where: { auditId, device: 'DESKTOP' },
    orderBy: { id: 'desc' },
    select: { url: true, width: true, height: true, audit: { select: { url: true, completedAt: true } }, page: { select: { url: true, updatedAt: true } } },
  })
  if (!shot?.url) return null
  return { url: normalizeInternalScreenshotUrl(shot.url), auditId, pageUrl: shot.page?.url ?? shot.audit.url,
    viewport: `${shot.width} × ${shot.height}`, recordedAt: (shot.audit.completedAt ?? shot.page?.updatedAt)?.toISOString() ?? null }
}

export async function loadSiteHome(siteId: string): Promise<SiteHomeView | null> {
  const site = await loadSiteRecord(siteId)
  if (!site) return null
  const now = new Date()

  let audit = await resolveLatestAudit(site)
  let recoveryUnavailable = false
  if (audit && isAuditInFlight(audit.status) && Date.now() - audit.updatedAt.getTime() > 15_000) {
    try {
      await recoverAuditJobOnPoll(audit.id, audit)
      audit = await resolveLatestAudit(site)
    } catch (error) {
      recoveryUnavailable = true
      logger.warn('Site run recovery unavailable', { siteId, error })
    }
  }

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
      ? await resolvePriorCompletedAudit(site, audit?.id ?? null)
      : null

  const lastKnownFacts =
    prior != null
      ? factsFromAudit(prior, flags, now)
      : null

  const coverage = factsFromAudit(
    audit,
    flags,
    now,
    lastKnownFacts,
    Boolean(lastKnownFacts)
  )

  const coverageByArea = new Map(coverage.map((c) => [c.area, c]))

  const finished = isAuditFinished(audit?.status)
  const health = siteCardHealth({
    inFlight,
    finished,
    hasLastKnown: Boolean(lastKnownFacts),
    flags,
    coverage,
    now,
    outcomes: outcomes.map((outcome) => ({ state: outcome.state, enabled: outcome.enabled })),
  })
  const siteCardState = health.state
  const capture =
    (await latestDesktopCapture(audit?.id ?? null)) ??
    (await latestDesktopCapture(prior?.id ?? null))

  const analytics =
    audit?.id
      ? (await loadTechnologyProfile(audit.id)).technologies
          .filter((tech) => tech.category === 'analytics')
          .map((tech) => tech.name)
      : []

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
    checkedAt: (prior ?? audit)?.completedAt?.toISOString() ?? null,
    detected: { analytics },
  })
  for (const card of cards) {
    // Category activity needs an actual method receipt, not a blanket run flag.
    const moduleKey = ({ security: 'module:security', tracking: 'module:measurement', accessibility: 'module:accessibility' } as Record<string, string>)[card.id]
    const execution = audit?.verifierExecutions.find((item) => item.targetKey === moduleKey)
    card.activity = card.id === 'site' && audit?.status === 'CAPTURING' ? 'checking' : null
    if (!card.evidenced && card.openFlagCount === 0 && inFlight) {
      card.state = 'unknown'
      card.status = execution?.status === 'COMPLETED' ? 'Evidence recorded' : 'Waiting'
      card.answer = execution?.status === 'COMPLETED' ? `${card.name} checks completed` : `Waiting for ${card.name.toLowerCase()} evidence`
      card.detail = null
    }
    if (inFlight && card.id === 'site') {
      card.state = 'unknown'; card.status = 'Pages'; card.answer = pageCount > 0 ? `${pageCount} pages recorded` : 'Waiting for pages'; card.detail = null
    }
    if (audit?.status === 'FAILED' && !audit.startedAt && !card.evidenced) {
      card.answer = 'Not checked'; card.status = 'Not checked'; card.detail = 'The check did not start.'
    }
    if (card.id === 'search' && connectionNotes.search) card.facts = [...card.facts, connectionNotes.search].slice(0, 4)
    if (card.id === 'tracking' && connectionNotes.tracking) card.facts = [...card.facts, connectionNotes.tracking].slice(0, 4)
    if (card.id === 'search' && connections?.searchConsole.status === 'connected') card.sources = [...card.sources, 'Search Console']
    if (card.id === 'tracking' && connections?.analytics.status === 'connected') card.sources = [...card.sources, 'Google Analytics']
    card.incompleteReason = incompleteCardReason({
      card,
      auditStatus: audit?.status ?? null,
      failureCode: audit?.failureCode ?? null,
      failedModules: Array.isArray(audit?.failedModules) ? audit.failedModules.filter((item): item is string => typeof item === 'string') : [],
      triageCompleted: Boolean(audit?.triageAt),
      extraReviewCompleted: Boolean(audit?.aiReviewAt),
    })
    if (card.incompleteReason && card.state === 'healthy') card.state = 'unknown'
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
  })
  const monitoring = monitoringPresentation(watchState, site.watchInterval)
  const projectedRun = runPresentation({
    auditId: audit?.id ?? null,
    auditStatus: audit?.status ?? null,
    startedAt: audit?.startedAt ?? null,
    failureCode: audit?.failureCode ?? null,
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
    flagCount: card.id === 'site' ? 0 : card.openFlagCount,
    fixFirstCount: card.id === 'site' ? 0 : flags.filter((flag) => flag.area === card.id && flag.priorityBand === 'fix_first').length,
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
    site,
    recoveryUnavailable,
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
    checkResults: await loadSiteCheckResults(site, audit?.id ?? null),
    watch: {
      state: watchState,
      interval: site.watchInterval,
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
