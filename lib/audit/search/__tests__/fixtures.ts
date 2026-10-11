import type { PublicDocument, SearchPageEvidence } from '../contracts'
export const PAGE = 'https://example.com/'
export function document(body: string | null, overrides: Partial<PublicDocument> = {}): PublicDocument {
  return { url: PAGE, finalUrl: PAGE, status: 200, headers: { 'content-type': 'text/html' }, body,
    complete: body != null, reason: null, collectedAt: '2026-10-11T00:00:00.000Z', redirects: [], ...overrides }
}
export function evidence(body = '<html><head><title>Example website</title></head><body><h1>Example website</h1></body></html>',
  overrides: Partial<SearchPageEvidence> = {}): SearchPageEvidence {
  return { auditId: 'audit-1', pageUrl: PAGE, collectedAt: '2026-10-11T00:00:00.000Z', public: true,
    original: document(body), rendered: document(body),
    robots: document('User-agent: *\nAllow: /', { url: PAGE + 'robots.txt', finalUrl: PAGE + 'robots.txt', headers: { 'content-type': 'text/plain' } }),
    sitemaps: [document(null, { url: PAGE + 'sitemap.xml', finalUrl: PAGE + 'sitemap.xml', status: 404, complete: true })],
    sitemapUrls: [], sitemapsComplete: true, declaredSitemaps: [], canonicalTargets: [], ...overrides }
}
export function markup(value: unknown, body = '<h1>Example website</h1>') {
  return `<html><head><title>Example website</title><script type="application/ld+json">${JSON.stringify(value)}</script></head><body>${body}</body></html>`
}
