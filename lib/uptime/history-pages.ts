import type { UptimeHistory, UptimeProbeView } from './domain'

function probesInRange(history: UptimeHistory, probes: UptimeProbeView[]) {
  const bounds = history.historyScope
  const unique = new Map<string, UptimeProbeView>()
  for (const probe of probes) {
    const observedAt = Date.parse(probe.observedAt)
    if (!bounds || observedAt >= Date.parse(bounds.from) && observedAt <= Date.parse(bounds.through)) {
      if (!unique.has(probe.id)) unique.set(probe.id, probe)
    }
  }
  return [...unique.values()].sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt) || right.id.localeCompare(left.id))
}

/** Retain only continuous, comparable loaded evidence inside the new server window. */
export function refreshUptimeHistory(previous: UptimeHistory | null, next: UptimeHistory): UptimeHistory {
  if (!previous?.historyScope || !next.historyScope || previous.historyScope.key !== next.historyScope.key ||
    previous.window !== next.window || previous.targetUrl !== next.targetUrl || !next.nextCursor) return next
  const retained = probesInRange(next, previous.probes)
  const ids = new Set(next.probes.map(probe => probe.id))
  // A missing overlap can hide an unread gap or a changed target generation.
  // Restart from the new page rather than skipping that missing evidence.
  if (!retained.some(probe => ids.has(probe.id))) return next
  const probes = probesInRange(next, [...next.probes, ...retained])
  return { ...next, probes, nextCursor: previous.nextCursor ? probes.at(-1)?.id ?? next.nextCursor : null }
}

export function appendUptimeHistory(previous: UptimeHistory, next: UptimeHistory): UptimeHistory {
  if (previous.window !== next.window || previous.targetUrl !== next.targetUrl ||
    Boolean(previous.historyScope) !== Boolean(next.historyScope) ||
    previous.historyScope && next.historyScope && previous.historyScope.key !== next.historyScope.key) throw new Error('Uptime history scope changed')
  return { ...next, probes: probesInRange(next, [...next.probes, ...previous.probes]) }
}
