import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { STARTER_BOARD_CARDS } from '@/lib/sites/card-areas'
import { siteCoverageIsStale, type CoverageFact } from '@/lib/sites/coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { CustomerOutcomeState } from '@/lib/sites/outcome-state'

/** Starter areas that must be evidenced before the Site card can say healthy. */
export const REQUIRED_STARTER_AREAS: SiteCardArea[] = STARTER_BOARD_CARDS.filter(
  (area) => area !== 'site'
)

export function requiredAreasUnchecked(coverage: CoverageFact[]): CoverageFact[] {
  return coverage.filter(
    (fact) =>
      REQUIRED_STARTER_AREAS.includes(fact.area) &&
      (fact.state === 'unknown' || !fact.evidenced)
  )
}

/**
 * Site-level health is coverage-bounded. Zero open Flags is not healthy when
 * required starter areas were never evidenced, went stale, or could not verify.
 */
export function siteCardHealth(input: {
  inFlight: boolean
  finished: boolean
  hasLastKnown: boolean
  flags: Array<{ severity: string }>
  coverage: CoverageFact[]
  now: Date
  outcomes?: Array<{ state: CustomerOutcomeState; enabled?: boolean }>
}): { state: CardHealthState; answer: string; statusLabel: string } {
  const open = input.flags.length
  const critical = input.flags.some((f) => f.severity === 'CRITICAL')
  const unchecked = requiredAreasUnchecked(input.coverage)

  if (input.inFlight && !input.hasLastKnown) {
    return {
      state: 'checking',
      answer: 'Learning your website',
      statusLabel: 'Learning your website',
    }
  }

  if (critical) {
    return {
      state: 'problem',
      answer:
        open === 1 ? '1 Flag' : `${open} Flags`,
      statusLabel: input.inFlight ? 'Checking again' : SITE_BOARD_COPY.flagStatus,
    }
  }

  if (open > 0) {
    return {
      state: 'attention',
      answer:
        open === 1 ? '1 Flag' : `${open} Flags`,
      statusLabel: input.inFlight ? 'Checking again' : SITE_BOARD_COPY.flagStatus,
    }
  }

  if (input.inFlight) {
    return {
      state: 'checking',
      answer: 'Checking again',
      statusLabel: 'Checking again',
    }
  }

  if (!input.finished) {
    return {
      state: 'unknown',
      answer: 'This check did not finish',
      statusLabel: 'Couldn’t verify',
    }
  }

  if (input.coverage.some((fact) => REQUIRED_STARTER_AREAS.includes(fact.area) && fact.evidenced && siteCoverageIsStale(fact.checkedAt, input.now))) {
    return {
      state: 'unknown',
      answer: SITE_BOARD_COPY.siteCheckOutOfDate,
      statusLabel: SITE_BOARD_COPY.checkOutOfDate,
    }
  }

  if (unchecked.length > 0) {
    return {
      state: 'unknown',
      answer: 'Checked some areas. Others are not verified yet.',
      statusLabel: 'Coverage incomplete',
    }
  }

  const watched = (input.outcomes ?? []).filter((outcome) => outcome.enabled !== false)
  if (watched.some((outcome) => outcome.state === 'FLAG')) {
    return {
      state: 'attention',
      answer: 'A watched result needs a fix.',
      statusLabel: SITE_BOARD_COPY.flagStatus,
    }
  }
  if (watched.some((outcome) => outcome.state === 'STALE')) {
    return {
      state: 'unknown',
      answer: 'A watched result is out of date.',
      statusLabel: 'Stale',
    }
  }
  if (watched.some((outcome) => outcome.state === 'COULD_NOT_VERIFY')) {
    return {
      state: 'unknown',
      answer: 'A watched result could not be verified.',
      statusLabel: 'Couldn’t verify',
    }
  }

  return {
    state: 'healthy',
    answer: '0 Flags',
    statusLabel: '0 Flags',
  }
}
