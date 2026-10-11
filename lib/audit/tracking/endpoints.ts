import type { TrackingProvider, TrackingRequest } from './contracts'

type Endpoint = Pick<TrackingRequest, 'provider' | 'role' | 'hostname' | 'endpoint'>
type Rule = { provider: TrackingProvider; role: Endpoint['role']; host?: string; path: RegExp; endpoint: string; firstParty?: true }

// A shared, explicit endpoint inventory. Matching a vendor host alone does not
// identify an event. Canonical paths omit project keys and visitor identifiers.
const RULES: Rule[] = [
  { provider: 'google-analytics', role: 'library', host: 'googletagmanager.com', path: /^\/gtag\/js\/?$/, endpoint: '/gtag/js' },
  { provider: 'google-tag-manager', role: 'library', host: 'googletagmanager.com', path: /^\/gtm\.js$/, endpoint: '/gtm.js' },
  { provider: 'google-analytics', role: 'library', host: 'google-analytics.com', path: /^\/(?:analytics|ga)\.js$/, endpoint: '/analytics.js' },
  { provider: 'google-analytics', role: 'event', host: 'google-analytics.com', path: /^\/(?:g\/|j\/|mp\/)?collect\/?$/, endpoint: '/collect' },
  { provider: 'posthog', role: 'library', host: 'posthog.com', path: /^\/static\/array(?:\.full)?\.js$/, endpoint: '/static/library.js' },
  { provider: 'posthog', role: 'event', host: 'posthog.com', path: /^\/(?:i\/v0\/)?(?:e|s|batch|capture)\/?$/, endpoint: '/capture' },
  { provider: 'plausible', role: 'library', host: 'plausible.io', path: /^\/js\/[^/]+\.js$/, endpoint: '/js/script.js' },
  { provider: 'plausible', role: 'event', host: 'plausible.io', path: /^\/api\/event\/?$/, endpoint: '/api/event' },
  { provider: 'segment', role: 'library', host: 'cdn.segment.com', path: /^\/analytics\.js\/v1\/[^/]+\/analytics(?:\.min)?\.js$/, endpoint: '/analytics.js/v1/[project]/analytics.js' },
  { provider: 'segment', role: 'event', host: 'api.segment.io', path: /^\/v1\/(?:t|p|i|g|a|b|track|page|identify|group|alias|batch)\/?$/, endpoint: '/v1/event' },
  { provider: 'vercel', role: 'library', firstParty: true, path: /^\/_vercel\/insights\/script\.js$/, endpoint: '/_vercel/insights/script.js' },
  { provider: 'vercel', role: 'event', firstParty: true, path: /^\/_vercel\/insights\/(?:view|event)\/?$/, endpoint: '/_vercel/insights/event' },
  { provider: 'cloudflare', role: 'library', host: 'static.cloudflareinsights.com', path: /^\/beacon\.min\.js(?:\/[^/]+)?$/, endpoint: '/beacon.min.js' },
  { provider: 'cloudflare', role: 'event', host: 'cloudflareinsights.com', path: /^\/cdn-cgi\/rum\/?$/, endpoint: '/cdn-cgi/rum' },
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
      if (rule.role === 'event' && ['document', 'script', 'stylesheet', 'font'].includes(resourceType)) continue
      return { provider: rule.provider, role: rule.role, hostname: host, endpoint: rule.provider === 'segment' && rule.role === 'library' || rule.provider === 'cloudflare' && rule.role === 'library' ? rule.endpoint : parsed.pathname }
    }
  } catch { /* Invalid URLs are not tracking evidence. */ }
  return null
}
