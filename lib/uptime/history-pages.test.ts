import { expect, it } from 'vitest'
import { appendUptimeHistory, refreshUptimeHistory } from './history-pages'
import type { UptimeHistory, UptimeProbeView } from './domain'

const probe = (id: string, hour: number): UptimeProbeView => ({ id, observedAt: `2026-11-03T${String(hour).padStart(2, '0')}:00:00.000Z`,
  scheduledAt: '2026-11-03T00:00:00.000Z', attempt: 1, confirmed: false, targetUrl: 'https://example.com/',
  result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 20, finalUrl: 'https://example.com/' })
function page(probes: UptimeProbeView[], nextCursor: string | null = 'more'): UptimeHistory {
  return { enabled: true, targetUrl: 'https://example.com/', state: 'online', lastCheckedAt: null, nextCheckAt: null,
    openIncidentCount: 0, segments: [], window: '24h', probes, incidents: [], nextCursor,
    historyScope: { key: 'monitor:1', from: '2026-11-03T00:00:00.000Z', through: '2026-11-03T12:00:00.000Z' } }
}

it('keeps loaded older checks, updates duplicate facts from the latest page, and preserves the oldest continuation', () => {
  const previous = page([probe('overlap', 10), probe('older', 9)], 'cursor-for-older')
  const confirmed = { ...probe('overlap', 10), confirmed: true, result: 'FAILED' as const }
  const next = page([probe('new', 11), confirmed], 'cursor-for-overlap')
  const result = refreshUptimeHistory(previous, next)
  expect(result.probes.map(probe => probe.id)).toEqual(['new', 'overlap', 'older'])
  expect(result.probes[1]).toEqual(confirmed)
  expect(result.nextCursor).toBe('cursor-for-older')
})

it('uses the new first-page continuation when the previous continuation expires', () => {
  const previous = page([probe('overlap', 10), probe('expired', 9)], 'cursor-for-expired')
  const next = page([probe('new', 11), probe('overlap', 10)], 'cursor-for-overlap')
  next.historyScope!.from = '2026-11-03T09:30:00.000Z'
  expect(refreshUptimeHistory(previous, next)).toEqual(next)
})

it('prunes retained checks outside the server window while keeping a previously complete tail complete', () => {
  const previous = page([probe('overlap', 10), probe('expired', 9)], null)
  const next = page([probe('new', 11), probe('overlap', 10)], 'overlap')
  next.historyScope!.from = '2026-11-03T09:30:00.000Z'
  const result = refreshUptimeHistory(previous, next)
  expect(result.probes.map(probe => probe.id)).toEqual(['new', 'overlap'])
  expect(result.nextCursor).toBeNull()
})

it.each(['gap', 'generation', 'target', 'window', 'legacy', 'complete'] as const)('starts from the new page rather than retaining incompatible evidence: %s', reason => {
  const previous = page([probe('overlap', 10), probe('older', 9)])
  const next = page([probe('new', 11), probe('overlap', 10)])
  if (reason === 'gap') next.probes = [probe('new', 11)]
  if (reason === 'generation') next.historyScope!.key = 'monitor:2'
  if (reason === 'target') next.targetUrl = 'https://changed.example/'
  if (reason === 'window') next.window = '7d'
  if (reason === 'legacy') delete next.historyScope
  if (reason === 'complete') next.nextCursor = null
  expect(refreshUptimeHistory(previous, next)).toBe(next)
})

it('appends deduplicated checks in date order and follows the returned continuation', () => {
  const previous = page([probe('first', 11), probe('overlap', 10)])
  const next = page([probe('overlap', 10), probe('older', 9)], null)
  expect(appendUptimeHistory(previous, next).probes.map(probe => probe.id)).toEqual(['first', 'overlap', 'older'])
  expect(appendUptimeHistory(previous, next).nextCursor).toBeNull()
})

it('refuses a paginated response from a changed monitor generation', () => {
  const previous = page([probe('first', 11)])
  const next = page([probe('older', 9)])
  next.historyScope!.key = 'monitor:2'
  expect(() => appendUptimeHistory(previous, next)).toThrow('scope changed')
})
