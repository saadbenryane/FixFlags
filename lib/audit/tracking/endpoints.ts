import type { TrackingProvider, TrackingRequest } from './contracts'
import type { Request } from 'playwright'

type Endpoint = Pick<TrackingRequest, 'provider' | 'role' | 'hostname' | 'endpoint'>
type Rule = { provider: TrackingProvider; role: Endpoint['role']; host?: string; path: RegExp; redactedPath?: string; firstParty?: true }
export const PLAUSIBLE_LIBRARY_ENDPOINT = '/js/script.js'

/** Older browser snapshots may still carry a site's personalized filename. */
export function trackingEndpointLabel(request: Pick<Endpoint, 'provider' | 'role' | 'endpoint'>) {
  return request.provider === 'plausible' && request.role === 'library' ? PLAUSIBLE_LIBRARY_ENDPOINT : request.endpoint
}

// A shared, explicit endpoint inventory. Matching a vendor host alone does not
// identify an event. Canonical paths omit project keys and visitor identifiers.
const RULES: Rule[] = [
  { provider: 'google-analytics', role: 'library', host: 'googletagmanager.com', path: /^\/gtag\/js\/?$/ },
  { provider: 'google-tag-manager', role: 'library', host: 'googletagmanager.com', path: /^\/gtm\.js$/ },
  { provider: 'google-analytics', role: 'library', host: 'google-analytics.com', path: /^\/(?:analytics|ga)\.js$/ },
  { provider: 'google-analytics', role: 'event', host: 'google-analytics.com', path: /^\/(?:g\/|j\/|mp\/)?collect\/?$/ },
  { provider: 'posthog', role: 'library', host: 'posthog.com', path: /^\/static\/array(?:\.full)?\.js$/ },
  { provider: 'posthog', role: 'event', host: 'posthog.com', path: /^\/(?:i\/v0\/)?(?:e|s|batch|capture)\/?$/ },
  { provider: 'plausible', role: 'library', host: 'plausible.io', path: /^\/js\/[^/]+\.js$/, redactedPath: PLAUSIBLE_LIBRARY_ENDPOINT },
  { provider: 'plausible', role: 'event', host: 'plausible.io', path: /^\/api\/event\/?$/ },
  { provider: 'segment', role: 'library', host: 'cdn.segment.com', path: /^\/analytics\.js\/v1\/[^/]+\/analytics(?:\.min)?\.js$/, redactedPath: '/analytics.js/v1/[project]/analytics.js' },
  { provider: 'segment', role: 'event', host: 'api.segment.io', path: /^\/v1\/(?:t|p|i|g|a|b|track|page|identify|group|alias|batch)\/?$/ },
  { provider: 'vercel', role: 'library', firstParty: true, path: /^\/_vercel\/insights\/script\.js$/ },
  { provider: 'vercel', role: 'event', firstParty: true, path: /^\/_vercel\/insights\/(?:view|event)\/?$/ },
  { provider: 'cloudflare', role: 'library', host: 'static.cloudflareinsights.com', path: /^\/beacon\.min\.js(?:\/[^/]+)?$/, redactedPath: '/beacon.min.js' },
  { provider: 'cloudflare', role: 'event', host: 'cloudflareinsights.com', path: /^\/cdn-cgi\/rum\/?$/ },
]

export function classifyTrackingEndpoint(url: string, resourceType: string, pageOrigin: string): Endpoint | null {
  try {
    const parsed = new URL(url), origin = new URL(pageOrigin)
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    for (const rule of RULES) {
      const host = parsed.hostname.toLowerCase()
      const matchesHost = rule.firstParty ? parsed.origin === origin.origin : host === rule.host || host.endsWith('.' + rule.host)
      if (!matchesHost || !rule.path.test(parsed.pathname)) continue
      if (rule.role === 'library' && resourceType !== 'script') continue
      // A recognized event route stays protected regardless of how the browser requests it.
      return { provider: rule.provider, role: rule.role, hostname: host, endpoint: rule.redactedPath ?? parsed.pathname }
    }
  } catch { /* Invalid URLs are not tracking evidence. */ }
  return null
}

const observedEndpoints = new WeakMap<Request, Endpoint>()

/** Retain the classification once observed so a later frame change cannot
 * disagree with an earlier guard for the same browser request. */
export function classifyBrowserTrackingRequest(request: Request, fallbackUrl: string): Endpoint | null {
  const observed = observedEndpoints.get(request)
  if (observed) return observed
  let documentUrl = fallbackUrl
  try { documentUrl = request.frame().url() || fallbackUrl } catch { /* The frame may not yet be available. */ }
  const url = request.url(), resourceType = request.resourceType()
  const endpoint = classifyTrackingEndpoint(url, resourceType, documentUrl) ??
    (documentUrl === fallbackUrl ? null : classifyTrackingEndpoint(url, resourceType, fallbackUrl))
  if (endpoint) observedEndpoints.set(request, endpoint)
  return endpoint
}
