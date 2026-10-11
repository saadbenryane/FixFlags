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
import { CHECK_MODULES } from '@/lib/audit/check-registry'

export const BROWSER_SOURCE = SITE_BOARD_COPY.browserSource

/** Short customer label only; never mutate a recorded diagnosis or its scope. */
export function boardFindingTitle(title: string): string {
  return SITE_BOARD_COPY.compactHeadlines[title as keyof typeof SITE_BOARD_COPY.compactHeadlines]
    ?? (/^All touch targets must be 24px large, or leave sufficient space \(\d+ elements?\)$/.test(title) ? SITE_BOARD_COPY.smallTouchTargets : title)
}

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
  /** True when FixFlags has evidence for this area, including retained stale evidence. */
  evidenced: boolean
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
  /** Missing work proven for this area by the latest Audit, separate from retained findings. */
  incompleteReason?: string | null
}

/** Deterministic module failures have a known card owner. Other pipeline failures
 * cannot be assigned to an area without evidence. */
export const FAILED_MODULE_AREAS: Partial<Record<string, SiteCardArea[]>> = Object.fromEntries(
  Object.entries(CHECK_MODULES).map(([id, contract]) => [id, [contract.area]])
)

export function incompleteCardReason(input: {
  card: Pick<BoardCardView, 'id' | 'openFlagCount' | 'evidenced'>
  auditStatus: string | null
  failureCode: string | null
  failedModules: string[]
  triageCompleted: boolean
  extraReviewCompleted: boolean
}): string | null {
  if (input.auditStatus !== 'COMPLETED') return null
  if (input.failedModules.some((module) => FAILED_MODULE_AREAS[module]?.includes(input.card.id))) {
    return SITE_BOARD_COPY.cardCheckIncomplete
  }
  // Prescription enriches recorded Flags. Its failure does not invalidate a
  // completed browser check or imply that healthy cards were never checked.
  if (input.triageCompleted && !input.extraReviewCompleted &&
      ['AI_CONTRACT_INVALID', 'AI_REVIEW_FAILED'].includes(input.failureCode ?? '') &&
      input.card.openFlagCount > 0 && input.card.id !== 'site') {
    return SITE_BOARD_COPY.cardReviewIncomplete
  }
  if (input.failureCode && !input.card.evidenced && input.card.id !== 'site') {
    return SITE_BOARD_COPY.cardCheckIncomplete
  }
  return null
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
      return '0 Flags'
    case 'attention':
      return SITE_BOARD_COPY.flagStatus
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
  if (delta < 60_000) return 'Just now'
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
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
  _outcomes: Array<Pick<SiteOutcomeView, 'name' | 'pageUrls'>>,
  flag: Pick<SiteFlagSeed, 'relatedOutcome'> | null | undefined
): string | null {
  return flag?.relatedOutcome?.name ?? null
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
  journeyName?: string | null
  expectedBehavior?: string | null
}): string {
  return [
    `FixFlags Flag: ${input.problem}`,
    input.pageUrl ? `URL: ${input.pageUrl}` : null,
    input.journeyName ? `Outcome: ${input.journeyName}` : null,
    `Why it matters: ${input.whyItMatters}`,
    input.evidence?.trim() ? `Evidence: ${input.evidence.trim()}` : null,
    input.expectedBehavior?.trim() ? `Expected after a fix: ${input.expectedBehavior.trim()}` : null,
    `Fix: ${input.fix}`,
    'Copying this does not resolve the Flag. Verify with a fresh FixFlags check of the same page and action.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
}

export function boardAreaPrompt(areaName: string, flags: SiteFlagSeed[]): string {
  if (flags.length === 0) return ''
  const prompts = flags.map((flag, index) => boardFlagPrompt({
    problem: flag.problem,
    pageUrl: flag.pageUrl,
    whyItMatters: flag.whyItMatters,
    evidence: flag.evidence,
    fix: flag.fix,
  }).replace('FixFlags Flag:', `FixFlags Flag ${index + 1}:`))
  return [
    `Fix every open ${areaName} Flag below. Keep unrelated behavior unchanged, preserve the evidence scope for each page, and verify every fix against its stated evidence.`,
    ...prompts,
  ].join('\n\n---\n\n')
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
      const pageFlags = input.flags.filter((flag) => flag.area === 'site')
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
        pageFlags.length
          ? boardCardFooter({ openFlagCount: pageFlags.length, checkedAt: input.checkedAt })
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
        evidenced: Boolean(input.checkedAt || input.captureUrl || pageFlags.length),
        openFlagCount: pageFlags.length,
        checkedAt: input.checkedAt,
        flagIds: pageFlags.map((flag) => flag.id),
        flagChips: chipsForFlags(input.siteId, pageFlags),
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
      boardCardStatusText(state, activity, isProblem ? SITE_BOARD_COPY.flagStatus : fact?.stale ? SITE_BOARD_COPY.checkOutOfDate : null)
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
      evidenced: fact?.evidenced ?? false,
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
