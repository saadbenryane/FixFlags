import { prisma } from '@/lib/db'
import {
  CARD_CATALOG,
  STARTER_BOARD_CARDS,
  type CardHealthState,
  type SiteCardArea,
} from '@/lib/sites/card-areas'
import { buildCoverageFacts } from '@/lib/sites/coverage'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail, loadSiteFlags } from '@/lib/sites/flags'
import { listSiteOutcomes, syncOutcomesFromAudit } from '@/lib/sites/outcomes'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteRecord } from '@/lib/sites/types'

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
  coverageSummary: string
}

async function resolveLatestAudit(site: SiteRecord) {
  if (site.kind === 'project' && site.projectId) {
    return prisma.audit.findFirst({
      where: { projectId: site.projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        progress: true,
        score: true,
        completedAt: true,
        evidenceCoverage: true,
        url: true,
        rubrics: { select: { name: true, score: true } },
      },
    })
  }
  if (!site.primaryAuditId) return null
  return prisma.audit.findUnique({
    where: { id: site.primaryAuditId },
    select: {
      id: true,
      status: true,
      progress: true,
      score: true,
      completedAt: true,
      evidenceCoverage: true,
      url: true,
      rubrics: { select: { name: true, score: true } },
    },
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

  const coverage = buildCoverageFacts({
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
  })

  const coverageByArea = new Map(coverage.map((c) => [c.area, c]))
  const checking = !audit || !['COMPLETED', 'FAILED'].includes(audit.status)

  const siteCardState: CardHealthState = checking
    ? 'checking'
    : flags.some((f) => f.severity === 'CRITICAL')
      ? 'problem'
      : flags.length > 0
        ? 'attention'
        : audit?.status === 'COMPLETED'
          ? 'healthy'
          : 'unknown'

  const cards: BoardCardView[] = STARTER_BOARD_CARDS.map((area) => {
    if (area === 'site') {
      return {
        id: 'site',
        name: site.canonicalHost,
        question: CARD_CATALOG.site.question,
        state: siteCardState,
        answer: checking
          ? 'Learning your website'
          : flags.length > 0
            ? `${flags.length} thing${flags.length === 1 ? '' : 's'} need attention`
            : 'Looking good',
        detail: checking
          ? 'Getting to know what matters'
          : `${outcomes.length} outcome${outcomes.length === 1 ? '' : 's'} · Latest analysis`,
        score: audit?.score ?? null,
        openFlagCount: flags.length,
        checkedAt: audit?.completedAt?.toISOString() ?? null,
        flagIds: flags.map((f) => f.id),
      }
    }

    const fact = coverageByArea.get(area)
    const areaFlags = flags.filter((f) => f.area === area)
    return {
      id: area,
      name: CARD_CATALOG[area].name,
      question: CARD_CATALOG[area].question,
      state: fact?.state ?? 'unknown',
      answer: fact?.label ?? 'Not checked yet',
      detail: fact?.detail ?? null,
      score: fact?.score ?? null,
      openFlagCount: areaFlags.length,
      checkedAt: fact?.checkedAt ?? null,
      flagIds: areaFlags.map((f) => f.id),
    }
  })

  const watching = Boolean(site.watchInterval && site.watchNextRunAt)

  return {
    site,
    host: site.canonicalHost,
    statusLabel: checking
      ? 'Checking your Site'
      : flags.length > 0
        ? 'Needs attention'
        : watching
          ? 'Looking after this Site'
          : 'First look',
    statusState: siteCardState,
    audit: {
      id: audit?.id ?? null,
      status: audit?.status ?? null,
      progress: audit?.progress ?? 0,
      score: audit?.score ?? null,
    },
    cards,
    flags,
    outcomes,
    watching,
    coverageSummary: checking
      ? 'Analysis in progress'
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
