import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), axe: vi.fn(), screenshot: vi.fn(), close: vi.fn() }))
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
    screenshot: mocks.screenshot, waitForFunction: async () => {},
    evaluate: async (fn: (...args: unknown[]) => unknown, argument: unknown) => {
      if (Array.isArray(argument)) return []
      if (typeof argument === 'string') return { readyState: 'complete', title: 'Example', loadingVisible: false, loadingLabel: null }
      if (fn.toString().includes('outerHTML')) return { html: '<html><head><title>Example</title></head><body>Content</body></html>', truncated: false }
      return { title: 'Example', description: null, ogTitle: null, ogDescription: null, ogImage: null,
        canonical: null, lang: 'en', viewport: null, robots: null, hasFavicon: false }
    },
  }, navigationStartedAt: Date.now(), disposeNetwork: vi.fn(), responseHeaders: { 'content-type': 'text/html' }, httpStatus: 200,
  tracking: () => ({ version: 1, phase: 'page_load', requests: [], truncated: false, durationMs: 10, consentInteraction: 'none' }),
  networkFailures: [], technologyResources: [], technologyResourcesTruncated: () => false, formProbe: null,
}) }))

import { captureScreenshots } from '../screenshot'

describe('independent rendered evidence', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.close.mockResolvedValue(undefined); mocks.upload.mockRejectedValue(new Error('Storage unavailable')); mocks.axe.mockResolvedValue({ violations: [] }) })
  it('records DOM and an actually completed axe scan without accessing media storage', async () => {
    const result = await captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, captureMedia: false })
    expect(result.captureFailures).toEqual([])
    expect(result.desktopHtml).toContain('<title>Example</title>')
    expect(result.axeViolations).toEqual([])
    expect(result.loadExperience?.loadingClearedMs).toBeNull()
    expect(result.captureMetrics?.loadExperience?.loadingClearedMs).toBeNull()
    expect(result.captureStatus).toEqual({ desktop: 'pending', mobile: 'pending' })
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.screenshot).not.toHaveBeenCalled()
  })
  it('does not turn an axe exception into a successful no-violations observation', async () => {
    mocks.axe.mockRejectedValueOnce(new Error('Frame injection refused'))
    const result = await captureScreenshots('https://example.com/', 'audit', undefined, { runFlow: false, captureMedia: false })
    expect(result.desktopHtml).toContain('Content')
    expect(result.axeViolations).toBeUndefined()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})
