import { describe, expect, it } from 'vitest'
import type { Request } from 'playwright'
import { classifyBrowserTrackingRequest, classifyTrackingEndpoint } from './endpoints'
import { trackingEvidenceSchema, type TrackingRequest } from './contracts'
import { runTrackingChecks, trackingContext } from '../checks/tracking'
import { parseMetadataFromHtml } from '../metadata'
import { trackingPageKey, trackingRequestKey, TRACKING_VERIFICATION_RULE } from './identity'
import { captureObservationKey } from '../browser/observation-scope'
import { scopedAssertionForTarget } from '../checks/verification'
import { projectCheckResults } from '@/lib/sites/check-results'
import { checkReceiptSchema, readCheckReceipt } from '../checks/receipt'

const meta = parseMetadataFromHtml('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>', 'https://example.com/')
const request: TrackingRequest = { provider: 'google-analytics', role: 'library', hostname: 'www.googletagmanager.com', endpoint: '/gtag/js',
  method: 'GET', phase: 'page_load', state: 'completed', status: 200, reason: null, atMs: 10, libraryResponseQualified: true }
const evidence = (requests: TrackingRequest[], truncated = false) => trackingEvidenceSchema.parse({ version: 1, phase: 'page_load', requests, truncated, durationMs: 100, consentInteraction: 'none' })
const pageUrl = 'https://example.com/'
const capture = { pageUrl, finalUrl: pageUrl, profile: 'desktop-fixture', access: 'public' }
function observed(urls: Array<[string, number]>, captureKey = captureObservationKey(capture), method: TrackingRequest['method'] = 'GET', truncated = false) {
  const requests = urls.map(([url, status]) => ({ ...request, ...classifyTrackingEndpoint(url, 'script', pageUrl)!,
    method, requestKey: trackingRequestKey(url, method), status, libraryResponseQualified: status === 200 ? true as const : undefined }))
  const checked = runTrackingChecks(meta, { ...evidence(requests, truncated), captureKey }, pageUrl)
  const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl,
    applicable: true, passed: checked.flags.length === 0 && checked.complete, complete: checked.complete, assertions: checked.assertions,
    execution: { auditId: 'after', taskId: 'library', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
  return { ...checked, receipt }
}

describe('runtime Tracking assessment', () => {
  it('keeps an observed event classified when its frame navigates before admission', () => {
    let documentUrl = 'https://www.example.com/'
    const browserRequest = { url: () => 'https://www.example.com/_vercel/insights/view', resourceType: () => 'fetch',
      frame: () => ({ url: () => documentUrl }) }
    const tracked = browserRequest as unknown as Request
    expect(classifyBrowserTrackingRequest(tracked, pageUrl)).toMatchObject({ provider: 'vercel', role: 'event' })
    documentUrl = 'https://unrelated.test/'
    expect(classifyBrowserTrackingRequest(tracked, pageUrl)).toMatchObject({ provider: 'vercel', role: 'event' })
    expect(classifyBrowserTrackingRequest({ ...browserRequest } as unknown as Request, pageUrl)).toBeNull()
  })

  it('keeps historical native snapshots without a general analytics observation unknown', () => {
    const recorded = runTrackingChecks(null, evidence([]), pageUrl, {})
    expect(recorded.flags).toEqual([])
    expect(recorded.assertions.find(assertion => assertion.key === 'analytics-markup')).toMatchObject({ passed: false, complete: false })
    const unavailable = runTrackingChecks(null, evidence([]), pageUrl, { hasAnalytics: null })
    expect(unavailable.flags).toEqual([])
    expect(unavailable.assertions.find(assertion => assertion.key === 'analytics-markup')).toMatchObject({ passed: false, complete: false })
  })
  it.each([
    ['https://example.com/pricing', 'https://example.com/pricing/'],
    ['https://example.com/?return=', 'https://example.com/?return=/'],
  ])('keeps request capture page identity exact: %s', (left, right) => {
    expect(trackingPageKey(left)).not.toBe(trackingPageKey(right))
  })
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

  it('redacts Plausible site script identifiers without loosening historical repair scope', () => {
    const url = 'https://plausible.io/js/pa-PRIVATE_SITE.js?fixture=PRIVATE_QUERY'
    const replacement = 'https://plausible.io/js/pa-PRIVATE_REPLACEMENT.js?fixture=PRIVATE_QUERY'
    expect(classifyTrackingEndpoint(url, 'script', pageUrl)).toMatchObject({ provider: 'plausible', endpoint: '/js/script.js' })
    const before = observed([[url, 503]])
    const flag = before.flags[0]
    expect(flag.evidence).toContain('plausible.io/js/script.js')
    expect(JSON.stringify(before)).not.toContain('PRIVATE_')
    const oldEndpoint = '/js/pa-PRIVATE_SITE.js'
    const oldFlag = { ...flag, evidenceTargets: flag.evidenceTargets?.map(target => ({ ...target,
      context: target.context?.replace('/js/script.js', oldEndpoint),
    })) }
    const historical = runTrackingChecks(meta, { ...evidence([{ ...request, provider: 'plausible', hostname: 'plausible.io',
      endpoint: oldEndpoint, status: 503, requestKey: trackingRequestKey(url, 'GET') }]), captureKey: captureObservationKey(capture) }, pageUrl)
    expect(JSON.stringify(historical)).not.toContain('PRIVATE_')
    const compare = (after: ReturnType<typeof observed>) => scopedAssertionForTarget({ receipt: after.receipt,
      checkId: flag.checkId, flag: oldFlag })
    expect(compare(observed([[replacement, 200]]))).toBeUndefined()
    expect(compare(observed([[url, 200]]))?.assertion.passed).toBe(true)
    const oldReceipt = observed([[url, 200]]).receipt
    oldReceipt.assertions = oldReceipt.assertions.map(assertion => ({ ...assertion,
      context: assertion.context?.replace('/js/script.js', oldEndpoint), observed: assertion.observed.replace('/js/script.js', oldEndpoint),
    }))
    const proof = scopedAssertionForTarget({ receipt: oldReceipt, checkId: flag.checkId, flag: oldFlag })
    expect(proof?.assertion.passed).toBe(true)
    expect(JSON.stringify(proof)).not.toContain('PRIVATE_')
  })

  it.each([204, 205, 206, 304])('retains HTTP %s without certifying a full library transfer', status => {
    const url = 'https://www.googletagmanager.com/gtag/js?id=PRIVATE_PROJECT'
    const failed = observed([[url, 503]])
    const incomplete = observed([[url, status]])
    expect(incomplete.flags).toEqual([])
    expect(incomplete.complete).toBe(false)
    expect(incomplete.assertions).toContainEqual(expect.objectContaining({ key: 'tracking-library', complete: false, passed: false,
      observed: expect.stringContaining(`HTTP ${status}`) }))
    expect(scopedAssertionForTarget({ receipt: incomplete.receipt, checkId: 'tracking-library-http-error', flag: failed.flags[0] })).toBeUndefined()
  })

  it('keeps earlier HTTP-only library success out of recovery proof', () => {
    const url = 'https://www.googletagmanager.com/gtag/js?id=PRIVATE_PROJECT'
    const before = observed([[url, 503]])
    const { receipt } = observed([[url, 200]])
    const original = receipt.assertions.find(item => item.key === 'tracking-library')!
    expect(original).toMatchObject({ passed: true, libraryResponseQualified: true })
    delete original.libraryResponseQualified
    expect(readCheckReceipt(receipt).assertions).toContainEqual(expect.objectContaining({
      key: 'tracking-library', passed: false, complete: false,
    }))
    expect(scopedAssertionForTarget({ receipt, checkId: before.flags[0].checkId, flag: before.flags[0] })).toBeUndefined()
  })

  it.each([401, 403, 407, 429, 511])('keeps Tracking HTTP %s inconclusive without hiding a sibling failure', status => {
    const url = 'https://www.googletagmanager.com/gtag/js?id=PRIVATE_PROJECT'
    const before = observed([[url, 503]])
    const restricted = observed([[url, status]])
    expect(restricted.flags).toEqual([])
    expect(restricted.complete).toBe(false)
    expect(restricted.assertions).toContainEqual(expect.objectContaining({ key: 'tracking-library', complete: false, passed: false,
      observed: expect.stringContaining(`HTTP ${status}`) }))
    expect(scopedAssertionForTarget({ receipt: restricted.receipt, checkId: before.flags[0].checkId, flag: before.flags[0] })).toBeUndefined()
    const mixed = observed([[url, status], [url, 503]])
    expect(mixed.flags).toHaveLength(1)
    expect(mixed.flags[0].evidence).toContain('HTTP 503')
    expect(mixed.flags[0].evidence).not.toContain(String(status))

    const endpoint = runTrackingChecks(meta, evidence([{ ...request, role: 'event', status }]), pageUrl)
    expect(endpoint.flags).toEqual([])
    expect(endpoint.assertions).toContainEqual(expect.objectContaining({ key: 'tracking-http-response', complete: false, passed: false }))
  })

  it('preserves a measured failure but refuses repair proof from a truncated Tracking phase', () => {
    const url = 'https://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL'
    const before = observed([[url, 404]])
    const compare = (after: ReturnType<typeof observed>) => scopedAssertionForTarget({ receipt: after.receipt,
      checkId: 'tracking-library-http-error', flag: before.flags[0] })
    const capped = observed([[url, 200]], undefined, 'GET', true)
    expect(capped.assertions.find(assertion => assertion.key === 'tracking-library')).toMatchObject({ complete: false, passed: false })
    expect(compare(capped)).toBeUndefined()
    expect(compare(observed([[url, 503]], undefined, 'GET', true))?.assertion).toMatchObject({ complete: true, passed: false })
    expect(compare(observed([[url, 200]]))?.assertion.passed).toBe(true)
  })

  it('retains a measured failure while reporting an inconclusive transfer in the same phase', () => {
    const url = 'https://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL'
    const record = { ...request, requestKey: trackingRequestKey(url, 'GET'), captureKey: captureObservationKey(capture) }
    const failure = runTrackingChecks(meta, evidence([{ ...record, status: 503 },
      { ...record, status: null, state: 'failed', reason: 'transport_failed' }]), pageUrl)
    expect(failure.complete).toBe(false)
    expect(failure.flags.map(flag => flag.checkId)).toEqual(['tracking-library-http-error'])
    expect(failure.assertions.find(item => item.key === 'tracking-library')).toMatchObject({ complete: true, passed: false })

    const blocked = runTrackingChecks(meta, evidence([{ ...record, status: null, state: 'failed', reason: 'browser_blocked' }]), pageUrl)
    expect(blocked.complete).toBe(false)
    expect(blocked.flags).toEqual([])
  })

  it('requires the original action even when another control loads the same request on the same page', () => {
    const original = 'a'.repeat(64), replacement = 'b'.repeat(64)
    const captureKey = captureObservationKey(capture)
    const requestKey = trackingRequestKey('https://www.googletagmanager.com/gtag/js?id=PRIVATE_ORIGINAL', 'GET')
    function observe(status: number, actionKey?: string) {
      return runTrackingChecks(meta, { ...evidence([{ ...request, phase: 'public_action', status, requestKey, captureKey, actionKey }]),
        phase: 'public_action' }, pageUrl)
    }
    const before = observe(503, original).flags[0]
    const base = observed([]).receipt
    function compare(after: ReturnType<typeof observe>, flag = before) {
      return scopedAssertionForTarget({ receipt: { ...base, assertions: after.assertions }, checkId: before.checkId, flag })
    }
    expect(observe(200, replacement).assertions).toContainEqual(expect.objectContaining({ key: 'tracking-library', passed: true, complete: true }))
    expect(compare(observe(200, replacement))).toBeUndefined()
    expect(compare(observe(200))).toBeUndefined()
    expect(compare(observe(200, original))?.assertion.passed).toBe(true)
    const historical = { ...before, evidenceTargets: before.evidenceTargets?.map(target => ({ ...target,
      context: target.context?.replace(':request:v5:', ':request:v4:').replace(':control:' + original, '') })) }
    expect(compare(observe(200, original), historical)).toBeUndefined()
    expect(observe(503).flags[0].evidenceTargets?.[0].context).toContain(':control:unattributed:')
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
    expect(before.flags[0].evidenceTargets?.[0].context).not.toContain(':request:')
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
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl,
      applicable: true, passed: false, complete: result.complete, assertions: result.assertions,
      execution: { auditId: 'a', taskId: 't', checkVersion: 1, source: 'browser-network', collectedAt: '2026-10-24T00:00:00Z' } })
    const published = projectCheckResults('a', [{ id: 'r', targetKey: 'module:measurement', status: 'COMPLETED', pageUrl, updatedAt: new Date(), detail: receipt }])
    expect(published.find(item => item.assertionKey === 'tracking-http-response')).toMatchObject({ reason: 'tracking_suppressed', status: 'unknown' })
    expect(published.find(item => item.assertionKey === 'tracking-provider-recording')).toMatchObject({ reason: 'tracking_provider_unverified', status: 'unknown' })
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
    expect(runTrackingChecks(meta, evidence([event]), pageUrl).assertions.find(item => item.key === 'tracking-http-response'))
      .toMatchObject({ passed: false, complete: false })
    const qualified = { ...event, eventResponseQualified: true as const }
    const result = runTrackingChecks(meta, evidence([qualified]), 'https://example.com/')
    expect(result.assertions.find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: true })
    expect(result.assertions.find(item => item.key === 'tracking-provider-recording')).toMatchObject({ passed: false, complete: false })
    expect(runTrackingChecks(meta, evidence([{ ...qualified, status: 204 }]), 'https://example.com/').assertions
      .find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: true, complete: true })
    expect(runTrackingChecks(meta, evidence([qualified, { ...event, status: 500 }]), 'https://example.com/').flags[0].checkId).toBe('tracking-endpoint-http-error')
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
