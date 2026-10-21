export const UPTIME_INTERVAL_MS = 5 * 60_000
export const UPTIME_CONFIRMATION_MS = 30_000
export const UPTIME_STALE_MS = 2 * UPTIME_INTERVAL_MS
export const UPTIME_RETENTION_MS = 30 * 24 * 60 * 60_000

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
  if (input.result === 'UNKNOWN') return {
    state: 'unknown' as const, pendingFailureAt: null, confirmAt: null, event: null,
  }
  if (input.incidentOpen || (input.confirmation && input.pendingFailureAt)) return {
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
  return input.state
}

/** One bar describes recorded observations, not continuous availability between probes. */
export function uptimeTimeline(probes: readonly Pick<UptimeProbeView, 'scheduledAt' | 'observedAt' | 'attempt' | 'result' | 'confirmed'>[], now: Date, window: '24h' | '7d' | '30d' = '24h'): UptimeSegment[] {
  const hours = window === '24h' ? 24 : window === '7d' ? 7 * 24 : 30 * 24
  const count = window === '24h' ? 48 : window === '7d' ? 56 : 60
  const span = hours * 60 * 60_000 / count
  const end = Math.ceil(now.getTime() / span) * span
  const start = end - hours * 60 * 60_000
  const slots = new Map<string, (typeof probes)[number]>()
  for (const probe of probes) {
    if (Date.parse(probe.observedAt) > now.getTime()) continue
    const previous = slots.get(probe.scheduledAt)
    if (!previous || probe.attempt > previous.attempt || (probe.attempt === previous.attempt && probe.observedAt > previous.observedAt)) slots.set(probe.scheduledAt, probe)
  }
  return Array.from({ length: count }, (_, index) => {
    const from = start + index * span, to = from + span
    const observed = [...slots.values()].filter(probe => Date.parse(probe.scheduledAt) >= from && Date.parse(probe.scheduledAt) < to)
    const expected = Math.max(0, Math.ceil((Math.min(to, now.getTime()) - from) / UPTIME_INTERVAL_MS))
    const failed = observed.some(probe => probe.result === 'FAILED' && probe.confirmed)
    const online = observed.length >= expected && expected > 0 && observed.every(probe => probe.result === 'ONLINE')
    return { startAt: new Date(from).toISOString(), endAt: new Date(to).toISOString(),
      state: failed ? 'offline' : online ? 'online' : 'unknown', checked: observed.length, expected }
  })
}
