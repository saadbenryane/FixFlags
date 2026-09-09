import {
  ADDABLE_BOARD_CARDS,
  CARD_CATALOG,
  STARTER_BOARD_CARDS,
  type CardHealthState,
  type SiteCardArea,
} from '@/lib/sites/card-areas'
import type { CoverageFact, SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

export const BROWSER_SOURCE = SITE_BOARD_COPY.browserSource

export type BoardCardProblem = {
  title: string
  body: string | null
  outcomeName: string | null
  href: string
  actionLabel: string
}

export type BoardCardFlagChip = {
  id: string
  title: string
  href: string
}

export type BoardCardView = {
  id: SiteCardArea
  name: string
  question: string
  state: CardHealthState
  status: string
  answer: string
  detail: string | null
  facts: string[]
  coverage: string | null
  score: number | null
  openFlagCount: number
  checkedAt: string | null
  flagIds: string[]
  flagChips: BoardCardFlagChip[]
  sources: string[]
  activity: 'checking' | null
  wide: boolean
  captureUrl: string | null
  captureAlt: string | null
  cropUrl: string | null
  cropAlt: string | null
  problem: BoardCardProblem | null
}

export function boardCardStatusText(
  state: CardHealthState,
  activity?: 'checking' | null,
  override?: string | null
): string {
  if (override) return override
  if (activity === 'checking' && state !== 'checking') return SITE_BOARD_COPY.checking
  switch (state) {
    case 'healthy':
      return SITE_BOARD_COPY.lookingGood
    case 'attention':
      return SITE_BOARD_COPY.needsAttention
    case 'problem':
      return SITE_BOARD_COPY.flagStatus
    case 'checking':
      return SITE_BOARD_COPY.checking
    case 'unknown':
      return SITE_BOARD_COPY.notCheckedYet
  }
}

/** Visible header text. Attention and problem cards show Flag chips instead. */
export function boardCardHeaderText(
  state: CardHealthState,
  activity: 'checking' | null | undefined,
  checkedAt: string | null,
  now = Date.now()
): string | null {
  if (activity === 'checking' || state === 'checking') return SITE_BOARD_COPY.checking
  if (state === 'healthy') return boardCardFreshnessText(checkedAt, now) ?? SITE_BOARD_COPY.lastChecked
  return null
}

export function boardCardSignalLabel(
  state: CardHealthState,
  activity: 'checking' | null | undefined,
  checkedAt: string | null,
  now = Date.now()
): string {
  return (
    boardCardHeaderText(state, activity, checkedAt, now) ?? boardCardStatusText(state, activity)
  )
}

export function boardCardFreshnessText(checkedAt: string | null, now = Date.now()): string | null {
  if (!checkedAt) return null
  const then = Date.parse(checkedAt)
  if (!Number.isFinite(then)) return SITE_BOARD_COPY.lastChecked
  const delta = now - then
  if (delta < 60_000) return SITE_BOARD_COPY.lastChecked
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return `Checked ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `Checked ${hours}h ago`
  return SITE_BOARD_COPY.lastChecked
}

export function boardCardFooter(input: {
  openFlagCount: number
  checkedAt: string | null
  pageCount?: number | null
}): string {
  if (input.openFlagCount > 0) {
    return `${input.openFlagCount} Flag${input.openFlagCount === 1 ? '' : 's'}`
  }
  if (input.pageCount && input.pageCount > 0) {
    return input.pageCount === 1 ? '1 page' : `${input.pageCount} pages`
  }
  if (input.checkedAt) return 'Checked'
  return SITE_BOARD_COPY.notCheckedYet
}

export function pageCountLabel(pageCount: number): string {
  return pageCount === 1 ? '1 page' : `${pageCount} pages`
}

export function outcomeNameForFlag(
  outcomes: Array<Pick<SiteOutcomeView, 'name' | 'pageUrls'>>,
  flag: Pick<SiteFlagSeed, 'pageUrl'> | null | undefined
): string | null {
  if (!flag) return outcomes[0]?.name ?? null
  if (flag.pageUrl) {
    const match = outcomes.find((outcome) =>
      outcome.pageUrls.some(
        (url) =>
          url === flag.pageUrl ||
          Boolean(flag.pageUrl && (flag.pageUrl.startsWith(url) || url.startsWith(flag.pageUrl)))
      )
    )
    if (match) return match.name
  }
  return outcomes[0]?.name ?? null
}

export function starterBoardNames(): string[] {
  return STARTER_BOARD_CARDS.map((id) => CARD_CATALOG[id].name)
}

export function visibleFlagChips(chips: BoardCardFlagChip[], limit = 3): {
  shown: BoardCardFlagChip[]
  overflow: number
} {
  return {
    shown: chips.slice(0, limit),
    overflow: Math.max(0, chips.length - limit),
  }
}

export function sourcesForArea(
  area: SiteCardArea,
  detected: { analytics?: string[] } | undefined
): string[] {
  if (area === 'tracking') {
    const analytics = (detected?.analytics ?? []).filter(Boolean)
    if (analytics.length > 0) return analytics
  }
  return [BROWSER_SOURCE]
}

export function formatBoardSources(sources: string[]): string {
  const unique = [...new Set(sources.filter(Boolean))]
  return unique.length > 0 ? unique.join(' · ') : BROWSER_SOURCE
}

export function boardFlagPrompt(input: {
  problem: string
  whyItMatters: string
  evidence?: string | null
  fix: string
  pageUrl?: string | null
  expectedBehavior?: string | null
}): string {
  return [
    `FixFlags Flag: ${input.problem}`,
    input.pageUrl ? `Where: ${input.pageUrl}` : null,
    `Why it matters: ${input.whyItMatters}`,
    input.evidence?.trim() ? `Evidence: ${input.evidence.trim()}` : null,
    input.expectedBehavior?.trim() ? `Expected after a fix: ${input.expectedBehavior.trim()}` : null,
    `Fix: ${input.fix}`,
    'Copying this does not resolve the Flag. Verify with a fresh FixFlags check of the same page and action.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
}

function chipsForFlags(siteId: string, flags: SiteFlagSeed[]): BoardCardFlagChip[] {
  return flags.map((flag) => ({
    id: flag.id,
    title: flag.problem,
    href: `/sites/${siteId}/flags/${flag.id}`,
  }))
}

export function buildBoardCards(input: {
  siteId: string
  inFlight: boolean
  hasLastKnown: boolean
  health: { state: CardHealthState; answer: string; statusLabel: string }
  coverageByArea: Map<SiteCardArea, CoverageFact>
  flags: SiteFlagSeed[]
  outcomes: SiteOutcomeView[]
  pageCount: number
  captureUrl: string | null
  checkedAt: string | null
  areas?: SiteCardArea[]
  detected?: { analytics?: string[] }
}): BoardCardView[] {
  const activity: 'checking' | null = input.inFlight ? 'checking' : null
  const areas = input.areas ?? [...STARTER_BOARD_CARDS, ...ADDABLE_BOARD_CARDS]

  return areas.map((area) => {
    if (area === 'site') {
      const learning = input.inFlight && !input.hasLastKnown
      const answer = learning
        ? input.pageCount > 0
          ? SITE_BOARD_COPY.pagesLoading
          : SITE_BOARD_COPY.learning
        : input.health.answer
      const status = learning
        ? answer
        : boardCardHeaderText(input.health.state, activity, input.checkedAt) ??
          boardCardStatusText(input.health.state, activity, input.health.statusLabel)
      const pages = input.pageCount > 0 ? pageCountLabel(input.pageCount) : null
      const facts = [
        pages,
        input.flags.length
          ? boardCardFooter({ openFlagCount: input.flags.length, checkedAt: input.checkedAt })
          : null,
      ].filter((value): value is string => Boolean(value))

      return {
        id: 'site',
        name: CARD_CATALOG.site.name,
        question: CARD_CATALOG.site.question,
        state: input.health.state,
        status,
        answer,
        detail: pages ?? (learning ? 'Getting to know what matters' : null),
        facts,
        coverage: null,
        score: null,
        openFlagCount: input.flags.length,
        checkedAt: input.checkedAt,
        flagIds: input.flags.map((flag) => flag.id),
        flagChips: chipsForFlags(input.siteId, input.flags),
        sources: sourcesForArea('site', input.detected),
        activity,
        wide: true,
        captureUrl: input.captureUrl,
        captureAlt: input.captureUrl ? 'Latest captured page from this Site' : null,
        cropUrl: null,
        cropAlt: null,
        problem: null,
      }
    }

    const fact = input.coverageByArea.get(area)
    const areaFlags = input.flags.filter((flag) => flag.area === area)
    const firstFlag = areaFlags[0]
    const isProblem = (fact?.state ?? 'unknown') === 'problem' && Boolean(firstFlag)
    const state = fact?.state ?? 'unknown'
    const status =
      boardCardHeaderText(state, activity, fact?.checkedAt ?? input.checkedAt) ??
      boardCardStatusText(state, activity, isProblem ? SITE_BOARD_COPY.flagStatus : null)
    const outcomeName = isProblem ? outcomeNameForFlag(input.outcomes, firstFlag) : null
    const problem: BoardCardProblem | null =
      isProblem && firstFlag
        ? {
            title: firstFlag.problem,
            body: firstFlag.whyItMatters,
            outcomeName,
            href: `/sites/${input.siteId}/flags/${firstFlag.id}`,
            actionLabel: SITE_BOARD_COPY.openFlag,
          }
        : null

    return {
      id: area,
      name: CARD_CATALOG[area].name,
      question: CARD_CATALOG[area].question,
      state,
      status,
      answer: problem?.title ?? fact?.label ?? SITE_BOARD_COPY.notCheckedYet,
      detail: problem?.body ?? fact?.detail ?? null,
      facts: [fact?.detail, outcomeName].filter((value): value is string => Boolean(value)).slice(0, 3),
      coverage: fact?.evidenced
        ? fact.detail
        : state === 'unknown'
          ? SITE_BOARD_COPY.notCheckedYet
          : null,
      score: null,
      openFlagCount: areaFlags.length,
      checkedAt: fact?.checkedAt ?? null,
      flagIds: areaFlags.map((flag) => flag.id),
      flagChips: chipsForFlags(input.siteId, areaFlags),
      sources: sourcesForArea(area, input.detected),
      activity,
      wide: false,
      captureUrl: null,
      captureAlt: null,
      cropUrl: null,
      cropAlt: null,
      problem,
    }
  })
}
