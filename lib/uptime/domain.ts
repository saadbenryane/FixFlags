export const UPTIME_INTERVAL_MS = 5 * 60_000
export const UPTIME_SWEEP_INTERVAL_MS = 30_000
export const UPTIME_CONFIRMATION_MS = 30_000
export const UPTIME_STALE_MS = 2 * UPTIME_INTERVAL_MS
export const UPTIME_RETENTION_MS = 30 * 24 * 60 * 60_000

export function uptimeSlotStart(atMs: number) {
  return Math.floor(atMs / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS
}

export function uptimeConfirmationCutoff(now: Date) {
  return new Date(now.getTime() - UPTIME_INTERVAL_MS)
}

export type ProbeResult = 'ONLINE' | 'FAILED' | 'UNKNOWN'
export type UptimeState = 'online' | 'offline' | 'checking' | 'unknown' | 'paused'
export type ProbeObservation = {
  result: ProbeResult
  reason: string
  statusCode: number | null
  durationMs: number
  finalUrl: string | null
}
export type UptimeProbeView = ProbeObservation & {
  id: string
  scheduledAt: string
  observedAt: string
  attempt: number
  confirmed: boolean
  targetUrl: string
}
export type UptimeIncidentView = {
  id: string
  targetUrl: string
  failureOrigin?: string | null
  startedAt: string
  confirmedAt: string
  recoveredAt: string | null
  supersededAt: string | null
  reason: string
}
export type UptimeSegment = {
  startAt: string
  endAt: string
  state: 'online' | 'offline' | 'unknown'
  checked: number
  expected: number
}
export type UptimeSummary = {
  enabled: boolean
  targetUrl: string
  state: UptimeState
  lastCheckedAt: string | null
  nextCheckAt: string | null
  openIncidentCount: number
  /** An unresolved confirmed incident for the active target generation. */
  incidentOpen?: boolean
  segments: UptimeSegment[]
}
export type UptimeHistory = UptimeSummary & {
  /** Read bounds and monitor generation keep retained pages comparable. */
  historyScope?: { key: string; from: string; through: string }
  window: '24h' | '7d' | '30d'
  probes: UptimeProbeView[]
  incidents: UptimeIncidentView[]
  nextCursor: string | null
}

/** Confirmation applies to one target generation. Unknown evidence cannot close an incident. */
export function uptimeTransition(input: {
  result: ProbeResult
  now: Date
  confirmation: boolean
  pendingFailureAt: Date | null
  incidentOpen: boolean
}) {
  if (input.result === 'ONLINE') return {
    state: 'online' as const, pendingFailureAt: null, confirmAt: null,
    event: input.incidentOpen ? 'recovered' as const : null,
  }
  // A late failure remains a recorded observation but cannot confirm the first failure.
  const expiredConfirmation = input.confirmation && (!input.pendingFailureAt || input.pendingFailureAt <= uptimeConfirmationCutoff(input.now))
  if (input.result === 'UNKNOWN' || expiredConfirmation && !input.incidentOpen) return {
    state: 'unknown' as const, pendingFailureAt: null, confirmAt: null, event: null,
  }
  if (input.incidentOpen || input.confirmation) return {
    state: 'offline' as const, pendingFailureAt: null, confirmAt: null,
    event: input.incidentOpen ? null : 'opened' as const,
  }
  return {
    state: 'checking' as const, pendingFailureAt: input.now,
    confirmAt: new Date(input.now.getTime() + UPTIME_CONFIRMATION_MS), event: null,
  }
}

export function currentUptimeState(input: {
  enabled: boolean; state: UptimeState; lastCheckedAt: Date | null; now: Date;
}): UptimeState {
  if (!input.enabled) return 'paused'
  if (!input.lastCheckedAt || input.now.getTime() - input.lastCheckedAt.getTime() > UPTIME_STALE_MS) return 'unknown'
  // A checking state records the first failed observation. Its confirmation
  // window can expire before the worker has reconciled the monitor row.
  if (input.state === 'checking' && input.lastCheckedAt <= uptimeConfirmationCutoff(input.now)) return 'unknown'
  return input.state
}

type TimelineProbe = Pick<UptimeProbeView, 'attempt' | 'confirmed'> & {
  scheduledAt: string | Date; observedAt: string | Date; result: string
}
const timestamp = (at: string | Date) => typeof at === 'string' ? Date.parse(at) : at.getTime()

export function uptimeTimelineBounds(now: Date, window: UptimeHistory['window']) {
  const hours = window === '24h' ? 24 : window === '7d' ? 7 * 24 : 30 * 24
  const count = window === '24h' ? 48 : window === '7d' ? 56 : 60
  const span = hours * 60 * 60_000 / count
  const end = Math.ceil(now.getTime() / span) * span
  return { start: end - hours * 60 * 60_000, end, span, count, dueThrough: uptimeSlotStart(now.getTime()) + UPTIME_INTERVAL_MS }
}

export type UptimePeriodEvidence = { checked: number; failed: boolean; allOnline: boolean }

/** A period is healthy only when each due slot has successful evidence. */
export function uptimeTimelineSegments(bounds: ReturnType<typeof uptimeTimelineBounds>, periods: ReadonlyMap<number, UptimePeriodEvidence>): UptimeSegment[] {
  return Array.from({ length: bounds.count }, (_, index) => {
    const from = bounds.start + index * bounds.span, to = from + bounds.span
    const { checked = 0, failed = false, allOnline = false } = periods.get(from) ?? {}
    const expected = (Math.min(to, bounds.dueThrough) - from) / UPTIME_INTERVAL_MS
    return { startAt: new Date(from).toISOString(), endAt: new Date(to).toISOString(),
      state: failed ? 'offline' : checked === expected && expected > 0 && allOnline ? 'online' : 'unknown', checked, expected }
  })
}

export function uptimeTimeline(probes: readonly TimelineProbe[], now: Date, window: UptimeHistory['window'] = '24h'): UptimeSegment[] {
  const bounds = uptimeTimelineBounds(now, window)
  const { start, end, span } = bounds
  const nowMs = now.getTime()
  const observations = new Map<number, { probe: TimelineProbe; observedAt: number }>()
  for (const probe of probes) {
    const scheduledAt = timestamp(probe.scheduledAt), observedAt = timestamp(probe.observedAt)
    if (!Number.isFinite(scheduledAt) || !Number.isFinite(observedAt) ||
      scheduledAt < start || scheduledAt >= end || observedAt < scheduledAt || observedAt > nowMs) continue
    const previous = observations.get(scheduledAt)
    if (!previous || probe.attempt > previous.probe.attempt ||
      (probe.attempt === previous.probe.attempt && observedAt > previous.observedAt)) {
      observations.set(scheduledAt, { probe, observedAt })
    }
  }
  const periods = new Map<number, UptimePeriodEvidence>()
  const seen = new Set<number>()
  for (const [scheduledAt, { probe }] of observations) {
    const slot = uptimeSlotStart(scheduledAt)
    const periodStart = start + Math.floor((slot - start) / span) * span
    const period = periods.get(periodStart) ?? { checked: 0, failed: false, allOnline: true }
    // Retained off-cadence observations can share a slot. Count it once and
    // keep any confirmed failure that was not replaced by its own confirmation.
    if (!seen.has(slot)) { seen.add(slot); period.checked++ }
    period.failed ||= probe.result === 'FAILED' && probe.confirmed
    period.allOnline &&= probe.result === 'ONLINE'
    periods.set(periodStart, period)
  }
  return uptimeTimelineSegments(bounds, periods)
}
