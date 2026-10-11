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
    loadingExperience: {
      id: 'https://example.com/', metrics: {
        LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2400 },
        CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12 },
        FIRST_CONTENTFUL_PAINT_MS: { percentile: 1100 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 160 },
        EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 400 },
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
    assert.equal(result.desktop?.crux?.cls, 0.12)
    assert.equal(result.desktop?.crux?.scope, 'page')
    assert.equal(result.desktop?.crux?.reportingWindowDays, 28)
    assert.equal(result.desktop?.crux?.formFactor, null)
    assert.equal(result.desktop?.crux?.effectiveConnectionType, null)

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

  it('retains zero lab measurements and does not mistake malformed responses for measurements', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ lighthouseResult: {
      categories: { performance: { score: 0 } }, audits: {
        'cumulative-layout-shift': { numericValue: 0 }, 'total-blocking-time': { numericValue: 0 },
      },
    } })), { status: 200 }))
    const zero = await fetchPageSpeedData('https://zero.example', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(zero.desktop).toMatchObject({ score: 0, cls: 0, tbt: 0 })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const invalid = await fetchPageSpeedData('https://invalid.example', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(invalid.desktop).toBeNull()
    expect(invalid.desktopFailure).toEqual({ code: 'PROVIDER_RESPONSE_INVALID', retryable: false })
  })

  it('returns per-device transient failure and provider retry timing without inline replay', async () => {
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 429, headers: { 'retry-after': '120' } }))
    const result = await fetchPageSpeedData('https://retry.example', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.mobileFailure).toEqual({ code: 'PROVIDER_QUOTA', retryable: true, retryAfterMs: 120_000 })
    expect(result.desktopFailure).toBeUndefined()
    expect(result.desktopError).toBeUndefined()
  })

  it('labels origin-only field data rather than attributing it to the requested page', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ loadingExperience: { id: 'https://example.com/page', metrics: {} },
      originLoadingExperience: { id: 'https://example.com/', metrics: { CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0 } } } })), { status: 200 }))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(result.desktop?.crux).toMatchObject({ cls: 0, scope: 'origin', url: 'https://example.com/', reportingWindowDays: 28 })
  })
})
