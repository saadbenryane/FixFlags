import { describe, expect, it } from 'vitest'
import { assessPageResponse } from './page-response'
import type { PublicDocument } from '../search/contracts'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
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
  it.each([404, 410, 500, 502, 503])('flags an observed HTTP %s without requiring rendered content', status => {
    const checked = assessPageResponse(pageUrl, document({ status }))
    expect(checked).toMatchObject({ complete: true, assertions: [{ complete: true, passed: false }] })
    expect(checked.flags).toMatchObject([{ checkId: 'page-http-error', pageUrl, severity: 'CRITICAL', confidence: 1 }])
    expect(checked.flags[0].evidence).toContain(`HTTP ${status}`)
  })
  it.each([200, 204])('records a successful HTTP %s as transport proof only', status => {
    const checked = assessPageResponse(pageUrl, document({ status }))
    expect(checked).toMatchObject({ flags: [], complete: true, assertions: [{ passed: true, complete: true }] })
    expect(checked.limitation).toContain('HTTP availability only')
  })
  it('accepts a deliberate public redirect while retaining the original requested page', () => {
    const checked = assessPageResponse(pageUrl, document({ finalUrl: 'https://example.com/new-pricing', redirects: [pageUrl] }))
    expect(checked.assertions[0]).toMatchObject({ passed: true, complete: true })
    expect(checked.assertions[0].context).toBe(assessPageResponse(pageUrl, document({ status: 503 })).assertions[0].context)
  })
  it('can observe a public sign-in page without claiming authenticated access', () => {
    const login = 'https://example.com/login'
    expect(assessPageResponse(login, document({ url: login, finalUrl: login }))).toMatchObject({
      flags: [], complete: true, assertions: [{ passed: true, complete: true }] })
  })
  it.each([null, 301, 400, 401, 403, 429])('retains HTTP %s as unknown without inventing an outage or recovery', status => {
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
