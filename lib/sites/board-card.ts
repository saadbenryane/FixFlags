import {
  CARD_CATALOG,
  STARTER_BOARD_CARDS,
  type CardHealthState,
  type SiteCardArea,
} from '@/lib/sites/card-areas'
import type { CoverageFact, SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

export type BoardCardProblem = {
  title: string
  body: string | null
  outcomeName: string | null
  href: string
  actionLabel: string
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
  if (activity === 'checking' && state !== 'checking') return 'Checking'
  switch (state) {
    case 'healthy':
      return SITE_BOARD_COPY.lookingGood
    case 'attention':
      return 'Needs attention'
    case 'problem':
      return SITE_BOARD_COPY.flagStatus
    case 'checking':
      return 'Checking'
    case 'unknown':
      return 'Not checked yet'
  }
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
  return 'Not checked yet'
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
        (url) => url === flag.pageUrl || Boolean(flag.pageUrl && url.startsWith(flag.pageUrl))
      )
    )
    if (match) return match.name
  }
  return outcomes[0]?.name ?? null
}

export function starterBoardNames(): string[] {
  return STARTER_BOARD_CARDS.map((id) => CARD_CATALOG[id].name)
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
}): BoardCardView[] {
  const activity: 'checking' | null = input.inFlight ? 'checking' : null

  return STARTER_BOARD_CARDS.map((area) => {
    if (area === 'site') {
      const learning = input.inFlight && !input.hasLastKnown
      const answer = learning
        ? input.pageCount > 0
          ? SITE_BOARD_COPY.pagesLoading
          : SITE_BOARD_COPY.learning
        : input.health.answer
      const status = learning
        ? answer
        : boardCardStatusText(input.health.state, activity, input.health.statusLabel)
      const pages = input.pageCount > 0 ? pageCountLabel(input.pageCount) : null
      const facts = [
        pages,
        input.flags.length ? boardCardFooter({ openFlagCount: input.flags.length, checkedAt: input.checkedAt }) : null,
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
    const status = boardCardStatusText(state, activity, isProblem ? SITE_BOARD_COPY.flagStatus : null)
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
      answer: problem?.title ?? fact?.label ?? 'Not checked yet',
      detail: problem?.body ?? fact?.detail ?? null,
      facts: [fact?.detail, outcomeName].filter((value): value is string => Boolean(value)).slice(0, 3),
      coverage: fact?.evidenced
        ? fact.detail
        : state === 'unknown'
          ? 'Not checked yet'
          : null,
      score: null,
      openFlagCount: areaFlags.length,
      checkedAt: fact?.checkedAt ?? null,
      flagIds: areaFlags.map((flag) => flag.id),
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
