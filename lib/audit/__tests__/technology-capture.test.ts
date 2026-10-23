import { describe, expect, it } from 'vitest'
import { observeCapturedTechnologies } from '../technology-capture'
import type { ScreenshotResult } from '../screenshot'

const scope = { pageUrl: 'https://example.com/', finalUrl: 'https://example.com/', profile: 'desktop', access: 'public' }
function captured(changes: Partial<ScreenshotResult> = {}): ScreenshotResult {
  return { desktopHtml: '<html><main data-reactroot>Useful service</main></html>', renderedScope: scope,
    responseHeaders: {}, technologyResources: [], technologyRuntimeMarkers: [], technologyResourcesTruncated: false,
    desktopUrl: null, mobileUrl: null, desktopBase64: null, mobileBase64: null, consoleErrors: [],
    captureFailures: [], captureStatus: { desktop: 'pending', mobile: 'pending' }, ...changes } as ScreenshotResult
}
describe('technology evidence from a bounded capture', () => {
  it('keeps a complete observation when the only restriction is a refused action', () => {
    expect(observeCapturedTechnologies(captured({ collectionRestrictions: ['protected_action_requires_fixture', 'payment_or_download_blocked'] })))
      .toMatchObject({ status: 'COMPLETE' })
  })
  it('publishes native document evidence independently of media and metadata parsing', () => {
    expect(observeCapturedTechnologies(captured())).toMatchObject({ status: 'COMPLETE', scope,
      detections: [expect.objectContaining({ name: 'React', kind: 'framework' })] })
  })
  it.each([
    ['truncated document', { desktopHtmlTruncated: true }],
    ['compacted document', { desktopHtmlCompacted: true }],
    ['truncated resources', { technologyResourcesTruncated: true }],
    ['request restriction', { collectionRestrictions: ['read_only_request_refused'] }],
    ['missing scope', { renderedScope: undefined }],
    ['missing response headers', { responseHeaders: undefined }],
    ['missing resources', { technologyResources: undefined }],
    ['missing runtime markers', { technologyRuntimeMarkers: undefined }],
    ['runtime marker limit', { technologyRuntimeMarkers: Array(33).fill('marker') }],
    ['resource limit', { technologyResources: Array(301).fill({ hostname: 'example.com', pathname: '/asset.js', resourceType: 'script', status: 200 }) }],
    ['document limit', { desktopHtml: '<main data-reactroot>' + 'x'.repeat(2_000_000) }],
  ] satisfies Array<[string, Partial<ScreenshotResult>]>)('retains presence without inferring absence under %s', (_reason, changes) => {
    expect(observeCapturedTechnologies(captured(changes))).toMatchObject({ status: 'PARTIAL',
      detections: [expect.objectContaining({ name: 'React' })] })
  })
  it('does not mistake a failed desktop document for a complete empty inventory', () => {
    expect(observeCapturedTechnologies(captured({ desktopHtml: null, renderedScope: undefined, responseHeaders: null })))
      .toMatchObject({ status: 'UNAVAILABLE', detections: [], scope: null })
  })
  it('retains a header detection when the rendered document is unavailable', () => {
    expect(observeCapturedTechnologies(captured({ desktopHtml: null, renderedScope: undefined, responseHeaders: { 'x-vercel-id': 'PRIVATE_TRACE' } })))
      .toMatchObject({ status: 'PARTIAL', detections: [expect.objectContaining({ name: 'Vercel' })] })
  })
  it('recognizes vendor hosts after the document and other resources in the inventory', () => {
    const resources = [
      { hostname: 'example.com', pathname: '/', resourceType: 'document', status: 200 },
      { hostname: 'plausible.io', pathname: '/js/script.js', resourceType: 'script', status: 200 },
      { hostname: 'js.stripe.com', pathname: '/v3/', resourceType: 'script', status: 200 },
    ]
    expect(observeCapturedTechnologies(captured({ technologyResources: resources })).detections.map(item => item.name))
      .toEqual(['Plausible', 'React', 'Stripe'])
  })
  it('uses recognized Tracking facts for failed libraries and suppressed event attempts', () => {
    const tracking = { version: 1, phase: 'page_load', requests: [
      { provider: 'vercel', role: 'library', hostname: 'example.com', endpoint: '/_vercel/insights/script.js', method: 'GET',
        phase: 'page_load', state: 'response', status: 503, reason: null, atMs: 1 },
      { provider: 'cloudflare', role: 'event', hostname: 'cloudflareinsights.com', endpoint: '/cdn-cgi/rum', method: 'POST',
        phase: 'page_load', state: 'suppressed', status: null, reason: 'scanner_suppressed', atMs: 2 },
    ], truncated: false, durationMs: 100, consentInteraction: 'none' } as const
    const result = observeCapturedTechnologies(captured({ tracking: structuredClone(tracking) as never }))
    expect(result.detections.map(item => item.name)).toEqual(['Cloudflare Web Analytics', 'React', 'Vercel Analytics'])
    expect(result.detections.find(item => item.name === 'Vercel Analytics')?.evidence).toEqual([{ type: 'resource', label: 'Vercel Analytics library request' }])
    expect(result.detections.find(item => item.name === 'Cloudflare Web Analytics')?.evidence).toEqual([{ type: 'resource', label: 'Cloudflare Web Analytics event attempt' }])
    expect(observeCapturedTechnologies(captured({ tracking: { ...structuredClone(tracking), truncated: true } as never })).status).toBe('PARTIAL')
  })
})
