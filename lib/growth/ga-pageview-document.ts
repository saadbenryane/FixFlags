import { load } from 'cheerio'
import { GUIDE_WITH_STUDY } from '@/lib/marketing/copy/destination-study'
import { discoveryOrigin, readDiscoveryBody } from './public-discovery'
import { FIXFLAGS_PUBLIC_GA_PAGES } from './public-ga-pages'
import { FIXFLAGS_HOST } from './reporting-targets'

const surfaces = [
  { surface: 'homepage', path: '/' },
  { surface: 'study-guide', path: `/guides/${GUIDE_WITH_STUDY}` },
] as const
const expectedPaths = new Set(FIXFLAGS_PUBLIC_GA_PAGES)

/** Check the server-delivered mode marker. This does not execute scripts. */
export async function verifyGaPageviewDocuments(input: { origin?: string; fetch?: typeof fetch } = {}) {
  const origin = discoveryOrigin(input.origin ?? `https://${FIXFLAGS_HOST}`)
  const request = input.fetch ?? fetch
  const checks = await Promise.all(surfaces.map(async ({ surface, path }) => {
    try {
      const url = origin + path
      const response = await request(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
        headers: { accept: 'text/html', 'user-agent': 'FixFlagsPageviewVerifier/1.0' },
      })
      const body = await readDiscoveryBody(response)
      if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) {
        return { surface, status: 'document-unavailable' } as const
      }
      const html = load(body)
      const canonical = html('head link[rel="canonical"]')
      const href = canonical.attr('href')
      if (canonical.length !== 1 || !href || !URL.canParse(href) || new URL(href).href !== url) {
        return { surface, status: 'canonical-mismatch' } as const
      }
      const marker = html('body').attr('data-ga-public-paths')
      if (marker === undefined) return { surface, status: 'controlled-marker-missing' } as const
      const labels = marker.split(' ')
      if (labels.length !== expectedPaths.size || new Set(labels).size !== labels.length ||
        labels.some(label => !expectedPaths.has(label))) return { surface, status: 'path-registry-mismatch' } as const
      return { surface, status: 'controlled-document-matched' } as const
    } catch {
      return { surface, status: 'document-unavailable' } as const
    }
  }))
  return {
    version: 1,
    observedAt: new Date().toISOString(),
    origin,
    checks,
    controlledDocumentsVerified: checks.every(check => check.status === 'controlled-document-matched'),
    browserExecuted: false,
    runtimeVerified: false,
    providerWritten: false,
  }
}
