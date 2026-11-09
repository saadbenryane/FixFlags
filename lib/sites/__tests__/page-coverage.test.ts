import { describe, expect, it } from 'vitest'
import { executionPageCoverage } from '../page-coverage'
import { assessPageResponse } from '@/lib/audit/checks/page-response'

const url = 'https://example.com/', peer = url + 'pricing'
const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
  monitoringPages: [url, peer], checks: {}, outcomes: [], verificationTarget: null }
const page = (url: string, status = 'COMPLETED') => ({ url, status })

describe('admitted page coverage', () => {
  it('retains an admitted page when collection stops before its row exists', () => {
    expect(executionPageCoverage({ executionSpec: spec, pages: [page(url)] }))
      .toEqual({ pagesReached: 1, pagesExpected: 2, complete: false })
    expect(executionPageCoverage({ executionSpec: spec, pages: [page(url), page(peer)] }))
      .toEqual({ pagesReached: 2, pagesExpected: 2, complete: true })
  })
  it('includes discovered browser obligations while excluding incidental response destinations', () => {
    expect(executionPageCoverage({ executionSpec: { ...spec, monitoringPages: undefined }, pages: [page(url)], executions: [
      { targetKey: 'task:p1:browser', workKind: 'browser', pageUrl: peer },
      { targetKey: 'module:flow', workKind: null, pageUrl: url + 'signup' },
      { targetKey: 'task:p0:google-index', workKind: 'google', pageUrl: url + 'context' },
    ] })).toEqual({ pagesReached: 1, pagesExpected: 2, complete: false })
  })
  it('does not collapse recorded locale, query, fragment or path-case conditions', () => {
    const urls = [url, peer, url + 'Pricing', peer + '?lang=fr', peer + '#annual']
    const observed = executionPageCoverage({ executionSpec: { ...spec, monitoringPages: urls }, pages: [page(url), page(peer)] })
    expect(observed).toEqual({ pagesReached: 2, pagesExpected: 5, complete: false })
  })
  it('restricts a category to its frozen pages and refuses unrelated substitutes', () => {
    const category = { ...spec, scope: 'CATEGORY', monitoringPages: undefined,
      category: { area: 'security', sourceAuditId: 'source', pages: [url, peer] } }
    expect(executionPageCoverage({ executionSpec: category, pages: [page(url), page(url + 'other')] }))
      .toEqual({ pagesReached: 1, pagesExpected: 2, complete: false })
    expect(executionPageCoverage({ executionSpec: category, pages: [page(url), page(peer), page(url + 'other', 'FAILED')] }))
      .toEqual({ pagesReached: 2, pagesExpected: 2, complete: true })
  })
  it('retains a failed observation and counts duplicate page identities once', () => {
    expect(executionPageCoverage({ executionSpec: spec, pages: [page(url), page(peer), page(peer, 'FAILED')] }))
      .toEqual({ pagesReached: 1, pagesExpected: 2, complete: false })
    expect(executionPageCoverage({ executionSpec: spec, pages: [page(url), page(peer), page(peer)] }))
      .toEqual({ pagesReached: 2, pagesExpected: 2, complete: true })
  })
  it.each([
    ['healthy', true], ['confirmed failure', true], ['missing', false], ['unavailable', false],
    ['another page', false], ['another Run', false], ['another version', false], ['unqualified success', false],
  ] as const)('keeps page inventory and %s response evidence separate', (scenario, complete) => {
    const observedPage = scenario === 'another page' ? peer + '?plan=other' : peer
    function observe(pageUrl: string, status: number) {
      const checked = assessPageResponse(pageUrl, { url: pageUrl, finalUrl: pageUrl, status,
        headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>Available page</title><h1>Available page</h1>',
        complete: true, reason: null, redirects: [], collectedAt: '2026-11-09T12:00:00.000Z' })
      return { targetKey: 'module:page-response', status: 'COMPLETED', pageUrl, detail: {
        kind: 'site-module-check', version: 1, module: 'page-response', pageUrl, applicable: true,
        passed: checked.assertions.every(item => item.passed), complete: checked.complete, assertions: checked.assertions,
        execution: { auditId: 'run', taskId: 'page-response:' + pageUrl, source: 'http', checkVersion: 1,
          collectedAt: '2026-11-09T12:00:00.000Z' },
      } }
    }
    const root = observe(url, 200)
    const other = observe(observedPage, scenario === 'confirmed failure' ? 404 : scenario === 'unavailable' ? 429 : 200)
    if (scenario === 'another Run') other.detail.execution.auditId = 'old-run'
    if (scenario === 'another version') other.detail.execution.checkVersion = 2
    if (scenario === 'unqualified success') delete other.detail.assertions[0].pageResponseQualified
    const input = { auditId: 'run', executionSpec: { ...spec, checks: { 'page-http-error': 1, 'page-redirect-loop': 1 } },
      pages: [page(url), page(peer)], executions: scenario === 'missing' ? [root] : [root, other] }
    expect(executionPageCoverage(input)).toEqual({ pagesReached: 2, pagesExpected: 2, complete })
  })
  it('keeps historical row-based evidence and leaves unreadable progressive scope incomplete', () => {
    expect(executionPageCoverage({ executionSpec: null, pages: [{ status: 'COMPLETED' }] }))
      .toEqual({ pagesReached: 1, pagesExpected: 1, complete: true })
    expect(executionPageCoverage({ executionSpec: { engine: 'progressive-v1' }, pages: [page(url)] }).complete).toBe(false)
    expect(executionPageCoverage({ executionSpec: null, pages: [] }).complete).toBe(false)
  })
})
