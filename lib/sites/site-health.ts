import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { STARTER_BOARD_CARDS } from '@/lib/sites/card-areas'
import type { CoverageFact } from '@/lib/sites/coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

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
      answer: 'Learning your website',
      statusLabel: 'First look',
    }
  }

  if (unchecked.length > 0) {
    return {
      state: 'unknown',
      answer: 'Checked some areas. Others are not verified yet.',
      statusLabel: 'Coverage incomplete',
    }
  }

  return {
    state: 'healthy',
    answer: '0 Flags',
    statusLabel: '0 Flags',
  }
}
