import type { UptimeIncident, UptimeMonitor } from '@prisma/client'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { currentUptimeState, UPTIME_STALE_MS, type UptimeSummary, type UptimeState } from './domain'
import { uptimeEligible, type MonitoringProject } from './eligibility'

export type UptimeStatus = Omit<UptimeSummary, 'segments' | 'openIncidentCount'>
type MonitorStatus = Pick<UptimeMonitor, 'version' | 'targetUrl' | 'enabled' | 'state' | 'lastCheckedAt' | 'nextProbeAt' | 'confirmationDueAt'> & {
  incidents: Array<Pick<UptimeIncident, 'version' | 'targetUrl' | 'confirmedAt'>>
}

/** Read unresolved incident scope with status, without loading probe history. */
export const uptimeStatusMonitorSelect = {
  version: true, targetUrl: true, enabled: true, state: true, lastCheckedAt: true, nextProbeAt: true, confirmationDueAt: true,
  incidents: { where: { recoveredAt: null, supersededAt: null }, select: { version: true, targetUrl: true, confirmedAt: true } },
} as const

/** Account summaries read status with the Site row, without probe history. */
export const uptimeStatusProjectSelect = {
  id: true, url: true, deletedAt: true, watchInterval: true, watchNextRunAt: true, watchPausedAt: true,
  user: { select: { id: true, lifecycleStatus: true } },
  uptimeMonitor: { select: uptimeStatusMonitorSelect },
} as const

export function projectUptimeStatus(project: MonitoringProject, monitor: MonitorStatus | null, now: Date): UptimeStatus {
  const target = normalizeAuditUrl(project.url)
  const targetMatches = Boolean(target.ok && monitor?.targetUrl === target.url)
  const enabled = uptimeEligible(project)
  const lastCheckedAt = targetMatches ? monitor?.lastCheckedAt ?? null : null
  const state = currentUptimeState({ enabled, now, lastCheckedAt,
    state: monitor?.enabled && targetMatches ? monitor.state as UptimeState : 'unknown' })
  const incidentOpen = Boolean(enabled && monitor && targetMatches && monitor.incidents?.some(incident =>
    incident.version === monitor.version && incident.targetUrl === monitor.targetUrl && incident.confirmedAt <= now))
  return { enabled, targetUrl: target.ok ? target.url : project.url, state, incidentOpen,
    lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
    nextCheckAt: enabled && targetMatches && monitor ? (monitor.confirmationDueAt ?? monitor.nextProbeAt).toISOString() : null }
}

/** Current reachability constrains current assurance, never a recorded run. */
export function uptimeAssessment(status: Pick<UptimeStatus, 'enabled' | 'state' | 'lastCheckedAt' | 'incidentOpen'> | null | undefined, now: Date) {
  if (!status?.enabled) return null
  const parsedAt = status.lastCheckedAt ? new Date(status.lastCheckedAt) : null
  const checkedAt = parsedAt && Number.isFinite(parsedAt.getTime()) ? parsedAt : null
  const state = currentUptimeState({ ...status, lastCheckedAt: checkedAt, now })
  return { state: status.incidentOpen || state === 'offline' ? 'FLAG' as const : state === 'online' ? 'CLEAR' as const : 'COULD_NOT_VERIFY' as const,
    observedState: state,
    // An unresolved incident does not expire when fresh reachability is missing.
    validUntil: status.incidentOpen ? null : checkedAt ? new Date(checkedAt.getTime() + UPTIME_STALE_MS) : null }
}
