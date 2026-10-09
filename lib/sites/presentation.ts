import type { CardHealthState, SiteCardArea } from '@/lib/sites/card-areas'
import { SITE_PRESENTATION_COPY } from '@/lib/marketing/copy/terminology'
import type { WatchBoardState } from '@/lib/sites/watch-state'

export type SiteResultState =
  | 'checking'
  | 'flags'
  | 'clear'
  | 'could_not_verify'
  | 'stale'
  | 'failed'

export type MonitoringState =
  | 'not_monitored'
  | 'weekly'
  | 'daily'
  | 'paused'
  | 'delayed'
  | 'quota_blocked'

export type FlagPriorityBand = 'fix_first' | 'other'

export type FlagVerificationState =
  | 'unverified'
  | 'verifying'
  | 'verified'
  | 'still_open'
  | 'could_not_verify'
  | 'regressed'

export type SiteRunState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'partial'
  | 'failed'
  | 'interrupted'

export type SiteRunRecoveryAction = 'retry' | 'view_details' | null

export type RunBannerKind = 'analyzing' | 'incomplete' | 'paused' | 'details' | 'disconnected'

export type RunBanner = {
  headline: string
  kind: RunBannerKind
  recovery: SiteRunRecoveryAction
}

export type CustomerAttention = {
  text: string
  tone: 'attention' | 'clear' | 'pending'
}

export type VerificationResultLabel =
  | 'verifying'
  | 'verified'
  | 'still_open'
  | 'regressed'
  | 'could_not_verify'
  | 'missing_evidence'
  | 'incomparable_scope'

export type SiteCategoryPresentation = {
  id: SiteCardArea
  name: string
  state: CardHealthState
  answer: string
  status: string
  flagCount: number
  fixFirstCount: number
  checkedAt: string | null
  freshness: string
  coverageLimitation: string | null
  rank: number
  href: string
}

export type SitePresentation = {
  identity: {
    siteId: string
    name: string
    host: string
    preview: {
      url: string
      pageUrl: string
      viewport: string
      recordedAt: string | null
    } | null
  }
  result: {
    state: SiteResultState
    label: string
  }
  monitoring: {
    state: MonitoringState
    label: string
  }
  coverage: {
    pagesReached: number
    pagesExpected: number
    label: string
    complete: boolean
  }
  freshness: {
    checkedAt: string | null
    stale: boolean
    label: string
  }
  flags: {
    count: number
    label: string
    fixFirstCount: number
  }
  run: {
    state: SiteRunState
    label: string
    auditId: string | null
    recoveryAction: SiteRunRecoveryAction
  }
  categories: SiteCategoryPresentation[]
}

export function flagCountLabel(count: number): string {
  return SITE_PRESENTATION_COPY.flags(count)
}

export function pageCoverageLabel(pagesReached: number, pagesExpected: number): string {
  return SITE_PRESENTATION_COPY.pages(pagesReached, pagesExpected)
}

