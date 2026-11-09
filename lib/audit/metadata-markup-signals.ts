/** Existing markup detection vocabulary, shared with bounded DOM collection. */
const ANALYTICS_MARKERS = [
  'google-analytics',
  'googletagmanager',
  'gtag(',
  'gtag/js',
  'segment.com',
  'segment.io',
  'cdn.segment',
  'mixpanel',
  'plausible',
  'fathom',
  'amplitude',
  'hotjar',
  'hubspot',
  'fbq(',
  'snaptr.com',
  'static.ads-twitter.com',
  'bat.bing.com',
  'matomo',
  'heap-analytics',
  'fullstory.com',
  'cdn.heapanalytics.com',
  'posthog',
  '/_vercel/insights',
  'vercel-scripts.com',
  'vercel-analytics',
  'clarity.ms',
  'cloudflareinsights.com',
  'static.cloudflareinsights',
  'pendo',
  'datadog',
  'newrelic',
  'nr-data.net',
  'june.so',
  'umami',
  'rudderstack',
  'rudderlabs',
  'statsig',
  'growthbook',
] as const
// Keep the existing conservative distinction between cookie-based and other tools.
const COOKIE_ANALYTICS_MARKERS = [
  'google-analytics',
  'googletagmanager',
  'gtag(',
  'gtag/js',
  'segment.com',
  'segment.io',
  'cdn.segment',
  'mixpanel',
  'amplitude',
  'hotjar',
  'hubspot',
  'fbq(',
  'snaptr.com',
  'static.ads-twitter.com',
  'bat.bing.com',
  'matomo',
  'heap-analytics',
  'fullstory.com',
  'cdn.heapanalytics.com',
  'clarity.ms',
  'pendo',
  'datadog',
  'newrelic',
  'nr-data.net',
  'june.so',
  'rudderstack',
  'rudderlabs',
  'statsig',
  'growthbook',
] as const
const CONSENT_MARKERS = ['cookie', 'cookiebot', 'cookieconsent', 'onetrust', 'cookie banner'] as const

export const ANALYTICS_INLINE_DECLARATION = 'script:not([type="application/ld+json" i])'
export const ANALYTICS_RESOURCE_DECLARATION = 'script[src],iframe[src],img[src],link[rel~="preload" i][as="script" i],link[rel~="modulepreload" i]'
export const ANALYTICS_CONFIGURATION_ATTRIBUTES = ['data-analytics', 'data-tracking', 'data-analytics-provider', 'data-tracking-provider'] as const

export const METADATA_MARKUP_TOKENS = [...new Set([...ANALYTICS_MARKERS, ...CONSENT_MARKERS])]

export function analyticsMarkupSignals(html: string) {
  const lower = html.toLowerCase()
  const hasAnalytics = ANALYTICS_MARKERS.some(marker => lower.includes(marker))
  return { hasAnalytics, hasCookieBasedAnalytics: hasAnalytics && COOKIE_ANALYTICS_MARKERS.some(marker => lower.includes(marker)) }
}
