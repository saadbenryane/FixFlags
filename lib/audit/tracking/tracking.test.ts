import { describe, expect, it } from 'vitest'
import { classifyTrackingEndpoint } from './endpoints'
import { trackingEvidenceSchema, type TrackingRequest } from './contracts'
import { runTrackingChecks, trackingContext } from '../checks/tracking'
import { parseMetadataFromHtml } from '../metadata'
import { trackingRequestKey, TRACKING_VERIFICATION_RULE } from './identity'
import { captureObservationKey } from '../browser/observation-scope'
import { scopedAssertionForTarget } from '../checks/verification'
import { checkReceiptSchema } from '../checks/receipt'

const meta = parseMetadataFromHtml('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>', 'https://example.com/')
const request: TrackingRequest = { provider: 'google-analytics', role: 'library', hostname: 'www.googletagmanager.com', endpoint: '/gtag/js',
  method: 'GET', phase: 'page_load', state: 'completed', status: 200, reason: null, atMs: 10 }
const evidence = (requests: TrackingRequest[], truncated = false) => trackingEvidenceSchema.parse({ version: 1, phase: 'page_load', requests, truncated, durationMs: 100, consentInteraction: 'none' })
const pageUrl = 'https://example.com/'
const capture = { pageUrl, finalUrl: pageUrl, profile: 'desktop-fixture', access: 'public' }
function observed(urls: Array<[string, number]>, captureKey = captureObservationKey(capture), method: TrackingRequest['method'] = 'GET') {
  const requests = urls.map(([url, status]) => ({ ...request, ...classifyTrackingEndpoint(url, 'script', pageUrl)!,
    method, requestKey: trackingRequestKey(url, method), status }))
  const checked = runTrackingChecks(meta, { ...evidence(requests), captureKey }, pageUrl)
  const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl,
    applicable: true, passed: checked.flags.length === 0 && checked.complete, complete: checked.complete, assertions: checked.assertions,
    execution: { auditId: 'after', taskId: 'library', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
  return { ...checked, receipt }
}

describe('runtime Tracking assessment', () => {
  it('requires every original library request while keeping project keys and query values private', () => {
    const urls = ['https://cdn.segment.com/analytics.js/v1/PRIVATE_FIRST/analytics.min.js',
      'https://cdn.segment.com/analytics.js/v1/PRIVATE_SECOND/analytics.min.js']
    const before = observed(urls.map(url => [url, 404]))
    expect(before.flags).toHaveLength(1)
    expect(before.flags[0].evidenceTargets).toHaveLength(2)
    expect(before.flags[0].verificationRule).toBe(TRACKING_VERIFICATION_RULE)
    const compare = (after: ReturnType<typeof observed>) => scopedAssertionForTarget({ receipt: after.receipt,
      checkId: 'tracking-library-http-error', flag: before.flags[0] })
    expect(compare(observed([[urls[0], 200]]))).toBeUndefined()
    expect(compare(observed([[urls[0], 200], [urls[1], 404]]))?.assertion.passed).toBe(false)
    expect(compare(observed(urls.map(url => [url, 200])))?.assertion.passed).toBe(true)
    expect(JSON.stringify(before)).not.toContain('PRIVATE_')
  })

  it.each([
    ['https://www.googletagmanager.com/gtag/js?id=PRIVATE_CHANGED', 'GET'],
    ['http://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL', 'GET'],
    ['https://www.googletagmanager.com:8443/gtag/js?id=PRIVATE_ORIGINAL', 'GET'],
    ['https://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL', 'POST'],
  ] as const)('does not substitute a different URL or method: %s %s', (url, method) => {
    const before = observed([['https://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL', 404]])
    const after = observed([[url, 200]], undefined, method)
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'tracking-library-http-error', flag: before.flags[0] })).toBeUndefined()
    expect(JSON.stringify([before, after])).not.toContain('PRIVATE_')
  })

  it.each([{ profile: 'mobile-fixture' }, { access: 'credentialed:changed' }, { finalUrl: pageUrl + 'changed' },
    { pageUrl: pageUrl + '?variant=other' }])('does not certify repair under changed capture conditions %o', conditions => {
    const url = 'https://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL'
    const before = observed([[url, 404]])
    const after = observed([[url, 200]], captureObservationKey({ ...capture, ...conditions }))
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'tracking-library-http-error', flag: before.flags[0] })).toBeUndefined()
  })

  it('retains historical facts without borrowing newly captured request identity', () => {
    const before = runTrackingChecks(meta, evidence([{ ...request, status: 404 }]), pageUrl)
    const after = observed([['https://www.googletagmanager.com/gtag/js', 200]])
    expect(before.flags[0].evidenceTargets?.[0].context).not.toContain(':request:v2:')
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: 'tracking-library-http-error', flag: before.flags[0] })).toBeUndefined()
    expect(trackingRequestKey('https://example.com/script.js#ignored', 'get')).toBe(trackingRequestKey('https://example.com/script.js', 'GET'))
  })
  it('retains runtime failures when whole-document markup is unavailable without inventing markup absence', () => {
    const result = runTrackingChecks(null, evidence([{ ...request, status: 503 }]), 'https://example.com/')
    expect(result.flags.map(flag => flag.checkId)).toEqual(['tracking-library-http-error'])
    expect(result.assertions.find(assertion => assertion.key === 'analytics-markup')).toMatchObject({ complete: false, passed: false })
    expect(result.assertions.find(assertion => assertion.key === 'tracking-library')).toMatchObject({ complete: true, passed: false })
    expect(result.complete).toBe(false)
    const action = runTrackingChecks(null, { ...evidence([{ ...request, status: 503 }]), phase: 'public_action' }, 'https://example.com/')
    expect(action.flags.map(flag => flag.checkId)).toEqual(['tracking-library-http-error'])
    expect(action.complete).toBe(true)
    expect(action.assertions.some(assertion => assertion.key === 'analytics-markup')).toBe(false)
    expect(runTrackingChecks(null, evidence([]), 'https://example.com/').flags).toEqual([])
  })

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
