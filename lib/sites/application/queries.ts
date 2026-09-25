import { prisma } from '@/lib/db'
import { type CardHealthState } from '@/lib/sites/card-areas'
import {
  buildCoverageFacts,
  isAuditFinished,
  isAuditInFlight,
  type CoverageFact,
} from '@/lib/sites/coverage'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail, loadSiteFindings } from '@/lib/sites/flags'
import { walkFinishedFromCoverage } from '@/lib/sites/first-outcome'
import { listSiteOutcomes } from '@/lib/sites/outcomes'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteRecord } from '@/lib/sites/types'
import { siteCardHealth } from '@/lib/sites/site-health'
import {
  watchBoardLabel,
  watchBoardState,
  watchIsCovered,
  type WatchBoardState,
} from '@/lib/sites/watch-state'
import { buildBoardCards, type BoardCardView } from '@/lib/sites/board-card'
import { connectionCardNotes, loadSiteConnectionViews } from '@/lib/sites/connections/read'
import type { PublicConnection } from '@/lib/sites/connections/match'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { recoverAuditJobOnPoll } from '@/lib/audit/recover-audit-job'

export type { BoardCardView }

export type SiteHomeView = {
  site: SiteRecord
  host: string
  statusLabel: string
  statusState: CardHealthState
  audit: {
    id: string | null
    status: string | null
    progress: number
    score: number | null
    walkFinished: boolean
    failureCode: string | null
  }
  cards: BoardCardView[]
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
  outcomes: SiteOutcomeView[]
  watching: boolean
  watch: {
    state: WatchBoardState
    interval: 'weekly' | 'daily' | null
    nextRunAt: string | null
    lastError: string | null
    covered: boolean
    label: string
  }
  coverageSummary: string
  checkedPages?: Array<{ url: string; title: string | null; status: string }>
  settings?: {
    notificationLevel: 'FLAGS' | 'CRITICAL_ONLY' | 'OFF'
    notifyOnRecovery: boolean
    shopify: { state: 'connected' | 'unavailable' | 'not_connected'; domain: string | null }
    searchConsole: PublicConnection
    analytics: PublicConnection
  }
}

