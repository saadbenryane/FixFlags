import { describe, expect, it } from 'vitest'
import { networkEngagementObservations, buildSilentFormFailureFlag } from '../checks/network-engagement'
import { engagementContext, ENGAGEMENT_VERIFICATION_RULE, type EngagementRequest } from '../network-engagement-evidence'
import { trackingRequestKey } from '../tracking/identity'
import { checkReceiptSchema } from '../checks/receipt'
import { scopedAssertionForTarget } from '../checks/verification'
import { recordedVerificationVerdict } from '../recovery-evidence'
import type { NetworkFailureRecord } from '../browser/network-monitor'

const pageUrl = 'https://example.com/', url = pageUrl + 'api/contact?key=PRIVATE_ORIGINAL', peer = pageUrl + 'api/signup'
const request = (url: string, overrides: Partial<EngagementRequest> = {}): EngagementRequest => ({
  requestKey: trackingRequestKey(url, 'GET'), captureKey: 'a'.repeat(64), method: 'GET', destination: url.split('?')[0],
  phase: 'page_load', status: 200, state: 'completed', ...overrides,
})
const failure = (url: string, status = 503): NetworkFailureRecord => ({ url, method: 'GET', status,
  resourceType: 'fetch', sameOrigin: true, engagementPath: true, at: 0 })
function observe(requests: EngagementRequest[], failures: NetworkFailureRecord[] = [], extra: object = {}) {
  return networkEngagementObservations({ pageUrl, failures, evidence: { version: 1, requests, truncated: false }, ...extra })
}
const source = () => observe([request(url, { status: 503 }), request(peer, { status: 503 })], [failure(url), failure(peer)])
function receipt(observed: ReturnType<typeof observe>) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'network', pageUrl,
    passed: observed.complete && !observed.flags.length, applicable: observed.applicable, complete: observed.complete, assertions: observed.assertions,
    execution: { auditId: 'fresh', taskId: 'native-flow', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
}
function compare(observed: ReturnType<typeof observe>, flag = source().flags[0]) {
  return scopedAssertionForTarget({ receipt: receipt(observed), flag, checkId: flag.checkId })?.assertion
}

describe('native engagement request evidence', () => {
  it('keeps an observed walk without API requests inapplicable while an original missing request remains unknown', () => {
    expect(observe([])).toMatchObject({ applicable: false, complete: true, flags: [], assertions: [] })
    expect(observe([], [], { expected: true })).toMatchObject({ applicable: true, complete: false,
      assertions: [{ key: 'engagement-observation', passed: false, complete: false }] })
  })
  it('retains every failed original request without copying query values into the receipt or Flag', () => {
    const observed = source()
    expect(observed.flags[0]).toMatchObject({ checkId: 'api-engagement-server-error', verificationRule: ENGAGEMENT_VERIFICATION_RULE })
    expect(observed.flags[0].evidenceTargets).toHaveLength(2)
    expect(JSON.stringify(observed)).not.toContain('PRIVATE_ORIGINAL')
    expect(compare(observed)).toMatchObject({ passed: false, complete: true })
  })
  it('requires all original requests for success while one comparable remaining failure disproves repair', () => {
    expect(compare(observe([request(url)]))).toBeUndefined()
    expect(compare(observe([request(url), request(peer, { status: null, state: 'failed' })]))).toBeUndefined()
    expect(compare(observe([request(url, { status: 503 })], [failure(url)]))).toMatchObject({ passed: false, complete: true })
    expect(compare(observe([request(url), request(peer)]))).toMatchObject({ passed: true, complete: true })
  })
  it('uses the same native source and original cohort in repair and monitoring recovery', () => {
    const original = source().flags[0]
    const evaluate = (current: ReturnType<typeof observe>) => recordedVerificationVerdict({ auditId: 'fresh', flag: { ...original, pageUrl },
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'api-engagement-server-error': 1 }, outcomes: [], verificationTarget: null },
      executions: [{ targetKey: 'module:network', status: 'COMPLETED', detail: receipt(current) }] })
    expect(evaluate(source())).toBe('failed')
    expect(evaluate(observe([request(url)]))).toBeNull()
    expect(evaluate(observe([request(url), request(peer)]))).toBe('passed')
  })
  it.each([
    request(url.replace('PRIVATE_ORIGINAL', 'PRIVATE_REPLACEMENT')),
    request(url, { captureKey: 'b'.repeat(64) }),
    request(url, { requestKey: trackingRequestKey(url, 'POST'), method: 'POST' }),
    request(url, { phase: 'public_action' }),
    request(url, { state: 'response' }),
    request(url, { state: 'failed' }),
    request(url, { status: 403 }),
    request(url, { status: 302 }),
  ])('refuses changed scope, unfinished transfers and access restrictions: %j', changed => {
    expect(compare(observe([changed, request(peer)], [], { actionContext: 'flow:control:' + 'c'.repeat(64) }))).toBeUndefined()
  })
  it('retains the original public-action control and refuses a different or missing control', () => {
    const control = 'flow:control:' + 'c'.repeat(64)
    const prior = observe([request(url, { phase: 'public_action', status: 401 })], [failure(url, 401)], { actionContext: control })
    expect(prior.flags[0].verificationRule).toBe(ENGAGEMENT_VERIFICATION_RULE)
    for (const actionContext of [undefined, 'flow:control:' + 'd'.repeat(64)])
      expect(compare(observe([request(url, { phase: 'public_action' })], [], { actionContext }), prior.flags[0])).toBeUndefined()
    expect(compare(observe([request(url, { phase: 'public_action' })], [], { actionContext: control }), prior.flags[0]))
      .toMatchObject({ passed: true, complete: true })
  })
  it('requires the observed form probe rather than substituting another request for a form response', () => {
    const probe = { url, method: 'GET', status: 503 }
    const prior = observe([request(url, { status: 503 })], [], { probe }).flags.find(flag => flag.checkId === 'form-submit-api-server-error')!
    expect(prior.verificationRule).toBe(ENGAGEMENT_VERIFICATION_RULE)
    expect(compare(observe([request(url)]), prior)).toBeUndefined()
    expect(compare(observe([request(url)], [], { probe: { ...probe, status: 200 } }), prior)).toMatchObject({ passed: true, complete: true })
    expect(compare(observe([request(url)], [], { probe: { ...probe, status: 200 } }), buildSilentFormFailureFlag(probe, 'No feedback'))).toBeUndefined()
  })
  it('preserves a failure despite a repeated successful response and never certifies unscoped history', () => {
    const observed = observe([request(url), request(url, { status: 503 }), request(peer)])
    expect(compare(observed)).toMatchObject({ passed: false, complete: true })
    const original = source().flags[0]
    expect(compare(observe([request(url), request(peer)]), { ...original, verificationRule: undefined, evidenceTargets: undefined })).toBeUndefined()
    expect(engagementContext(request(url, { captureKey: undefined }), pageUrl)).toBeUndefined()
  })
})
