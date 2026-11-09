import { describe, expect, it } from 'vitest'
import { assessPageResponse } from './page-response'
import type { PublicDocument } from '../search/contracts'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema, readCheckReceipt } from './receipt'
import { recordedVerificationVerdict } from '../recovery-evidence'

const pageUrl = 'https://example.com/pricing'
const document = (overrides: Partial<PublicDocument> = {}): PublicDocument => ({ url: pageUrl, finalUrl: pageUrl,
  status: 200, headers: { 'content-type': 'text/html' }, body: '<html><body>Useful page</body></html>',
  complete: true, reason: null, redirects: [], collectedAt: '2026-10-15T12:00:00Z', ...overrides })
const receipt = (page: string, response: PublicDocument) => {
  const checked = assessPageResponse(page, response)
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'page-response',
    pageUrl: page, applicable: true, complete: checked.complete, passed: checked.complete && !checked.flags.length,
    assertions: checked.assertions, execution: { auditId: 'verification', taskId: 'http:' + page, checkVersion: 1,
      source: 'http', collectedAt: response.collectedAt } })
}

describe('public page response assessment', () => {
  it('requires a repeated recorded route and independently reobserves the original request for loop recovery', () => {
    const looping = document({ body: null, status: 302, complete: false, reason: 'redirect_loop',
      headers: { location: pageUrl }, redirects: [pageUrl] })
    const flag = assessPageResponse(pageUrl, looping).flags[0]
    expect(flag).toMatchObject({ checkId: 'page-redirect-loop' })
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, looping) })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, document()) })?.assertion.passed).toBe(true)
    for (const response of [document({ ...looping, reason: 'redirect_limit' }), document({ ...looping, redirects: [] }),
      document({ ...looping, headers: { location: '/another-page' } }), document({ ...looping, headers: { location: pageUrl, 'set-cookie': 'visitor=allowed' } })]) {
      expect(assessPageResponse(pageUrl, response)).toMatchObject({ flags: [], complete: false })
      expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, response) })).toBeUndefined()
    }
  })
  it.each([404, 410, 500, 502, 503])('flags an observed HTTP %s without requiring rendered content', status => {
    const checked = assessPageResponse(pageUrl, document({ status }))
    expect(checked).toMatchObject({ complete: true, assertions: [{ complete: true, passed: false }] })
    expect(checked.flags).toMatchObject([{ checkId: 'page-http-error', pageUrl, severity: 'CRITICAL', confidence: 1 }])
    expect(checked.flags[0].evidence).toContain(`HTTP ${status}`)
  })
  it.each([200, 204])('records a successful HTTP %s as transport proof only', status => {
    const checked = assessPageResponse(pageUrl, document({ status }))
    expect(checked).toMatchObject({ flags: [], complete: true, assertions: [{ passed: true, complete: true }] })
    expect(checked.limitation).toContain('full page content')
  })
  it('keeps an explicit HTTP 200 missing page comparable to an earlier HTTP error', () => {
    const flag = assessPageResponse(pageUrl, document({ status: 503 })).flags[0]
    const response = document({ body: '<title>404: Page Not Found</title><h1>Page not found</h1>' })
    const checked = assessPageResponse(pageUrl, response)
    expect(checked.flags).toMatchObject([{ checkId: 'page-http-error', evidence: expect.stringContaining('HTTP 200') }])
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, response) })?.assertion)
      .toMatchObject({ passed: false, complete: true })
  })
  it('uses explicit HTML titles and headings without treating articles or dormant markup as errors', () => {
    const heading = '<h1>This page doesn&rsquo;t exist</h1>'
    expect(assessPageResponse(pageUrl, document({ body: heading })).flags).toHaveLength(1)
    for (const response of [
      document({ body: '<title>How to fix a 404</title><h1>Why your page says not found</h1>' }),
      document({ body: '<template><h1>Page not found</h1></template><noscript><h1>Page not found</h1></noscript><svg><title>404</title></svg>' }),
      document({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: heading }) }),
    ]) expect(assessPageResponse(pageUrl, response)).toMatchObject({ complete: true, flags: [] })
  })
  it('retains historical failures but withholds repair proof from status-only success receipts', () => {
    const failed = document({ status: 503 })
    const flag = assessPageResponse(pageUrl, failed).flags[0]
    const current = receipt(pageUrl, document())
    const historical = { ...current, assertions: current.assertions.map(assertion => ({ ...assertion, pageResponseQualified: undefined })) }
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: historical })).toBeUndefined()
    expect(readCheckReceipt(historical)).toMatchObject({ passed: false, complete: false,
      assertions: [{ observed: expect.stringContaining('HTTP 200') }] })
    expect(readCheckReceipt(receipt(pageUrl, failed))).toMatchObject({ passed: false, complete: true })
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: current })?.assertion.passed).toBe(true)
  })
  it('accepts a deliberate public redirect while retaining the original requested page', () => {
    const checked = assessPageResponse(pageUrl, document({ finalUrl: 'https://example.com/new-pricing', redirects: [pageUrl] }))
    expect(checked.assertions[0]).toMatchObject({ passed: true, complete: true })
    expect(checked.assertions[0].context).toBe(assessPageResponse(pageUrl, document({ status: 503 })).assertions[0].context)
  })
  it('does not use a sign-in redirect to verify repair of the original public page', () => {
    const redirected = document({ finalUrl: 'https://example.com/login', redirects: [pageUrl], body: '<title>Sign in to continue</title>' })
    const flag = assessPageResponse(pageUrl, document({ status: 503 })).flags[0]
    const observed = receipt(pageUrl, redirected)
    expect(observed).toMatchObject({ complete: false, passed: false })
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: observed })).toBeUndefined()
  })
  it('can observe a public sign-in page without claiming authenticated access', () => {
    const login = 'https://example.com/login'
    expect(assessPageResponse(login, document({ url: login, finalUrl: login, body: '<title>Sign in</title>' }))).toMatchObject({
      flags: [], complete: true, assertions: [{ passed: true, complete: true }] })
  })
  it.each([null, 301, 400, 401, 403, 407, 429, 511])('retains HTTP %s as unknown without inventing an outage or recovery', status => {
    expect(assessPageResponse(pageUrl, document({ status }))).toMatchObject({
      flags: [], complete: false, assertions: [{ passed: false, complete: false }] })
  })
  it.each([200, 503])('refuses an HTTP %s bot challenge as failure or positive proof', status => {
    expect(assessPageResponse(pageUrl, document({ status,
      body: '<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>' }))).toMatchObject({ flags: [], complete: false })
  })
  it('keeps missing, incomplete and mismatched documents inconclusive', () => {
    for (const input of [undefined, document({ complete: false }), document({ reason: 'public_access_challenge' }),
      document({ url: 'https://example.com/another-page' })]) {
      expect(assessPageResponse(pageUrl, input)).toMatchObject({ flags: [], complete: false,
        assertions: [{ passed: false, complete: false }] })
    }
  })
  it.each([
    ['interrupted body', { reason: 'response_body_unavailable' }, true],
    ['collection deadline', { status: null, reason: 'deadline_exhausted' }, true],
    ['confirmed server error', { status: 503, reason: 'response_body_unavailable' }, false],
    ['rate limit', { status: 429, reason: 'response_body_unavailable' }, false],
    ['bot challenge', { reason: 'public_access_challenge' }, false],
    ['body budget', { reason: 'document_truncated' }, false],
    ['unclassified transport', { status: null, reason: 'public_document_unavailable' }, false],
    ['another page', { url: pageUrl + '?other=1', reason: 'response_body_unavailable' }, false],
  ] as const)('preserves the collection interruption distinction for %s', (_label, overrides, interrupted) => {
    const checked = assessPageResponse(pageUrl, document({ complete: false, ...overrides }))
    expect(checked.interrupted).toBe(interrupted)
    if (interrupted) expect(checked).toMatchObject({ complete: false, flags: [] })
  })
  it('requires complete page labels in a bounded HTML sample before verifying recovery', () => {
    const flag = assessPageResponse(pageUrl, document({ status: 503 })).flags[0]
    const bounded = (body: string) => document({ body, complete: false, reason: 'document_truncated' })
    for (const sample of [
      '<title>Useful page</title><body><!-- remaining body was not collected',
      '<title>Useful page</title><h1>Page not found',
      '<title>Useful page</title><h1>Useful page</h1><h1>Page not found',
    ]) {
      expect(assessPageResponse(pageUrl, bounded(sample))).toMatchObject({ flags: [], complete: false })
      expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, bounded(sample)) })).toBeUndefined()
    }
    const missing = bounded('<title>Useful page</title><h1>Page not found</h1><!-- remaining body was not collected')
    expect(assessPageResponse(pageUrl, missing)).toMatchObject({ flags: [{ checkId: 'page-http-error' }], complete: true })
    const recovered = bounded('<title>Useful page</title><h1>Useful page</h1><!-- remaining body was not collected')
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, recovered) })?.assertion.passed).toBe(true)
    const withoutTitle = bounded('<h1>Useful page</h1><!-- remaining body was not collected')
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(pageUrl, withoutTitle) })?.assertion.passed).toBe(true)
  })
  it('does not persist signed query values in finding text', () => {
    const url = pageUrl + '?token=secret-value'
    const checked = assessPageResponse(url, document({ url, finalUrl: url, status: 503 }))
    expect(checked.flags[0].evidence).not.toContain('secret-value')
    expect(checked.assertions[0].observed).not.toContain('secret-value')
  })
  it('verifies only the original HTTP request, refusing another page or evidence source', () => {
    const flag = assessPageResponse(pageUrl, document({ status: 503 })).flags[0]
    const passing = receipt(pageUrl, document())
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: passing })?.assertion.passed).toBe(true)
    const other = 'https://example.com/contact'
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag, receipt: receipt(other, document({ url: other, finalUrl: other })) })).toBeUndefined()
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag,
      receipt: { ...passing, execution: { ...passing.execution!, source: 'rendered-dom' } } })).toBeUndefined()
    expect(scopedAssertionForTarget({ checkId: flag.checkId, flag,
      receipt: receipt(pageUrl, document({ complete: false })) })).toBeUndefined()
  })
  it('requires every original page for repair and preserves a comparable remaining failure', () => {
    const peer = 'https://example.com/contact'
    const first = assessPageResponse(pageUrl, document({ status: 503 })).flags[0]
    const second = assessPageResponse(peer, document({ url: peer, finalUrl: peer, status: 404 })).flags[0]
    const flag = { ...first, affectedPaths: [pageUrl, peer], evidenceTargets: [...first.evidenceTargets!, ...second.evidenceTargets!] }
    const evaluate = (rows: ReturnType<typeof receipt>[]) => recordedVerificationVerdict({ auditId: 'verification', flag,
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'page-http-error': 1 }, outcomes: [], verificationTarget: null },
      executions: rows.map(detail => ({ targetKey: 'module:page-response', status: 'COMPLETED', detail })) })
    const healthy = receipt(pageUrl, document())
    expect(evaluate([healthy])).toBeNull()
    expect(evaluate([healthy, receipt(peer, document({ url: peer, finalUrl: peer, complete: false }))])).toBeNull()
    expect(evaluate([healthy, receipt(peer, document({ url: peer, finalUrl: peer, status: 503 }))])).toBe('failed')
    expect(evaluate([healthy, receipt(peer, document({ url: peer, finalUrl: peer }))])).toBe('passed')
  })
})
