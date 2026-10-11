import { describe, expect, it } from 'vitest'
import { classifyTrackingEndpoint } from './endpoints'
import { trackingEvidenceSchema, type TrackingRequest } from './contracts'
import { runTrackingChecks, trackingContext } from '../checks/tracking'
import { parseMetadataFromHtml } from '../metadata'

const meta = parseMetadataFromHtml('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>', 'https://example.com/')
const request: TrackingRequest = { provider: 'google-analytics', role: 'library', hostname: 'www.googletagmanager.com', endpoint: '/gtag/js',
  method: 'GET', phase: 'page_load', state: 'completed', status: 200, reason: null, atMs: 10 }
const evidence = (requests: TrackingRequest[], truncated = false) => trackingEvidenceSchema.parse({ version: 1, phase: 'page_load', requests, truncated, durationMs: 100, consentInteraction: 'none' })

describe('runtime Tracking assessment', () => {
  it('distinguishes library transfer, event initiation, suppressed delivery and unknown provider ingestion', () => {
    const event: TrackingRequest = { ...request, hostname: 'www.google-analytics.com', endpoint: '/g/collect', role: 'event', method: 'POST', status: null, state: 'suppressed', reason: 'scanner_suppressed' }
    const result = runTrackingChecks(meta, evidence([request, event]), 'https://example.com/')
    expect(result.flags).toEqual([])
    expect(result.assertions.find(item => item.key === 'tracking-library')).toMatchObject({ passed: true, complete: true })
    expect(result.assertions.find(item => item.key === 'tracking-initiation')).toMatchObject({ disposition: 'observed' })
    for (const key of ['tracking-http-response', 'tracking-provider-recording'])
      expect(result.assertions.find(item => item.key === key)).toMatchObject({ passed: false, complete: false })
  })
  it('never treats silence, consent cues, a pending response, or browser blocking as missing event failures', () => {
    for (const records of [[], [{ ...request, status: null, state: 'failed' as const, reason: 'browser_blocked' as const }], [{ ...request, state: 'response' as const }]]) {
      const result = runTrackingChecks({ ...meta, hasCookieConsent: true }, evidence(records), 'https://example.com/')
      expect(result.flags).toEqual([])
      expect(result.assertions.find(item => item.key === 'tracking-library')?.complete).toBe(false)
      expect(result.assertions.find(item => item.key === 'tracking-initiation')?.complete).toBe(false)
    }
  })
  it('keeps every failed endpoint scope and requires finished transfers to clear a library error', () => {
    const failed = [{ ...request, status: 404 }, { ...request, hostname: 'plausible.io', endpoint: '/js/script.js', provider: 'plausible' as const, status: 503 }]
    const result = runTrackingChecks(meta, evidence(failed), 'https://example.com/')
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toMatchObject({ checkId: 'tracking-library-http-error', evidenceTargets: failed.map(item => ({ context: trackingContext(item, 'https://example.com/') })) })
    expect(result.assertions.filter(item => item.key === 'tracking-library').every(item => !item.passed && item.complete)).toBe(true)
  })
  it('records destination HTTP responses without certifying recorded events or using an unrelated success', () => {
    const event = { ...request, role: 'event' as const, hostname: 'www.google-analytics.com', endpoint: '/g/collect', method: 'POST' as const }
    const result = runTrackingChecks(meta, evidence([event]), 'https://example.com/')
    expect(result.assertions.find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: true })
    expect(result.assertions.find(item => item.key === 'tracking-provider-recording')).toMatchObject({ passed: false, complete: false })
    expect(runTrackingChecks(meta, evidence([event, { ...event, status: 500 }]), 'https://example.com/').flags[0].checkId).toBe('tracking-endpoint-http-error')
  })
  it('retains a markup absence hint only when no runtime provider was observed and preserves bounded uncertainty', () => {
    const none = { ...meta, hasAnalytics: false }
    expect(runTrackingChecks(none, evidence([]), 'https://example.com/').flags[0].checkId).toBe('measurement-ga-gtm-posthog-missing')
    expect(runTrackingChecks(none, evidence([request]), 'https://example.com/').flags).toEqual([])
    expect(runTrackingChecks(meta, evidence([request], true), 'https://example.com/').complete).toBe(false)
    expect(runTrackingChecks(meta, undefined, 'https://example.com/').complete).toBe(false)
  })
  it('uses bounded explicit endpoint rules and strips project keys rather than treating arbitrary /collect URLs as analytics', () => {
    expect(classifyTrackingEndpoint('https://cdn.segment.com/analytics.js/v1/PRIVATE/analytics.min.js?secret=1', 'script', 'https://example.com/'))
      .toMatchObject({ provider: 'segment', endpoint: '/analytics.js/v1/[project]/analytics.js' })
    expect(classifyTrackingEndpoint('https://google-analytics.com.evil.test/g/collect', 'fetch', 'https://example.com/')).toBeNull()
    expect(classifyTrackingEndpoint('https://example.com/collect', 'fetch', 'https://example.com/')).toBeNull()
    expect(classifyTrackingEndpoint('https://example.com/_vercel/insights/view', 'fetch', 'https://example.com/')).toMatchObject({ provider: 'vercel', role: 'event' })
    expect(classifyTrackingEndpoint('https://other.test/_vercel/insights/view', 'fetch', 'https://example.com/')).toBeNull()
  })
})