const auditSelect = {
  id: true,
  status: true,
  progress: true,
  score: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  failureCode: true,
  evidenceCoverage: true,
  url: true,
  rubrics: { select: { name: true, score: true } },
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
    rubrics: Array<{ name: string; score: number | null }>
  } | null,
  flags: SiteFlagSeed[],
  lastKnown?: CoverageFact[] | null,
  retainLastKnownWhileChecking?: boolean
) {
  return buildCoverageFacts({
    auditStatus: audit?.status ?? 'QUEUED',
    completedAt: audit?.completedAt ?? null,
    evidenceCoverage: audit?.evidenceCoverage,
    flags: flags.map((f) => ({
      checkId: f.checkId,
      rubric: f.rubric,
      severity: f.severity,
      impactTag: f.impactTag,
      status: 'OPEN',
    })),
    rubrics: (audit?.rubrics ?? []).map((r) => ({ name: r.name, score: r.score })),
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

async function latestDesktopCapture(auditId: string | null): Promise<string | null> {
  if (!auditId) return null
  const shot = await prisma.screenshot.findFirst({
    where: { auditId, device: 'DESKTOP' },
    orderBy: { id: 'desc' },
    select: { url: true },
  })
  if (!shot?.url) return null
  return normalizeInternalScreenshotUrl(shot.url)
}

export async function loadSiteHome(siteId: string): Promise<SiteHomeView | null> {
  const site = await loadSiteRecord(siteId)
  if (!site) return null

  let audit = await resolveLatestAudit(site)
  if (audit && isAuditInFlight(audit.status) && Date.now() - audit.updatedAt.getTime() > 15_000) {
    try {
      await recoverAuditJobOnPoll(audit.id, audit)
      audit = await resolveLatestAudit(site)
    } catch {
      // The board still shows the current status if the queue cannot be reached.
    }
  }

  const [{ flags, recommendations }, outcomes, pageCount, checkedPages, projectSettings] = await Promise.all([
    loadSiteFindings(site),
    listSiteOutcomes(site),
    countSitePages(site),
    audit ? prisma.auditPage.findMany({ where: { auditId: audit.id }, orderBy: { position: 'asc' }, select: { url: true, title: true, status: true } }) : [],
    site.projectId ? prisma.project.findUnique({
      where: { id: site.projectId },
      select: {
        notificationLevel: true,
        notifyOnRecovery: true,
        shopifyShops: { take: 1, select: { shopDomain: true, uninstalledAt: true } },
      },
    }) : null,
  ])

  const inFlight = isAuditInFlight(audit?.status)
  const prior =
    inFlight && site.kind === 'project'
      ? await resolvePriorCompletedAudit(site, audit?.id ?? null)
      : null

  const lastKnownFacts =
    prior != null
      ? factsFromAudit(prior, flags)
      : isAuditFinished(audit?.status)
        ? null
        : null

  const coverage = factsFromAudit(
    audit,
    flags,
    lastKnownFacts,
    Boolean(inFlight && lastKnownFacts)
  )

  const coverageByArea = new Map(coverage.map((c) => [c.area, c]))

  const finished = isAuditFinished(audit?.status)
  const health = siteCardHealth({
    inFlight,
    finished,
    hasLastKnown: Boolean(lastKnownFacts),
    flags,
    coverage,
  })
  const siteCardState = health.state
  const captureUrl =
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
    captureUrl,
    checkedAt: (prior ?? audit)?.completedAt?.toISOString() ?? null,
    detected: { analytics },
  })
  for (const card of cards) {
    if (card.id === 'search' && connectionNotes.search) card.facts = [...card.facts, connectionNotes.search].slice(0, 4)
    if (card.id === 'tracking' && connectionNotes.tracking) card.facts = [...card.facts, connectionNotes.tracking].slice(0, 4)
    if (card.id === 'search' && connections?.searchConsole.status === 'connected') card.sources = [...card.sources, 'Search Console']
    if (card.id === 'tracking' && connections?.analytics.status === 'connected') card.sources = [...card.sources, 'Google Analytics']
  }

  const watchState = watchBoardState({
    interval: site.watchInterval,
    nextRunAt: site.watchNextRunAt,
    lastError: site.watchLastError,
    consecutiveFailures: site.watchConsecutiveFailures,
  })
  const watching = watchIsCovered(watchState)

  return {
    site,
    checkedPages,
    host: site.canonicalHost,
    statusLabel: inFlight
      ? lastKnownFacts
        ? 'Checking again'
        : 'Learning your website'
      : flags.length > 0
        ? flags.length === 1 ? '1 Flag' : `${flags.length} Flags`
        : health.statusLabel,
    statusState: siteCardState,
    audit: {
      id: audit?.id ?? null,
      status: audit?.status ?? null,
      progress: audit?.progress ?? 0,
      score: inFlight ? null : (audit?.score ?? null),
      walkFinished: walkFinishedFromCoverage(audit?.status, audit?.evidenceCoverage),
      failureCode: audit?.failureCode ?? null,
    },
    cards,
    flags,
    recommendations,
    outcomes,
    watching,
    watch: {
      state: watchState,
      interval: site.watchInterval,
      nextRunAt: site.watchNextRunAt?.toISOString() ?? null,
      lastError: site.watchLastError,
      covered: watching,
      label: watchBoardLabel(watchState, site.watchInterval),
    },
    coverageSummary: inFlight
      ? lastKnownFacts
        ? 'Checking again. Prior answers stay until this finishes.'
        : 'Learning your website. Cards update as each area finishes.'
      : health.state === 'unknown'
        ? health.answer
        : `Checked ${audit?.completedAt ? 'recently' : 'once'} · ${flags.length} open Flag${flags.length === 1 ? '' : 's'}`,
    settings: {
      notificationLevel: projectSettings?.notificationLevel ?? 'FLAGS',
      notifyOnRecovery: projectSettings?.notifyOnRecovery ?? true,
      shopify: projectSettings?.shopifyShops[0]
        ? {
            state: projectSettings.shopifyShops[0].uninstalledAt ? 'unavailable' : 'connected',
            domain: projectSettings.shopifyShops[0].shopDomain,
          }
        : { state: 'not_connected', domain: null },
      searchConsole: connections?.searchConsole ?? { ...emptyConnection('SEARCH_CONSOLE'), detail: 'Claim this Site before connecting a provider.' },
      analytics: connections?.analytics ?? { ...emptyConnection('ANALYTICS'), detail: 'Claim this Site before connecting a provider.' },
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
  return { site, flag }
}
