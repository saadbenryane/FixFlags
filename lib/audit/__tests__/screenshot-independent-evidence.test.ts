import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), axe: vi.fn(), screenshot: vi.fn(), close: vi.fn(), truncated: vi.fn(),
  loading: vi.fn(), wait: vi.fn() }))
vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot: mocks.upload }))
vi.mock('@/lib/audit/url', () => ({ assertPublicAuditUrl: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('playwright', () => ({ chromium: { launch: async () => ({
  on: vi.fn(), isConnected: () => true, contexts: () => [], close: mocks.close,
}) } }))
vi.mock('@axe-core/playwright', () => ({ AxeBuilder: class {
  withTags() { return this } setLegacyMode() { return this } analyze() { return mocks.axe() }
} }))
vi.mock('@/lib/audit/capture-metrics', () => ({ measureMobileLayout: async () => ({ viewportWidth: 375 }) }))
vi.mock('@/lib/audit/browser/page-session', () => ({ settleAuditPage: vi.fn(), createAuditPage: async () => ({
  page: { url: () => 'https://example.com/', close: mocks.close, context: () => ({ close: mocks.close }),
    screenshot: mocks.screenshot, waitForFunction: mocks.wait,
    evaluate: async (fn: (...args: unknown[]) => unknown, argument: unknown) => {
      if (Array.isArray(argument)) return []
      if (typeof argument === 'string' || argument === false) return { readyState: 'complete', title: 'Example', loadingVisible: mocks.loading(), loadingLabel: 'hero-skeleton' }
      if (fn.toString().includes('outerHTML')) return { html: '<html><head><title>Example</title></head><body>Content</body></html>', truncated: false }
      if (fn.toString().includes('document.readyState ===')) return true
      return { title: 'Example', description: null, ogTitle: null, ogDescription: null, ogImage: null,
        canonical: null, lang: 'en', viewport: null, robots: null, hasFavicon: false }
    },
  }, navigationStartedAt: Date.now(), disposeNetwork: vi.fn(), responseHeaders: { 'content-type': 'text/html' }, httpStatus: 200,
  consoleTruncated: mocks.truncated, consoleTiming: () => ({ loaded: true, observedMs: 5000, minimumMs: 2000 }),
  tracking: () => ({ version: 1, phase: 'page_load', requests: [], truncated: false, durationMs: 10, consentInteraction: 'none' }),
  networkFailures: [], technologyResources: [], technologyResourcesTruncated: () => false, formProbe: null,
}) }))

import { captureScreenshots } from '../screenshot'

describe('independent rendered evidence', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.truncated.mockReturnValue(false); mocks.loading.mockReturnValue(false); mocks.wait.mockResolvedValue(undefined);
    mocks.screenshot.mockResolvedValue(new Uint8Array([1])); mocks.close.mockResolvedValue(undefined); mocks.upload.mockRejectedValue(new Error('Storage unavailable'));
    mocks.axe.mockResolvedValue({ url: 'https://example.com/', testEngine: { version: 'fixture-axe' }, violations: [], incomplete: [],
      passes: [{ id: 'button-name', nodes: [{ target: ['button'] }] }], inapplicable: [] }) })
  afterEach(() => { vi.useRealTimers() })
  it('measures loading clearance independently of media uploads and a delayed document title', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
    mocks.loading.mockImplementation(() => Date.now() < 500)
    mocks.wait.mockImplementation(async (fn, argument) => {
      if (typeof argument === 'string' || argument === true) {
        await pause(Math.max(0, 500 - Date.now()))
        if (argument === true) await pause(3500)
        return { jsonValue: async () => 500 }
      }
      else if (fn.toString().includes('document.title')) await pause(3000)
    })
    mocks.upload.mockImplementation(async () => { await pause(5000); return 'https://example.com/capture.png' })
    const pending = captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, mediaOnly: true })
    await vi.advanceTimersByTimeAsync(20_000)
    expect((await pending).loadExperience).toMatchObject({ loadingVisibleAtInitial: true, loadingVisibleAtFinal: false,
      loadingClearedMs: 500, initialCaptureElapsedMs: 0, initialScreenshotUrl: 'https://example.com/capture.png' })
  })
  it('leaves clearance unknown when the browser observation fails', async () => {
    mocks.loading.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false)
    mocks.wait.mockImplementation(async (_fn, argument) => { if (argument === true) throw new Error('Observation unavailable') })
    const result = await captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, captureMedia: false })
    expect(result.loadExperience).toMatchObject({ loadingVisibleAtInitial: true, loadingVisibleAtFinal: false, loadingClearedMs: null })
  })
  it('records DOM and an actually completed axe scan without accessing media storage', async () => {
    const result = await captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, captureMedia: false })
    expect(result.captureFailures).toEqual([])
    expect(result.desktopHtml).toContain('<title>Example</title>')
    expect(result.axeViolations).toEqual([])
    expect(result.accessibilityEvidence).toMatchObject({ engine: 'fixture-axe', rules: [{ id: 'button-name', state: 'passed', nodes: 1 }] })
    expect(result.loadExperience?.loadingClearedMs).toBeNull()
    expect(result.captureMetrics?.loadExperience?.loadingClearedMs).toBeNull()
    expect(result.captureStatus).toEqual({ desktop: 'pending', mobile: 'pending' })
    expect(result.consoleCoverage).toMatchObject({ phase: 'page_load', desktop: { complete: true, observedMs: 5000 }, mobile: { complete: true, observedMs: 5000 } })
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.screenshot).not.toHaveBeenCalled()
  })
  it('records console truncation independently of completed DOM and media status', async () => {
    mocks.truncated.mockReturnValue(true)
    const result = await captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, captureMedia: false })
    expect(result.desktopHtml).toContain('Content')
    expect(result.consoleCoverage).toMatchObject({ desktop: { complete: false }, mobile: { complete: false } })
  })
  it('does not turn an axe exception into a successful no-violations observation', async () => {
    mocks.axe.mockRejectedValueOnce(new Error('Frame injection refused'))
    const result = await captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, captureMedia: false })
    expect(result.desktopHtml).toContain('Content')
    expect(result.axeViolations).toBeUndefined()
    expect(result.accessibilityEvidence).toBeUndefined()
    expect(result.renderedScope).toMatchObject({ pageUrl: 'https://example.com/', finalUrl: 'https://example.com/', access: 'public' })
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
