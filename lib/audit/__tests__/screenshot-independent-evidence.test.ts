import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), axe: vi.fn(), screenshot: vi.fn(), close: vi.fn(), truncated: vi.fn(),
  loading: vi.fn(), wait: vi.fn(), flow: vi.fn() }))
vi.mock('@/lib/audit/flow/run-flow-scan', () => ({ runFlowScan: mocks.flow }))
vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot: mocks.upload }))
vi.mock('@/lib/audit/url', () => ({ assertPublicAuditUrl: vi.fn() }))
vi.mock('@/lib/audit/browser/public-proxy', () => ({
  startPublicBrowserProxy: async () => ({ url: 'http://127.0.0.1:1', close: vi.fn(async () => undefined) }),
  bindPublicBrowserProxy: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('playwright', () => ({ chromium: { launch: async () => ({
  on: vi.fn(), once: vi.fn(), isConnected: () => true, contexts: () => [], close: mocks.close,
}) } }))
vi.mock('@axe-core/playwright', () => ({ AxeBuilder: class {
  options() { return this } setLegacyMode() { return this } analyze() { return mocks.axe() }
} }))
vi.mock('@/lib/audit/capture-metrics', () => ({ measureMobileLayout: async () => ({ viewportWidth: 375 }) }))
vi.mock('@/lib/audit/browser/page-session', () => ({ settleAuditPage: vi.fn(), createAuditPage: async () => {
  const navigationStartedAt = Date.now()
  let loadingReads = 0
  return {
  page: { url: () => 'https://example.com/', close: mocks.close, context: () => ({ close: mocks.close }),
    screenshot: mocks.screenshot, waitForFunction: (fn: unknown, argument: unknown) => mocks.wait(fn, argument, navigationStartedAt),
    evaluate: async (fn: (...args: unknown[]) => unknown, argument: unknown) => {
      if (Array.isArray(argument)) return []
      if (typeof argument === 'string' || argument === false) return { readyState: 'complete', title: 'Example', loadingVisible: mocks.loading(Date.now() - navigationStartedAt, loadingReads++), loadingLabel: 'hero-skeleton' }
      if (fn.toString().includes('outerHTML')) return { html: '<html><head><title>Example</title></head><body>Content</body></html>', truncated: false }
      if (fn.toString().includes('document.readyState ===')) return true
      return { title: 'Example', description: null, ogTitle: null, ogDescription: null, ogImage: null,
        canonical: null, lang: 'en', viewport: null, robots: null, hasFavicon: false }
    },
  }, navigationStartedAt, disposeNetwork: vi.fn(), responseHeaders: { 'content-type': 'text/html' }, httpStatus: 200,
  consoleTruncated: mocks.truncated, consoleTiming: () => ({ loaded: true, observedMs: 5000, minimumMs: 2000 }),
  tracking: () => ({ version: 1, phase: 'page_load', requests: [], truncated: false, durationMs: 10, consentInteraction: 'none' }),
  networkFailures: [], technologyResources: [], technologyResourcesTruncated: () => false, formProbe: null,
  }
} }))

import { captureScreenshots } from '../screenshot'

describe('independent rendered evidence', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.truncated.mockReturnValue(false); mocks.loading.mockReturnValue(false); mocks.wait.mockResolvedValue(undefined);
    mocks.screenshot.mockResolvedValue(new Uint8Array([1])); mocks.close.mockResolvedValue(undefined); mocks.upload.mockRejectedValue(new Error('Storage unavailable'));
    mocks.axe.mockResolvedValue({ url: 'https://example.com/', testEngine: { version: 'fixture-axe' }, violations: [], incomplete: [],
      passes: [{ id: 'button-name', nodes: [{ target: ['button'] }] }], inapplicable: [] }) })
  afterEach(() => { vi.useRealTimers() })
  it('fills initial, landing and timeline references from their actual asynchronous uploads', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    mocks.upload.mockImplementation(async (_auditId, device, _buffer, key) => {
      await new Promise<void>(resolve => setTimeout(resolve, 5_000))
      return `https://example.com/${device}/${key ?? 'final'}.png`
    })
    mocks.flow.mockImplementation(async (_page, _auditId, pageUrl, options) => ({ status: 'success', steps: [options.landingStep], finalUrl: pageUrl }))
    const initial = vi.fn()
    const pending = captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: true, mediaOnly: true, onInitialScreenshot: initial })
    await vi.advanceTimersByTimeAsync(10_000)
    const result = await pending
    expect(result.flowResult?.steps[0].screenshotUrl).toBe(result.desktopUrl)
    expect(result.actionTimeline?.find(event => event.label === 'Desktop screenshot captured')?.screenshot).toBe(result.desktopUrl)
    expect(result.desktopUrl).toBe('https://example.com/desktop/final.png')
    expect(result.loadExperience?.initialScreenshotUrl).toBe('https://example.com/mobile/initial.png')
    expect(initial).toHaveBeenCalledWith('https://example.com/desktop/initial.png')
  })
  it('measures loading clearance independently of media uploads and a delayed document title', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
    mocks.loading.mockImplementation((elapsed) => elapsed < 500)
    mocks.wait.mockImplementation(async (fn, argument, navigationStartedAt) => {
      if (typeof argument === 'string' || argument === true) {
        await pause(Math.max(0, navigationStartedAt + 500 - Date.now()))
        if (argument === true) await pause(3500)
        return { jsonValue: async () => navigationStartedAt + 500 }
      }
      else if (fn.toString().includes('document.title')) await pause(3000)
    })
    mocks.upload.mockImplementation(async () => { await pause(5000); return 'https://example.com/capture.png' })
    const pending = captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, mediaOnly: true })
    let completed = false
    void pending.then(() => { completed = true }, () => undefined)
    await vi.advanceTimersByTimeAsync(4500)
    expect(mocks.close).toHaveBeenCalled()
    expect(completed).toBe(false)
    await vi.advanceTimersByTimeAsync(20_000)
    expect((await pending).loadExperience).toMatchObject({ loadingVisibleAtInitial: true, loadingVisibleAtFinal: false,
      loadingClearedMs: 500, initialCaptureElapsedMs: 0, initialScreenshotUrl: 'https://example.com/capture.png' })
  })
  it('leaves clearance unknown when the browser observation fails', async () => {
    mocks.loading.mockImplementation((_elapsed, read) => read === 0)
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
