import { prisma } from '@/lib/db'
import {
  CARD_CATALOG,
  STARTER_BOARD_CARDS,
  type CardHealthState,
  type SiteCardArea,
} from '@/lib/sites/card-areas'
import {
  buildCoverageFacts,
  isAuditFinished,
  isAuditInFlight,
  type CoverageFact,
} from '@/lib/sites/coverage'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail, loadSiteFlags } from '@/lib/sites/flags'
import { listSiteOutcomes, syncOutcomesFromAudit } from '@/lib/sites/outcomes'
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

export type BoardCardView = {
  id: SiteCardArea
  name: string
  question: string
  state: CardHealthState
  answer: string
  detail: string | null
  score: number | null
  openFlagCount: number
  checkedAt: string | null
  flagIds: string[]
  activity?: 'checking' | null
}

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
  }
  cards: BoardCardView[]
  flags: SiteFlagSeed[]
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
}

const auditSelect = {
  id: true,
  status: true,
  progress: true,
  score: true,
  completedAt: true,
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

export async function loadSiteHome(siteId: string): Promise<SiteHomeView | null> {
  const site = await loadSiteRecord(siteId)
  if (!site) return null

  const audit = await resolveLatestAudit(site)
  if (audit) {
    await syncOutcomesFromAudit({
      site,
      auditId: audit.id,
      url: audit.url,
    }).catch(() => [])
  }

  const [flags, outcomes] = await Promise.all([
    loadSiteFlags(site),
    listSiteOutcomes(site),
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

  const cards: BoardCardView[] = STARTER_BOARD_CARDS.map((area) => {
    if (area === 'site') {
      return {
        id: 'site',
        name: site.canonicalHost,
        question: CARD_CATALOG.site.question,
        state: siteCardState,
        answer: inFlight && !lastKnownFacts
          ? 'Learning your website'
          : health.answer,
        detail: inFlight
          ? lastKnownFacts
            ? 'Checking again — last known kept'
            : 'Getting to know what matters'
          : `${outcomes.length} outcome${outcomes.length === 1 ? '' : 's'} · Latest analysis`,
        score: null,
        openFlagCount: flags.length,
        checkedAt: (prior ?? audit)?.completedAt?.toISOString() ?? null,
        flagIds: flags.map((f) => f.id),
        activity: inFlight ? 'checking' : null,
      }
    }

    const fact = coverageByArea.get(area)
    const areaFlags = flags.filter((f) => f.area === area)
    const showCheckingActivity = inFlight
    return {
      id: area,
      name: CARD_CATALOG[area].name,
      question: CARD_CATALOG[area].question,
      state: fact?.state ?? 'unknown',
      answer: fact?.label ?? 'Not checked yet',
      detail: fact?.detail ?? null,
      score: null,
      openFlagCount: areaFlags.length,
      checkedAt: fact?.checkedAt ?? null,
      flagIds: areaFlags.map((f) => f.id),
      activity: showCheckingActivity ? 'checking' : null,
    }
  })

  const watchState = watchBoardState({
    interval: site.watchInterval,
    nextRunAt: site.watchNextRunAt,
    lastError: site.watchLastError,
    consecutiveFailures: site.watchConsecutiveFailures,
  })
  const watching = watchIsCovered(watchState)

  return {
    site,
    host: site.canonicalHost,
    statusLabel: inFlight
      ? lastKnownFacts
        ? 'Checking again'
        : 'Learning your website'
      : flags.length > 0
        ? 'Needs attention'
        : watching
          ? 'Looking after this Site'
          : health.statusLabel,
    statusState: siteCardState,
    audit: {
      id: audit?.id ?? null,
      status: audit?.status ?? null,
      progress: audit?.progress ?? 0,
      score: inFlight ? null : (audit?.score ?? null),
    },
    cards,
    flags,
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
  }
}

export async function loadSiteBoardFlag(siteId: string, flagId: string) {
  const site = await loadSiteRecord(siteId)
  if (!site) return null
  const flag = await loadSiteFlagDetail(site, flagId)
  if (!flag) return null
  return { site, flag }
}
