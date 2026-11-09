import { describe, expect, it, vi } from 'vitest'
import { verifyGaPageviewDocuments } from '../ga-pageview-document'
import { FIXFLAGS_PUBLIC_GA_PAGES } from '../public-ga-pages'

const origin = 'https://fixflags.com'
const marker = FIXFLAGS_PUBLIC_GA_PAGES.join(' ')
const response = (url: string, paths?: string, status = 200) => new Response(
  `<!doctype html><html><head><link rel="canonical" href="${url}"></head>
  <body${paths === undefined ? '' : ` data-ga-public-paths="${paths}"`}>Fixture</body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
)

describe('controlled GA4 document verification', () => {
  it('reads only the fixed public pages and verifies the exact server-delivered registry', async () => {
    const request = vi.fn<typeof fetch>(async url => response(String(url).replace(/\/$/, ''), marker))
    expect(await verifyGaPageviewDocuments({ fetch: request })).toMatchObject({
      controlledDocumentsVerified: true, browserExecuted: false, runtimeVerified: false, providerWritten: false,
      checks: [
        { surface: 'homepage', status: 'controlled-document-matched' },
        { surface: 'study-guide', status: 'controlled-document-matched' },
      ],
    })
    expect(request.mock.calls.map(([url, options]) => [url, options?.redirect])).toEqual([
      [origin + '/', 'manual'], [origin + '/guides/website-online-but-not-working', 'manual'],
    ])
  })

  it('distinguishes an unmarked document, incorrect canonical and unavailable response', async () => {
    for (const [result, status] of [
      [() => response(origin), 'controlled-marker-missing'],
      [() => response(origin + '/other', marker), 'canonical-mismatch'],
      [() => response(origin, marker, 302), 'document-unavailable'],
    ] as const) {
      const report = await verifyGaPageviewDocuments({ fetch: vi.fn(async url =>
        String(url) === origin + '/' ? result() : response(String(url), marker)) })
      expect(report).toMatchObject({ controlledDocumentsVerified: false, checks: [{ status }, { status: 'controlled-document-matched' }] })
    }
  })

  it('rejects missing, repeated, and private path labels without reflecting them', async () => {
    for (const invalid of [marker + ' /sites/fixture-secret', marker + ' /', marker.replace(' /new', '')]) {
      const report = await verifyGaPageviewDocuments({ fetch: vi.fn(async url => response(String(url), invalid)) })
      expect(report.checks.every(check => check.status === 'path-registry-mismatch')).toBe(true)
      expect(JSON.stringify(report)).not.toContain('fixture-secret')
    }
  })

  it('refuses unrecognized origins before fetching', async () => {
    const request = vi.fn()
    await expect(verifyGaPageviewDocuments({ origin: 'https://outside.example', fetch: request })).rejects.toThrow('Invalid discovery origin')
    expect(request).not.toHaveBeenCalled()
  })
})
