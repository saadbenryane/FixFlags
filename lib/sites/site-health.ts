import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import type { CoverageFact } from '@/lib/sites/coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { CustomerOutcomeState } from '@/lib/sites/outcome-state'
import { LEGACY_BROAD_REQUIRED_AREAS, projectSiteAssessment, type SiteAssessment } from './assessment'
import { uptimeAssessment, type UptimeStatus } from '@/lib/uptime/status'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'

/** Starter areas that must be evidenced before the Site card can say healthy. */
export const REQUIRED_STARTER_AREAS: SiteCardArea[] = [...LEGACY_BROAD_REQUIRED_AREAS]

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
export function siteCardHealth(input: Parameters<typeof presentSiteHealth>[0]) {
  const uptime = uptimeAssessment(input.uptime, input.now)
  const assessment = projectSiteAssessment({ ...input,
    uptime,
    status: input.inFlight ? 'RUNNING' : input.finished ? 'COMPLETED' : 'FAILED' })
  return { ...presentSiteHealth(input, assessment, uptime), assessment, uptime }
}

function presentSiteHealth(input: {
  inFlight: boolean
  finished: boolean
  hasLastKnown: boolean
  flags: Array<{ severity: string }>
  coverage: CoverageFact[]
  now: Date
  coverageMaxAgeMs?: number
  pagesComplete?: boolean
  assessmentComplete?: boolean
  outcomes?: Array<{ id?: string; state: CustomerOutcomeState; enabled?: boolean; validUntil?: Date | null }>
  executionSpec?: unknown
  uptime?: UptimeStatus | null
}, assessment: SiteAssessment, uptime: ReturnType<typeof uptimeAssessment>): { state: CardHealthState; answer: string; statusLabel: string } {
  const open = input.flags.length
  const critical = input.flags.some((f) => f.severity === 'CRITICAL')

  if (uptime?.state === 'FLAG') {
    const label = uptime.observedState === 'offline' ? UPTIME_COPY.states.offline : SITE_BOARD_COPY.needsAttention
    return { state: 'problem', answer: label, statusLabel: label }
  }

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

  if (assessment.result === 'FLAG') return {
    state: 'attention', answer: 'A watched result needs a fix.', statusLabel: SITE_BOARD_COPY.flagStatus,
  }

  if (assessment.gaps.some(gap => gap.area !== null && gap.reason === 'stale')) {
    return {
      state: 'unknown',
      answer: SITE_BOARD_COPY.siteCheckOutOfDate,
      statusLabel: SITE_BOARD_COPY.checkOutOfDate,
    }
  }

  if (assessment.gaps.some(gap => gap.area !== null && gap.reason !== 'stale')) {
    return {
      state: 'unknown',
      answer: 'Checked some areas. Others are not verified yet.',
      statusLabel: 'Coverage incomplete',
    }
  }

  if (assessment.result === 'STALE') {
    return {
      state: 'unknown',
      answer: 'A watched result is out of date.',
      statusLabel: 'Stale',
    }
  }
  if (input.outcomes?.some(outcome => outcome.enabled !== false && outcome.state === 'COULD_NOT_VERIFY')) {
    return {
      state: 'unknown',
      answer: 'A watched result could not be verified.',
      statusLabel: 'Couldn’t verify',
    }
  }

  if (assessment.result !== 'CLEAR') return {
    state: 'unknown', answer: 'Checked some areas. Others are not verified yet.', statusLabel: 'Coverage incomplete',
  }

  return {
    state: 'healthy',
    answer: '0 Flags',
    statusLabel: '0 Flags',
  }
}
