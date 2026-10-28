import assert from 'node:assert/strict'
import { describe, it, beforeEach, vi, afterEach, expect } from 'vitest'
import { auditCache } from '../cache'
import { fetchPageSpeedData, toStoredPageSpeedResult, PAGESPEED_REQUEST_TIMEOUT_MS } from '../pagespeed'
import { runInpChecks, runPerformanceChecks } from '../checks/performance'
import { recordInpObservation } from '../checks/observations'
import { pageSpeedSchema } from '../progressive/snapshots'
import { readCruxMetric } from '../crux'

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
      details: { overallSavingsMs: 800, overallSavingsBytes: 150_000 },
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function okApiResponse() {
    return new Response(JSON.stringify(lighthouseBody()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  function delayedProvider(delay: number) {
    fetchMock.mockImplementation((_url, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(okApiResponse()), delay)
      init.signal!.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('Provider request aborted', 'AbortError'))
      }, { once: true })
    }))
  }

  it('retains a valid 61-second measurement with one progressive request', async () => {
    vi.useFakeTimers()
    delayedProvider(61_000)
    const result = fetchPageSpeedData('https://slow.example/', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    await vi.advanceTimersByTimeAsync(61_000)
    expect((await result).desktop).toMatchObject({ score: 85, lcp: 2500 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts an unfinished measurement at the bounded provider deadline', async () => {
    vi.useFakeTimers()
    delayedProvider(PAGESPEED_REQUEST_TIMEOUT_MS + 1)
    const result = fetchPageSpeedData('https://timeout.example/', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    await vi.advanceTimersByTimeAsync(PAGESPEED_REQUEST_TIMEOUT_MS - 1)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toMatchObject({ mobile: null, mobileFailure: { code: 'PROVIDER_UNAVAILABLE', retryable: true } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors earlier caller cancellation without waiting for the provider deadline', async () => {
    vi.useFakeTimers()
    delayedProvider(61_000)
    const controller = new AbortController()
    const result = fetchPageSpeedData('https://cancel.example/', controller.signal, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    await vi.advanceTimersByTimeAsync(1_000)
    controller.abort()
    expect((await result).desktop).toBeNull()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns parsed desktop and mobile results from the API', async () => {
    fetchMock.mockImplementation(async () => okApiResponse())
    const result = await fetchPageSpeedData('https://example.com')

    assert.equal(result.desktop?.score, 85)
    assert.equal(result.desktop?.lcp, 2500)
    assert.equal(result.desktop?.cls, 0.12)
    assert.equal(result.desktop?.fcp, 1200)
    assert.equal(result.desktop?.tbt, 210)
    assert.equal(result.desktop?.inp, 160)

    assert.equal(result.desktop?.opportunities.length, 2)
    assert.ok(result.desktop?.opportunities.some((o) => o.id === 'render-blocking-resources'))
    assert.ok(result.desktop?.opportunities.some((o) => o.id === 'unused-javascript'))
    assert.equal(result.desktop?.opportunities[0].savings, 1200)

    assert.equal(result.desktop?.failedAccessibilityAudits.length, 1)
    assert.equal(result.desktop?.failedAccessibilityAudits[0].id, 'color-contrast')

    const field = readCruxMetric(result.desktop!.crux, 'lcp')!
    assert.equal(field.value, 2400)
    assert.equal(readCruxMetric(result.desktop!.crux, 'cls')!.value, 0.12)
    assert.equal(field.cohort.scope, 'page')
    assert.equal(field.cohort.reportingWindowDays, 28)
    assert.equal(field.cohort.formFactor, null)
    assert.equal(field.cohort.effectiveConnectionType, null)

    assert.equal(result.mobile?.strategy, 'mobile')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['https://other.example/page', 'https://example.com/other', 'http://example.com/page',
    'https://example.com:8443/page', 'https://private@example.com/page'])(
    'withholds field data for an unrelated page while preserving lab evidence: %s', async id => {
      fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: {
        id, metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 900 } },
      } })))
      const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
      expect(result.mobile).toMatchObject({ score: 85, lcp: 2500, cls: 0.12, inp: null, crux: null })
      expect(runInpChecks(result.mobile!)).toEqual([])
      expect(recordInpObservation(result.mobile!)).toMatchObject({ complete: false, passed: false })
    })

  it('keeps matching page evidence when origin field data belongs to another origin', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: {
      id: 'https://example.com/page', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1400 } },
    }, originLoadingExperience: { id: 'https://other.example/', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 900 } } } })))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(readCruxMetric(result.mobile!.crux, 'lcp')?.value).toBe(1400)
    expect(result.mobile!.inp).toBeNull()
    expect(runInpChecks(result.mobile!)).toEqual([])
  })

  it('retains the provider page granularity across query and fragment variants', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: {
      id: 'https://example.com/page', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 900 } },
    } })))
    const result = await fetchPageSpeedData('https://example.com/page?variant=teams#pricing', undefined,
      { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(result.mobile!.inp).toBe(900)
    expect(readCruxMetric(result.mobile!.crux, 'inp')?.cohort.url).toBe('https://example.com/page')
  })

  it('retains independent field context for the final page reported by a redirected lab measurement', async () => {
    const requestedUrl = 'https://example.com/old', finalUrl = 'https://www.example.com/current'
    const payload = lighthouseBody({ loadingExperience: { id: finalUrl, metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 900 } } },
      originLoadingExperience: { id: 'https://www.example.com/', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1400 } } } })
    payload.lighthouseResult = { ...payload.lighthouseResult as object, requestedUrl, finalUrl }
    fetchMock.mockResolvedValueOnce(Response.json(payload))
    const result = await fetchPageSpeedData(requestedUrl, undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(readCruxMetric(result.mobile!.crux, 'inp')).toMatchObject({ value: 900, cohort: { url: finalUrl, scope: 'page' } })
    expect(readCruxMetric(result.mobile!.crux, 'lcp')).toMatchObject({ value: 1400, cohort: { url: 'https://www.example.com/', scope: 'origin' } })
  })

  it('does not accept a page path as an origin-level cohort', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: { id: 'https://example.com/page', metrics: {} },
      originLoadingExperience: { id: 'https://example.com/unrelated', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 900 } } } })))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(result.mobile!.crux).toBeNull()
    expect(result.mobile!.inp).toBeNull()
  })

  it.each(['desktop', 'mobile'] as const)('preserves cached %s evidence when a fresh attempt is canceled', async strategy => {
    fetchMock.mockImplementation(async () => okApiResponse())
    const url = 'https://retained.example/'
    const original = (await fetchPageSpeedData(url, undefined, { strategies: [strategy], singleAttempt: true }))[strategy]
    expect(original?.score).toBe(85)
    delayedProvider(61_000)
    const controller = new AbortController()
    const cancelled = fetchPageSpeedData(url, controller.signal, { fresh: true, strategies: [strategy], singleAttempt: true })
    controller.abort()
    expect((await cancelled)[strategy]).toBeNull()
    expect((await fetchPageSpeedData(url, undefined, { strategies: [strategy] }))[strategy]).toEqual(original)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['requestedUrl', 'formFactor'] as const)('refuses a provider response with a different %s', async changed => {
    fetchMock.mockResolvedValue(Response.json(lighthouseBody({ lighthouseResult: {
      ...(lighthouseBody().lighthouseResult as object), requestedUrl: changed === 'requestedUrl' ? 'https://other.example/' : 'https://example.com/',
      finalUrl: 'https://example.com/', lighthouseVersion: '13.0', configSettings: { formFactor: changed === 'formFactor' ? 'mobile' : 'desktop' },
    } })))
    const result = await fetchPageSpeedData('https://example.com/', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(result.desktop).toBeNull()
    expect(result.desktopFailure).toMatchObject({ code: 'PROVIDER_RESPONSE_INVALID', retryable: false })
  })

  it('includes tap-target opportunities only for mobile', async () => {
    fetchMock.mockImplementation(async () => okApiResponse())
    const result = await fetchPageSpeedData('https://example.com')
    assert.ok(result.mobile?.opportunities.some((o) => o.id === 'target-size'))
    assert.ok(result.desktop !== null)
    assert.ok(!result.desktop?.opportunities.some((o) => o.id === 'target-size'))
  })

  it.each([{ errorMessage: 'Measurement failed' }, { notApplicable: true }, { scoreDisplayMode: 'error' },
    { scoreDisplayMode: 'notApplicable' }, { scoreDisplayMode: 'manual' }, { scoreDisplayMode: 'informative' }])
    ('preserves unavailable lab metrics despite retained numeric values: %j', async unavailable => {
      fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ lighthouseResult: { categories: { performance: { score: 0.95 } }, audits: {
        'largest-contentful-paint': { numericValue: 1000, ...unavailable },
        'cumulative-layout-shift': { numericValue: 0, ...unavailable },
        'first-contentful-paint': { numericValue: 500, ...unavailable },
        'total-blocking-time': { numericValue: 0, ...unavailable },
      } } })))
      const result = await fetchPageSpeedData('https://example.com/', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
      expect(result.desktop).toMatchObject({ score: 95, lcp: null, cls: null, fcp: null, tbt: null })
      expect(readCruxMetric(result.desktop!.crux, 'lcp')?.value).toBe(2400)
      expect(readCruxMetric(result.desktop!.crux, 'cls')?.value).toBe(0.12)
    })

  it('normalizes current Lighthouse insights and feeds actual byte savings into findings', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ lighthouseResult: {
      categories: { performance: { score: 0.95 } }, audits: {
        'render-blocking-insight': { score: 0, title: 'Render blocking', metricSavings: { FCP: 850, LCP: 1200 }, details: { type: 'table' } },
        'image-delivery-insight': { score: 0, title: 'Improve image delivery', details: { debugData: { wastedBytes: 180_000 } } },
        'unused-javascript': { score: 0, title: 'Unused JS', details: { overallSavingsMs: 300, overallSavingsBytes: 200_000 } },
        'unused-css-rules': { score: 0, title: 'Unused CSS', details: { overallSavingsMs: 50, overallSavingsBytes: 80_000 } },
      },
    } })), { status: 200 }))
    const result = await fetchPageSpeedData('https://insights.example', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(result.desktop?.opportunities).toEqual([
      { id: 'render-blocking-resources', title: 'Render blocking', savings: 850 },
      { id: 'unused-javascript', title: 'Unused JS', savings: 200_000 },
      { id: 'unused-css-rules', title: 'Unused CSS', savings: 80_000 },
      { id: 'uses-optimized-images', title: 'Improve image delivery', savings: 180_000 },
    ])
    const { runPerformanceChecks } = await import('../checks/performance')
    expect(runPerformanceChecks(result.desktop, null).map(flag => flag.checkId)).toEqual([
      'render-blocking', 'unused-js-large', 'unused-css-large', 'unoptimized-images',
    ])
  })

  it('preserves all supported opportunities and never substitutes time savings for bytes', async () => {
    const byteIds = ['unused-javascript', 'unused-css-rules', 'uses-optimized-images', 'modern-image-formats', 'uses-responsive-images', 'efficient-animated-content', 'uses-text-compression']
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ lighthouseResult: {
      categories: { performance: { score: 0.9 } }, audits: Object.fromEntries(byteIds.map(id => [id, {
        score: 0, title: id, details: { overallSavingsMs: 900_000, ...(id === 'unused-javascript' ? {} : { overallSavingsBytes: 65_000 }) },
      }])),
    } })), { status: 200 }))
    const result = await fetchPageSpeedData('https://opportunities.example', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(result.desktop?.opportunities).toHaveLength(6)
    expect(result.desktop?.opportunities.some(o => o.id === 'unused-javascript')).toBe(false)
    expect(result.desktop?.opportunities.every(o => o.savings === 65_000)).toBe(true)
  })

  it('retains positive resource measurements without manufacturing success from absent or unavailable audits', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ lighthouseResult: { categories: { performance: { score: 0.95 } }, audits: {
      'render-blocking-insight': { score: 1, details: { type: 'table', items: [] } },
      'unused-javascript': { score: 1, details: { overallSavingsBytes: 0 } },
      'unused-css-rules': { score: null, scoreDisplayMode: 'notApplicable', details: { overallSavingsBytes: 0 } },
      'image-delivery-insight': { score: null, errorMessage: 'Trace model unavailable', details: { debugData: { wastedBytes: 0 } } },
      'uses-optimized-images': { score: 1, details: { overallSavingsBytes: 0 } },
    } } })))
    const result = await fetchPageSpeedData('https://positive-resources.example', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(result.desktop?.opportunities).toEqual([])
    expect(result.desktop?.resourceAudits).toMatchObject([
      { id: 'render-blocking-resources', providerAuditId: 'render-blocking-insight', savings: 0, score: 1 },
      { id: 'unused-javascript', savings: 0, score: 1, unit: 'bytes' },
      { id: 'unused-css-rules', savings: null, score: null },
      { id: 'uses-optimized-images', providerAuditId: 'image-delivery-insight', savings: null, score: null },
    ])
    expect(toStoredPageSpeedResult(result.desktop!)).toHaveProperty('resourceAudits', result.desktop!.resourceAudits)
  })

  it('prefers a consolidated image insight without duplicating replaced audit savings', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ lighthouseResult: {
      categories: { performance: { score: 0.9 } }, audits: {
        'image-delivery-insight': { score: 0, details: { debugData: { wastedBytes: 100_000 } } },
        'uses-optimized-images': { score: 0, details: { overallSavingsBytes: 60_000 } },
        'modern-image-formats': { score: 0, details: { overallSavingsBytes: 90_000 } },
      },
    } })), { status: 200 }))
    const result = await fetchPageSpeedData('https://overlap.example', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(result.desktop?.opportunities).toEqual([{ id: 'uses-optimized-images', title: 'image-delivery-insight', savings: 100_000 }])
  })

  it('keeps INP unknown when field data is absent, even if a lab-shaped INP audit is supplied', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ loadingExperience: undefined })), { status: 200 }))
    const result = await fetchPageSpeedData('https://no-field.example', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(result.mobile?.inp).toBeNull()
  })

  it('retains field INP scope and does not attribute origin data to the checked page', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ loadingExperience: undefined,
      originLoadingExperience: { id: 'https://example.com/', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 650 } } },
    })), { status: 200 }))
    const result = await fetchPageSpeedData('https://example.com/pricing', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    const { runPerformanceChecks } = await import('../checks/performance')
    expect(runPerformanceChecks(null, result.mobile)).toMatchObject([{ checkId: 'inp-critical',
      problem: expect.stringContaining('Origin-level'), evidence: expect.stringContaining('origin scope (https://example.com/), trailing 28 days') }])
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

  it('retains origin INP alongside independent page metrics through stored evidence and evaluation', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({
      lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'largest-contentful-paint': { numericValue: 5000 } } },
      loadingExperience: { id: 'https://example.com/page', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1400 } } },
      originLoadingExperience: { id: 'https://example.com/', metrics: {
        INTERACTION_TO_NEXT_PAINT: { percentile: 800 }, LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2800 },
      } },
    })))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(result.mobile?.inp).toBe(800)
    const stored = pageSpeedSchema.parse({ ...toStoredPageSpeedResult(result.mobile!), raw: {} })
    expect(runInpChecks(stored)[0]).toMatchObject({ checkId: 'inp-critical', problem: expect.stringContaining('Origin-level') })
    expect(runInpChecks(stored)[0].evidence).toContain('origin scope (https://example.com/)')
    expect(recordInpObservation(stored)).toMatchObject({ complete: true, passed: false, disposition: 'observed',
      observed: expect.stringContaining('origin scope') })
    expect(runPerformanceChecks(stored, null)[0].evidence).toContain('CrUX page (p75, 28 days): 1.4s')
  })

  it('honors an explicit origin fallback inside the page experience record', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: {
      id: 'https://example.com/', origin_fallback: true, metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 800 } },
    } })))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(runInpChecks(result.mobile!)[0].evidence).toContain('origin scope')
    expect(recordInpObservation(result.mobile!).observed).toContain('origin scope')
  })

  it('retains independent valid metrics when a sibling is malformed and ignores unknown metric names', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: {
      id: 'https://example.com/page', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1400 },
        INTERACTION_TO_NEXT_PAINT: { percentile: 'not measured' }, FUTURE_METRIC: { percentile: 10 } },
    }, originLoadingExperience: { id: 'https://example.com/', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 800 } } } })))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(readCruxMetric(result.mobile!.crux, 'lcp')).toMatchObject({ value: 1400, cohort: { scope: 'page' } })
    expect(readCruxMetric(result.mobile!.crux, 'inp')).toMatchObject({ value: 800, cohort: { scope: 'origin' } })
  })

  it('prefers a measured page value of zero over an origin failure without merging their scope', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(lighthouseBody({ loadingExperience: {
      id: 'https://example.com/page', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 0 } },
    }, originLoadingExperience: { id: 'https://example.com/', metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 800 } } } })))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['mobile'], singleAttempt: true })
    expect(result.mobile!.inp).toBe(0)
    expect(runInpChecks(result.mobile!)).toEqual([])
    expect(recordInpObservation(result.mobile!)).toMatchObject({ passed: true, complete: true, disposition: 'observed',
      observed: expect.stringContaining('0ms, page scope') })
  })

  it('reads historical single-cohort evidence without inventing its missing source scope', () => {
    const stored = pageSpeedSchema.parse({ strategy: 'mobile', score: 90, lcp: 1400, cls: 0.02, fcp: 800, tbt: 0, inp: 800,
      opportunities: [], failedAccessibilityAudits: [], diagnostics: {}, raw: {}, crux: {
        lcp: 1400, cls: 0.02, fcp: 800, inp: 800, ttfb: 100, formFactor: 'PHONE', effectiveConnectionType: '4G',
      } })
    const field = readCruxMetric(stored.crux, 'inp')!
    expect(field.value).toBe(800)
    expect(field.cohort.scope).toBeUndefined()
    expect(field.cohort.url).toBeUndefined()
    expect(recordInpObservation(stored)).toMatchObject({ complete: true, passed: false, disposition: 'observed',
      observed: expect.stringContaining('unknown scope') })
    expect(runInpChecks(stored)[0].evidence).toContain('unknown scope')
  })

  it('labels origin-only field data rather than attributing it to the requested page', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(lighthouseBody({ loadingExperience: { id: 'https://example.com/page', metrics: {} },
      originLoadingExperience: { id: 'https://example.com/', metrics: { CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 0 } } } })), { status: 200 }))
    const result = await fetchPageSpeedData('https://example.com/page', undefined, { fresh: true, strategies: ['desktop'], singleAttempt: true })
    expect(readCruxMetric(result.desktop!.crux, 'cls')).toMatchObject({ value: 0,
      cohort: { scope: 'origin', url: 'https://example.com/', reportingWindowDays: 28 } })
  })
})
