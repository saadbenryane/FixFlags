import { describe, expect, it } from 'vitest'
import { presentCheckResult } from '../check-result-presentation'
import type { SiteCheckResult } from '../check-results'

const result = { area: 'tracking', source: 'browser-network', status: 'unknown', name: 'Event initiation not established',
  reason: 'tracking_no_event', assertionKey: 'tracking-initiation', observation: 'No recognized event collection request was observed.' } as SiteCheckResult
describe('plain-language tracking observations', () => {
  it('explains missing observations without changing the recorded status or evidence', () => {
    expect(presentCheckResult(result)).toEqual({ name: 'No tracking event observed', observation: 'No matching request appeared during this check. This is not a Flag.' })
    expect(result.status).toBe('unknown')
    expect(result.observation).toContain('No recognized')
  })
  it('explains intentional suppression and leaves real failures unchanged', () => {
    const suppressed = { ...result, reason: 'tracking_suppressed' as const, assertionKey: 'tracking-http-response', observation: 'One attempt was intentionally stopped by FixFlags before delivery.' }
    expect(presentCheckResult(suppressed).observation).toContain('avoid adding test events')
    const failure = { ...suppressed, status: 'findings' as const }
    expect(presentCheckResult(failure).observation).toBe(failure.observation)
  })
})
