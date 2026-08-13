import assert from 'node:assert/strict'
import { describe, it, beforeEach, vi, afterEach, expect } from 'vitest'
import { auditCache } from '../cache'
import { fetchPageSpeedData, toStoredPageSpeedResult } from '../pagespeed'

const fetchMock = vi.fn()

function lighthouseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const categories = {
    performance: { score: 0.85 },
    accessibility: {},
  }
  const audits: Record<string, Record<string, unknown>> = {
    'largest-contentful-paint': { numericValue: 2500, score: null },
    'cumulative-layout-shift': { numericValue: 0.12, score: null },
    'first-contentful-paint': { numericValue: 1200, score: null },
    'total-blocking-time': { numericValue: 210, score: null },
    'interaction-to-next-paint': { numericValue: 150, score: null },
    'color-contrast': { score: 0, title: 'Background and foreground colors do not have a sufficient contrast ratio.' },
    'render-blocking-resources': {
      score: 0,
      title: 'Eliminate render-blocking resources',
      details: { overallSavingsMs: 1200 },
    },
    'target-size': {
      score: 0,
      title: 'Tap targets do not have sufficient size',
      details: { items: [{}, {}] },
    },
    'unused-javascript': {
      score: 0.5,
      title: 'Remove unused JavaScript',
      details: { overallSavingsMs: 800 },
    },
  }
  return {
    lighthouseResult: { categories, audits },
    crux: {
      data: {
        record: {
          metrics: {
            largest_contentful_paint: { percentile: 2400 },
            cumulative_layout_shift: { percentile: 0.121 },
            first_contentful_paint: { percentile: 1100 },
            interaction_to_next_paint: { percentile: 160 },
            first_byte: { percentile: 400 },
          },
          key: { formFactor: 'PHONE', effectiveConnectionType: '4G' },
        },
      },
    },
    ...overrides,
  }
}

describe('fetchPageSpeedData', () => {
  beforeEach(() => {
    auditCache.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function okApiResponse() {
    return new Response(JSON.stringify(lighthouseBody()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  it('returns parsed desktop and mobile results from the API', async () => {
    fetchMock.mockImplementation(async () => okApiResponse())
    const result = await fetchPageSpeedData('https://example.com')

    assert.equal(result.desktop?.score, 85)
    assert.equal(result.desktop?.lcp, 2500)
    assert.equal(result.desktop?.cls, 0.12)
    assert.equal(result.desktop?.fcp, 1200)
    assert.equal(result.desktop?.tbt, 210)
    assert.equal(result.desktop?.inp, 150)

    assert.equal(result.desktop?.opportunities.length, 2)
    assert.ok(result.desktop?.opportunities.some((o) => o.id === 'render-blocking-resources'))
    assert.ok(result.desktop?.opportunities.some((o) => o.id === 'unused-javascript'))
    assert.equal(result.desktop?.opportunities[0].savings, 1200)

    assert.equal(result.desktop?.failedAccessibilityAudits.length, 1)
    assert.equal(result.desktop?.failedAccessibilityAudits[0].id, 'color-contrast')

    assert.equal(result.desktop?.crux?.lcp, 2400)
    assert.equal(result.desktop?.crux?.cls, 0.121)
    assert.equal(result.desktop?.crux?.formFactor, 'PHONE')
    assert.equal(result.desktop?.crux?.effectiveConnectionType, '4G')

    assert.equal(result.mobile?.strategy, 'mobile')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('includes tap-target opportunities only for mobile', async () => {
    fetchMock.mockImplementation(async () => okApiResponse())
    const result = await fetchPageSpeedData('https://example.com')
    assert.ok(result.mobile?.opportunities.some((o) => o.id === 'target-size'))
    assert.ok(result.desktop !== null)
    assert.ok(!result.desktop?.opportunities.some((o) => o.id === 'target-size'))
  })

  it('uses cached results without re-fetching', async () => {
    const cached = toStoredPageSpeedResult({
      strategy: 'desktop',
      score: 88,
      lcp: 1000,
      cls: 0,
      fcp: 500,
      tbt: 0,
      inp: 0,
      opportunities: [],
      failedAccessibilityAudits: [],
      diagnostics: {},
      raw: {},
      crux: null,
    })
    auditCache.set('pagespeed:https://example.com:desktop:desktop', cached, 60_000)
    auditCache.set('pagespeed:https://example.com:mobile:mobile', cached, 60_000)

    const result = await fetchPageSpeedData('https://example.com')
    assert.equal(result.desktop?.score, 88)
    assert.equal(result.mobile?.score, 88)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports errors when the API returns a non-ok status', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }))
    const result = await fetchPageSpeedData('https://example.com')
    assert.equal(result.desktop, null)
    assert.match(result.desktopError ?? '', /429/)
    assert.match(result.mobileError ?? '', /429/)
  })

  it('retries a retryable error and succeeds on the second attempt', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('busy', { status: 500 }))
      .mockImplementationOnce(async () => new Response('busy', { status: 500 }))
      .mockImplementation(async () => okApiResponse())
    const result = await fetchPageSpeedData('https://example.com')
    assert.equal(result.desktop?.score, 85)
    assert.equal(result.mobile?.score, 85)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('caches a failure sentinel and reports it on the next call', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 503 }))
    const first = await fetchPageSpeedData('https://example.com')
    assert.equal(first.desktop, null)

    fetchMock.mockClear()
    const second = await fetchPageSpeedData('https://example.com')
    expect(fetchMock).not.toHaveBeenCalled()
    assert.equal(second.desktop, null)
    assert.equal(second.desktopError, 'PageSpeed failed recently, retrying later')
  })

  it('aborts immediately when the signal is already aborted', async () => {
    const signal = AbortSignal.abort()
    const result = await fetchPageSpeedData('https://example.com', signal)
    assert.equal(result.desktop, null)
    assert.equal(result.mobile, null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null results when crux data is absent', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            lighthouseResult: {
              categories: { performance: { score: 0.9 } },
              audits: {},
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const result = await fetchPageSpeedData('https://example.com')
    assert.equal(result.desktop?.score, 90)
    assert.equal(result.desktop?.crux, null)
    assert.equal(result.desktop?.lcp, null)
  })
})