export function freshnessLabel(checkedAt: string | null, now = new Date()): string {
  if (!checkedAt) return SITE_PRESENTATION_COPY.freshness.none
  const checked = Date.parse(checkedAt)
  if (!Number.isFinite(checked)) return SITE_PRESENTATION_COPY.freshness.none
  const minutes = Math.max(0, Math.floor((now.getTime() - checked) / 60_000))
  if (minutes < 1) return SITE_PRESENTATION_COPY.freshness.now
  if (minutes < 60) return SITE_PRESENTATION_COPY.freshness.minutes(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return SITE_PRESENTATION_COPY.freshness.hours(hours)
  return SITE_PRESENTATION_COPY.freshness.days(Math.floor(hours / 24))
}

export function monitoringPresentation(
  state: WatchBoardState,
  interval: 'weekly' | 'daily' | null,
): SitePresentation['monitoring'] {
  const mapped: MonitoringState = state === 'watching'
    ? interval === 'daily' ? 'daily' : 'weekly'
    : state === 'quota'
      ? 'quota_blocked'
      : state === 'off'
        ? 'not_monitored'
        : state
  return { state: mapped, label: SITE_PRESENTATION_COPY.monitoring[mapped] }
}

export function resultPresentation(input: {
  auditStatus: string | null
  healthState: CardHealthState
  flagCount: number
  stale: boolean
  hasCurrentEvidence: boolean
}): SitePresentation['result'] {
  const inFlight = Boolean(input.auditStatus && !['COMPLETED', 'FAILED'].includes(input.auditStatus))
  let state: SiteResultState
  if (inFlight) state = 'checking'
  else if (input.auditStatus === 'FAILED') state = 'failed'
  else if (input.flagCount > 0) state = 'flags'
  else if (input.stale) state = 'stale'
  else if (!input.hasCurrentEvidence || input.healthState === 'unknown') state = 'could_not_verify'
  else state = 'clear'
  return { state, label: SITE_PRESENTATION_COPY.result[state] }
}

export function flagPriority(input: {
  severity: string
  confidence?: number | null
  affectedPageCount?: number
  outcomeId?: string | null
}): { band: FlagPriorityBand; score: number } {
  const severity = input.severity.toUpperCase()
  const severityScore = severity === 'CRITICAL' ? 100 : severity === 'IMPORTANT' ? 55 : 25
  const confidenceScore = Math.round(Math.max(0, Math.min(1, input.confidence ?? 0)) * 20)
  const scopeScore = Math.min(20, Math.max(0, input.affectedPageCount ?? 1) * 4)
  const outcomeScore = input.outcomeId ? 20 : 0
  const score = severityScore + confidenceScore + scopeScore + outcomeScore
  return { band: score >= 90 ? 'fix_first' : 'other', score }
}

export function compareFlagPriority(
  left: { priorityScore?: number; latestOccurrenceAt?: string | null; problem: string },
  right: { priorityScore?: number; latestOccurrenceAt?: string | null; problem: string },
): number {
  const byScore = (right.priorityScore ?? 0) - (left.priorityScore ?? 0)
  if (byScore !== 0) return byScore
  const byTime = (right.latestOccurrenceAt ?? '').localeCompare(left.latestOccurrenceAt ?? '')
  if (byTime !== 0) return byTime
  return left.problem.localeCompare(right.problem)
}

export function siteSortRank(site: SitePresentation): number {
  if (site.result.state === 'failed' || site.run.state === 'failed' || site.run.state === 'interrupted' || site.result.state === 'checking') return 0
  if (site.flags.fixFirstCount > 0) return 1
  if (site.result.state === 'stale' || site.result.state === 'could_not_verify' ||
      site.monitoring.state === 'delayed' || site.monitoring.state === 'quota_blocked') return 2
  if (site.flags.count > 0) return 3
  return 4
}

export function runPresentation(input: {
  auditId: string | null
  auditStatus: string | null
  startedAt: Date | null
  failureCode: string | null
}): SitePresentation['run'] {
  if (!input.auditStatus) {
    return { state: 'idle', label: SITE_PRESENTATION_COPY.run.idle, auditId: input.auditId, recoveryAction: null }
  }
  if (input.auditStatus === 'QUEUED') {
    return { state: 'queued', label: SITE_PRESENTATION_COPY.run.queued, auditId: input.auditId, recoveryAction: 'view_details' }
  }
  if (!['COMPLETED', 'FAILED'].includes(input.auditStatus)) {
    return { state: 'running', label: SITE_PRESENTATION_COPY.run.running, auditId: input.auditId, recoveryAction: 'view_details' }
  }
  if (input.auditStatus === 'FAILED') {
    const state: SiteRunState = input.startedAt ? 'interrupted' : 'failed'
    return { state, label: SITE_PRESENTATION_COPY.run[state], auditId: input.auditId, recoveryAction: 'retry' }
  }
  if (input.failureCode) {
    return { state: 'partial', label: SITE_PRESENTATION_COPY.run.partial, auditId: input.auditId, recoveryAction: 'retry' }
  }
  return { state: 'idle', label: SITE_PRESENTATION_COPY.run.idle, auditId: input.auditId, recoveryAction: null }
}

/**
 * The customer result. A Flag count is shown only when Flags exist or the
 * evidence is current and clear. Every other result keeps its own label.
 */
export function customerAttention(site: Pick<SitePresentation, 'result' | 'flags'>): CustomerAttention {
  if (site.flags.count > 0) return { text: site.flags.label, tone: 'attention' }
  if (site.result.state === 'clear') return { text: site.flags.label, tone: 'clear' }
  return { text: site.result.label, tone: 'pending' }
}

/** One Overview banner. A finished clear run does not keep pipeline narration. */
export function runBanner(input: {
  run: SitePresentation['run']
  monitoring: SitePresentation['monitoring']
  disconnected?: boolean
}): RunBanner | null {
  const active = input.run.state === 'queued' || input.run.state === 'running'
  if (input.disconnected && active) {
    return {
      headline: SITE_PRESENTATION_COPY.run.disconnected,
      kind: 'disconnected',
      recovery: null,
    }
  }
  if (active) {
    return {
      headline: SITE_PRESENTATION_COPY.run.running,
      kind: 'analyzing',
      recovery: 'view_details',
    }
  }
  if (input.run.state === 'partial' || input.run.state === 'failed' || input.run.state === 'interrupted') {
    return {
      headline: SITE_PRESENTATION_COPY.run.partial,
      kind: 'incomplete',
      recovery: 'retry',
    }
  }
  if (input.monitoring.state === 'paused') {
    return {
      headline: SITE_PRESENTATION_COPY.run.paused,
      kind: 'paused',
      recovery: null,
    }
  }
  if (input.run.auditId) {
    return {
      headline: SITE_PRESENTATION_COPY.run.idle,
      kind: 'details',
      recovery: null,
    }
  }
  return null
}

const MISSING_EVIDENCE_REASONS = [
  'comparable evidence',
  'evidence reference',
  'no positive execution',
  'ai assessment did not complete',
  'journey verification did not complete',
  'verifier did not complete',
]

/** Attempt history. Copying a prompt is not one of these results. */
export function verificationResult(input: {
  outcome: string | null
  comparable: boolean | null
  reason: string | null
}): VerificationResultLabel {
  if (!input.outcome) return 'verifying'
  if (input.outcome === 'IMPROVED') return 'verified'
  if (input.outcome === 'UNCHANGED') return 'still_open'
  if (input.outcome === 'REGRESSED') return 'regressed'
  if (input.comparable === false) {
    const reason = (input.reason ?? '').toLowerCase()
    if (MISSING_EVIDENCE_REASONS.some((needle) => reason.includes(needle))) return 'missing_evidence'
    return 'incomparable_scope'
  }
  return 'could_not_verify'
}

export function verificationResultLabel(result: VerificationResultLabel): string {
  return SITE_PRESENTATION_COPY.verification[result]
}

/** A category is current and clear only with healthy evidence and no open Flag. */
export function categoryReadsCurrentClear(category: SiteCategoryPresentation, siteStale: boolean): boolean {
  return category.state === 'healthy'
    && category.flagCount === 0
    && category.fixFirstCount === 0
    && !category.coverageLimitation
    && !siteStale
}

export function categoryPresentation(input: {
  id: SiteCardArea
  name: string
  state: CardHealthState
  answer: string
  status: string
  flagCount: number
  fixFirstCount: number
  checkedAt: string | null
  coverageLimitation?: string | null
  siteId: string
  now?: Date
}): SiteCategoryPresentation {
  const problemRank = input.fixFirstCount > 0 ? 0 : input.flagCount > 0 ? 1 : input.state === 'unknown' || input.state === 'checking' ? 2 : 3
  return {
    id: input.id,
    name: input.name,
    state: input.state,
    answer: input.answer,
    status: input.status,
    flagCount: input.flagCount,
    fixFirstCount: input.fixFirstCount,
    checkedAt: input.checkedAt,
    freshness: freshnessLabel(input.checkedAt, input.now),
    coverageLimitation: input.coverageLimitation ?? null,
    rank: problemRank,
    href: `/sites/${input.siteId}?category=${input.id}`,
  }
}

/** Pages is a coverage summary, not a duplicate of the Site-wide Flag inbox. */
export function pagesCardPresentation(site: SitePresentation): {
  state: CardHealthState
  status: string
} {
  if (site.result.state === 'checking') return { state: 'checking', status: site.result.label }
  if (site.result.state === 'failed') return { state: 'unknown', status: site.result.label }
  if (site.freshness.stale) return { state: 'unknown', status: SITE_PRESENTATION_COPY.result.stale }
  if (!site.coverage.complete) return { state: 'unknown', status: SITE_PRESENTATION_COPY.coverageIncomplete }
  return { state: 'healthy', status: SITE_PRESENTATION_COPY.flags(0) }
}
