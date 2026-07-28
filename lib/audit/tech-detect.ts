/**
 * Evidence-backed technology detection.
 *
 * Rules inspect already-captured HTML, safe document headers, a bounded
 * resource inventory, and a small allowlist of runtime markers. No detector
 * rule performs network I/O and no raw request data is persisted.
 */
import type { TechnologyResourceRecord } from './browser/network-monitor'
import type { GraphTechKind } from '@/lib/graph/types'

export const TECHNOLOGY_DETECTOR_VERSION = '2026.07.23.1'
export const TECHNOLOGY_MIN_CONFIDENCE = 0.8

export type TechnologyEvidenceType = 'html' | 'meta' | 'header' | 'resource' | 'runtime'

export interface TechnologyEvidence {
  type: TechnologyEvidenceType
  label: string
}

export interface DetectedTech {
  name: string
  kind: GraphTechKind
  confidence: number
  evidence: TechnologyEvidence[]
}

type SignalSource = 'html' | 'headers' | 'resources' | 'runtime'

interface TechnologySignal {
  source: SignalSource
  pattern: RegExp
  weight: number
  evidence: TechnologyEvidence
}

interface TechnologyRule {
  name: string
  kind: GraphTechKind
  signals: TechnologySignal[]
}

const SAFE_HEADER_NAMES = new Set([
  'server',
  'x-powered-by',
  'via',
  'cf-ray',
  'x-vercel-id',
  'x-vercel-cache',
  'x-nf-request-id',
  'x-render-origin-server',
  'x-railway-request-id',
  'x-amz-cf-id',
  'x-amz-request-id',
  'fly-request-id',
  'x-served-by',
  'surrogate-key',
])

function signal(
  source: SignalSource,
  pattern: RegExp,
  weight: number,
  type: TechnologyEvidenceType,
  label: string
): TechnologySignal {
  return { source, pattern, weight, evidence: { type, label } }
}

const strongHtml = (
  pattern: RegExp,
  label: string,
  type: TechnologyEvidenceType = 'html'
) => signal('html', pattern, 0.2, type, label)
const mediumHtml = (pattern: RegExp, label: string) =>
  signal('html', pattern, 0.1, 'html', label)
const strongResource = (pattern: RegExp, label: string) =>
  signal('resources', pattern, 0.2, 'resource', label)
const mediumResource = (pattern: RegExp, label: string) =>
  signal('resources', pattern, 0.1, 'resource', label)
const strongHeader = (pattern: RegExp, label: string) =>
  signal('headers', pattern, 0.2, 'header', label)
const runtime = (pattern: RegExp, label: string) =>
  signal('runtime', pattern, 0.2, 'runtime', label)

const RULES: TechnologyRule[] = [
  {
    name: 'Next.js',
    kind: 'framework',
    signals: [
      strongHtml(/(?:\/_next\/|id=["']__next["']|__next_data__)/i, 'Next.js page markers'),
      strongResource(/\/_next\/(?:static|image)\//i, 'Next.js assets under /_next/'),
      runtime(/__NEXT_DATA__/i, 'Next.js runtime marker'),
    ],
  },
  {
    name: 'React',
    kind: 'framework',
    signals: [
      strongHtml(/(?:data-reactroot|data-reactid|react\.production\.min\.js)/i, 'React DOM marker'),
      strongResource(/(?:^|\/)react(?:-dom)?(?:\.production)?(?:\.min)?\.js$/i, 'React runtime asset'),
    ],
  },
  {
    name: 'Vue',
    kind: 'framework',
    signals: [
      strongHtml(/(?:data-v-app|data-v-[a-f0-9]{6,}|vue\.runtime(?:\.global)?)/i, 'Vue runtime marker'),
      strongResource(/(?:^|\/)vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js$/i, 'Vue runtime asset'),
    ],
  },
  {
    name: 'Nuxt',
    kind: 'framework',
    signals: [
      strongHtml(/(?:id=["']__nuxt["']|__nuxt__|\/_nuxt\/)/i, 'Nuxt page markers'),
      strongResource(/\/_nuxt\//i, 'Nuxt assets under /_nuxt/'),
      runtime(/__NUXT__/i, 'Nuxt runtime marker'),
    ],
  },
  {
    name: 'Angular',
    kind: 'framework',
    signals: [
      strongHtml(/(?:\sng-version=["'][^"']+|<app-root(?:\s|>))/i, 'Angular root marker'),
      mediumResource(/\/(?:main|polyfills)\.[a-f0-9]{8,}\.js$/i, 'Angular-style compiled asset'),
      mediumHtml(/ng-server-context=["']/i, 'Angular server context'),
    ],
  },
  {
    name: 'SvelteKit',
    kind: 'framework',
    signals: [
      strongResource(/\/_app\/immutable\//i, 'SvelteKit immutable assets'),
      strongHtml(/data-sveltekit-(?:preload-data|reload|noscroll|keepfocus)/i, 'SvelteKit navigation marker'),
    ],
  },
  {
    name: 'Svelte',
    kind: 'framework',
    signals: [
      strongHtml(/class=["'][^"']*\bsvelte-[a-z0-9]+\b/i, 'Svelte scoped class'),
      strongResource(/\/svelte(?:\.min)?\.js$/i, 'Svelte runtime asset'),
    ],
  },
  {
    name: 'Astro',
    kind: 'framework',
    signals: [
      strongHtml(/<(?:astro-island|astro-slot)(?:\s|>)/i, 'Astro island marker'),
      strongResource(/\/_astro\//i, 'Astro assets under /_astro/'),
    ],
  },
  {
    name: 'Gatsby',
    kind: 'framework',
    signals: [
      strongHtml(/id=["']___gatsby["']/i, 'Gatsby root marker'),
      strongResource(/\/(?:page-data|component---).*(?:\.json|\.js)$/i, 'Gatsby page data asset'),
    ],
  },
  {
    name: 'Remix',
    kind: 'framework',
    signals: [
      strongHtml(/(?:__remixContext|__remixManifest|\/build\/_assets\/)/i, 'Remix page marker'),
      runtime(/__remixContext/i, 'Remix runtime marker'),
    ],
  },
  {
    name: 'Lovable',
    kind: 'builder',
    signals: [
      strongResource(/(?:^|\.)cdn\.gpteng\.co\//i, 'Lovable deployment asset'),
      strongHtml(/data-lov-id=["'][^"']+["']/i, 'Lovable element marker'),
    ],
  },
  {
    name: 'Bolt',
    kind: 'builder',
    signals: [
      mediumHtml(/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*bolt(?:\.new)?/i, 'Bolt generator metadata'),
      mediumResource(/(?:^|\.)stackblitz\.com\/.*bolt/i, 'Bolt StackBlitz asset'),
    ],
  },
  {
    name: 'v0',
    kind: 'builder',
    signals: [
      mediumHtml(/data-v0-(?:id|component)=["']/i, 'v0 component marker'),
      mediumResource(/(?:^|\.)v0\.(?:app|dev)\//i, 'v0 deployment asset'),
    ],
  },
  {
    name: 'Replit',
    kind: 'builder',
    signals: [
      strongResource(/(?:^|\.)(?:replit\.app|repl\.co)\//i, 'Replit deployment host'),
      strongHeader(/(?:^|\s)(?:x-powered-by\s+replit|server\s+replit)/i, 'Replit response header'),
    ],
  },
  {
    name: 'Framer',
    kind: 'builder',
    signals: [
      strongResource(/(?:^|\.)framerusercontent\.com\//i, 'Framer hosted asset'),
      strongHtml(/data-framer-(?:name|component-type)=["']/i, 'Framer component marker'),
    ],
  },
  {
    name: 'Webflow',
    kind: 'builder',
    signals: [
      strongHtml(/<html[^>]+data-wf-(?:page|site)=["']/i, 'Webflow site metadata'),
      strongResource(/(?:^|\.)website-files\.com\//i, 'Webflow hosted asset'),
    ],
  },
  {
    name: 'WordPress',
    kind: 'cms',
    signals: [
      strongResource(/\/wp-(?:content|includes)\//i, 'WordPress asset path'),
      strongHtml(/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*wordpress/i, 'WordPress generator metadata', 'meta'),
    ],
  },
  {
    name: 'Wix',
    kind: 'cms',
    signals: [
      strongResource(/(?:^|\.)(?:wixstatic\.com|parastorage\.com)\//i, 'Wix hosted asset'),
      strongHtml(/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*wix/i, 'Wix generator metadata', 'meta'),
    ],
  },
  {
    name: 'Squarespace',
    kind: 'cms',
    signals: [
      strongResource(/(?:^|\.)squarespace-cdn\.com\//i, 'Squarespace hosted asset'),
      strongHtml(/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*squarespace/i, 'Squarespace generator metadata', 'meta'),
    ],
  },
  {
    name: 'Ghost',
    kind: 'cms',
    signals: [
      strongHtml(/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*ghost/i, 'Ghost generator metadata', 'meta'),
      strongResource(/\/ghost\/(?:api|assets)\//i, 'Ghost asset path'),
    ],
  },
  {
    name: 'Contentful',
    kind: 'cms',
    signals: [strongResource(/(?:^|\.)ctfassets\.net\//i, 'Contentful hosted asset')],
  },
  {
    name: 'Sanity',
    kind: 'cms',
    signals: [
      strongResource(/(?:^|\.)cdn\.sanity\.io\//i, 'Sanity hosted asset'),
      strongResource(/(?:^|\.)api\.sanity\.io\//i, 'Sanity content API'),
    ],
  },
  {
    name: 'Shopify',
    kind: 'commerce',
    signals: [
      strongResource(/(?:^|\.)cdn\.shopify\.com\//i, 'Shopify hosted asset'),
      runtime(/Shopify/i, 'Shopify runtime marker'),
      strongHtml(/(?:shopify-section|myshopify\.com)/i, 'Shopify storefront marker'),
    ],
  },
  {
    name: 'Vercel',
    kind: 'hosting',
    signals: [
      strongHeader(/(?:^|\s)x-vercel-(?:id|cache)\s+/i, 'Vercel response header'),
      strongResource(/(?:^|\.)vercel-insights\.com\//i, 'Vercel Insights resource'),
    ],
  },
  {
    name: 'Netlify',
    kind: 'hosting',
    signals: [strongHeader(/(?:^|\s)x-nf-request-id\s+/i, 'Netlify response header')],
  },
  {
    name: 'Cloudflare',
    kind: 'hosting',
    signals: [
      strongHeader(/(?:^|\s)cf-ray\s+/i, 'Cloudflare response header'),
      strongResource(/(?:^|\.)cloudflareinsights\.com\//i, 'Cloudflare Insights resource'),
    ],
  },
  {
    name: 'AWS Amplify',
    kind: 'hosting',
    signals: [
      strongResource(/(?:^|\.)amplifyapp\.com\//i, 'AWS Amplify deployment host'),
      mediumHeader(/(?:^|\s)x-amz-cf-id\s+/i, 'AWS edge response header'),
      mediumHtml(/aws-amplify/i, 'AWS Amplify runtime marker'),
    ],
  },
  {
    name: 'Firebase Hosting',
    kind: 'hosting',
    signals: [
      strongResource(/(?:^|\.)firebaseapp\.com\//i, 'Firebase deployment host'),
      strongResource(/\/__\/firebase\/init\.js$/i, 'Firebase Hosting initialization'),
    ],
  },
  {
    name: 'Render',
    kind: 'hosting',
    signals: [strongHeader(/(?:^|\s)x-render-origin-server\s+/i, 'Render response header')],
  },
  {
    name: 'Railway',
    kind: 'hosting',
    signals: [strongHeader(/(?:^|\s)x-railway-request-id\s+/i, 'Railway response header')],
  },
  {
    name: 'GitHub Pages',
    kind: 'hosting',
    signals: [strongResource(/(?:^|\.)github\.io\//i, 'GitHub Pages host')],
  },
  {
    name: 'Google Tag Manager',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)googletagmanager\.com\/gtm\.js/i, 'Google Tag Manager script')],
  },
  {
    name: 'Google Analytics',
    kind: 'analytics',
    signals: [
      strongResource(/(?:^|\.)google-analytics\.com\//i, 'Google Analytics request'),
      strongResource(/(?:^|\.)googletagmanager\.com\/gtag\/js/i, 'Google Analytics gtag script'),
    ],
  },
  {
    name: 'Segment',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)cdn\.segment\.(?:com|io)\/analytics/i, 'Segment analytics script')],
  },
  {
    name: 'Mixpanel',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)mixpanel\.com\//i, 'Mixpanel request')],
  },
  {
    name: 'PostHog',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)(?:posthog\.com|i\.posthog\.com)\//i, 'PostHog request')],
  },
  {
    name: 'Plausible',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)plausible\.io\//i, 'Plausible analytics script')],
  },
  {
    name: 'Hotjar',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)hotjar\.com\//i, 'Hotjar request')],
  },
  {
    name: 'FullStory',
    kind: 'analytics',
    signals: [strongResource(/(?:^|\.)fullstory\.com\//i, 'FullStory request')],
  },
  {
    name: 'Sentry',
    kind: 'monitoring',
    signals: [
      strongResource(/(?:^|\.)sentry\.io\//i, 'Sentry telemetry request'),
      runtime(/Sentry/i, 'Sentry runtime marker'),
    ],
  },
  {
    name: 'Stripe',
    kind: 'payments',
    signals: [strongResource(/(?:^|\.)js\.stripe\.com\//i, 'Stripe payment script')],
  },
  {
    name: 'Paddle',
    kind: 'payments',
    signals: [strongResource(/(?:^|\.)paddle\.com\//i, 'Paddle payment resource')],
  },
  {
    name: 'Lemon Squeezy',
    kind: 'payments',
    signals: [strongResource(/(?:^|\.)lemonsqueezy\.com\//i, 'Lemon Squeezy resource')],
  },
  {
    name: 'Intercom',
    kind: 'support',
    signals: [
      strongResource(/(?:^|\.)intercomcdn\.com\//i, 'Intercom support script'),
      runtime(/Intercom/i, 'Intercom runtime marker'),
    ],
  },
  {
    name: 'Crisp',
    kind: 'support',
    signals: [strongResource(/(?:^|\.)client\.crisp\.chat\//i, 'Crisp support script')],
  },
  {
    name: 'Solid.js',
    kind: 'framework',
    signals: [
      strongHtml(/_\$HYDRATION_/i, 'Solid.js hydration marker'),
      mediumHtml(/solid-js/i, 'Solid.js reference'),
    ],
  },
  {
    name: 'Qwik',
    kind: 'framework',
    signals: [
      strongHtml(/q:base\b/i, 'Qwik base marker'),
      runtime(/__QWIK__/i, 'Qwik runtime marker'),
    ],
  },
  {
    name: 'Fresh',
    kind: 'framework',
    signals: [
      strongHtml(/class=["'][^"']*\bfresh-[a-z0-9]+\b/i, 'Fresh scoped class'),
      strongResource(/\/frsh\//i, 'Fresh script URL'),
    ],
  },
  {
    name: 'Vite',
    kind: 'framework',
    signals: [
      strongResource(/\/@vite\/client/i, 'Vite dev client'),
      runtime(/__vite_hmr/i, 'Vite HMR marker'),
    ],
  },
  {
    name: 'esbuild',
    kind: 'framework',
    signals: [
      strongHtml(/\/\/# sourceMappingURL=data:application\/json;base64,/i, 'esbuild source map comment'),
    ],
  },
  {
    name: 'Turbopack',
    kind: 'framework',
    signals: [
      strongHtml(/\[turbopack\]/i, 'Turbopack comment'),
    ],
  },
  {
    name: 'Webpack',
    kind: 'framework',
    signals: [
      runtime(/webpackJsonp/i, 'Webpack runtime marker'),
      runtime(/__webpack_require__/i, 'Webpack require marker'),
      mediumResource(/webpack[-.]/i, 'Webpack chunk URL'),
    ],
  },
  {
    name: 'Parcel',
    kind: 'framework',
    signals: [
      strongHtml(/parcelRequire/i, 'Parcel require marker'),
    ],
  },
  {
    name: 'Fly.io',
    kind: 'hosting',
    signals: [
      strongHeader(/(?:^|\s)fly-[a-z]/i, 'Fly.io response header'),
    ],
  },
  {
    name: 'Deno Deploy',
    kind: 'hosting',
    signals: [
      strongHeader(/(?:^|\s)server\s+deno\/deploy/i, 'Deno Deploy server header'),
      mediumResource(/(?:^|\.)deno\.land\//i, 'Deno Deploy function URL'),
    ],
  },
  {
    name: 'Fastly',
    kind: 'hosting',
    signals: [
      strongHeader(/(?:^|\s)x-served-by\s+cache-[^\s]*fastly/i, 'Fastly CDN header'),
      mediumHeader(/(?:^|\s)surrogate-key\s+/i, 'Fastly surrogate key'),
    ],
  },
  {
    name: 'Bunny CDN',
    kind: 'hosting',
    signals: [
      strongResource(/(?:^|\.)b-cdn\.net\//i, 'Bunny CDN resource'),
      strongHeader(/(?:^|\s)server\s+bunnycdn/i, 'Bunny CDN server header'),
    ],
  },
  {
    name: 'KeyCDN',
    kind: 'hosting',
    signals: [
      strongResource(/(?:^|\.)kxcdn\.com\//i, 'KeyCDN resource'),
    ],
  },
  {
    name: 'StackPath',
    kind: 'hosting',
    signals: [
      strongResource(/(?:^|\.)stackpathdns\.com\//i, 'StackPath resource'),
    ],
  },
  {
    name: 'Amplitude',
    kind: 'analytics',
    signals: [
      strongResource(/(?:^|\.)amplitude\.com\//i, 'Amplitude request'),
      runtime(/amplitude\.getInstance/i, 'Amplitude SDK marker'),
    ],
  },
  {
    name: 'Pendo',
    kind: 'analytics',
    signals: [
      strongResource(/pendo-/i, 'Pendo resource'),
      runtime(/pendo\.initialize/i, 'Pendo SDK marker'),
    ],
  },
  {
    name: 'Heap',
    kind: 'analytics',
    signals: [
      strongResource(/(?:^|\.)heapanalytics\.com\//i, 'Heap request'),
      runtime(/heap\.(?:load|identify)/i, 'Heap SDK marker'),
    ],
  },
  {
    name: 'Lucky Orange',
    kind: 'analytics',
    signals: [
      strongResource(/(?:^|\.)luckorange\.com\//i, 'Lucky Orange request'),
    ],
  },
  {
    name: 'Crazy Egg',
    kind: 'analytics',
    signals: [
      strongResource(/(?:^|\.)crazyegg\.com\//i, 'Crazy Egg request'),
      runtime(/CE2/i, 'Crazy Egg runtime marker'),
    ],
  },
  {
    name: 'Zendesk Chat',
    kind: 'support',
    signals: [
      strongResource(/zendesk\.com\/embeddable/i, 'Zendesk Chat resource'),
      runtime(/zE\(|webWidget/i, 'Zendesk Chat runtime marker'),
    ],
  },
  {
    name: 'Drift',
    kind: 'support',
    signals: [
      strongResource(/(?:^|\.)drift\.com\//i, 'Drift resource'),
      runtime(/drift\.load|driftt/i, 'Drift runtime marker'),
    ],
  },
  {
    name: 'Tidio',
    kind: 'support',
    signals: [
      strongResource(/(?:^|\.)tidiochat\.com\//i, 'Tidio resource'),
      runtime(/tidioChatCode/i, 'Tidio runtime marker'),
    ],
  },
  {
    name: 'LiveChat',
    kind: 'support',
    signals: [
      strongResource(/(?:^|\.)livechatinc\.com\//i, 'LiveChat resource'),
    ],
  },
  {
    name: 'Freshdesk',
    kind: 'support',
    signals: [
      strongResource(/(?:^|\.)freshchat\.com\//i, 'Freshdesk resource'),
      runtime(/fcWidget/i, 'Freshdesk runtime marker'),
    ],
  },
  {
    name: 'Typeform',
    kind: 'form',
    signals: [
      strongResource(/(?:^|\.)typeform\.com\//i, 'Typeform resource'),
      runtime(/typeformEmbed/i, 'Typeform embed marker'),
    ],
  },
  {
    name: 'JotForm',
    kind: 'form',
    signals: [
      strongResource(/(?:^|\.)jotform\.com\//i, 'JotForm resource'),
      runtime(/jotform\./i, 'JotForm runtime marker'),
    ],
  },
  {
    name: 'reCAPTCHA',
    kind: 'security',
    signals: [
      strongResource(/recaptcha/i, 'reCAPTCHA resource'),
      runtime(/grecaptcha/i, 'reCAPTCHA runtime marker'),
    ],
  },
  {
    name: 'hCaptcha',
    kind: 'security',
    signals: [
      strongResource(/(?:^|\.)hcaptcha\.com\//i, 'hCaptcha resource'),
      runtime(/hcaptcha\.render/i, 'hCaptcha runtime marker'),
    ],
  },
  {
    name: 'Turnstile',
    kind: 'security',
    signals: [
      strongResource(/challenges\.cloudflare\.com\/turnstile/i, 'Turnstile resource'),
      runtime(/turnstile\.render/i, 'Turnstile runtime marker'),
    ],
  },
]

/**
 * Resolve the current registry category without exposing fingerprint rules.
 * Historical imports use this to reject names that the evidence-backed
 * detector no longer supports and to normalize legacy category drift.
 */
export function registeredTechnologyKind(name: string): GraphTechKind | null {
  return RULES.find((rule) => rule.name === name)?.kind ?? null
}

function mediumHeader(pattern: RegExp, label: string) {
  return signal('headers', pattern, 0.1, 'header', label)
}

function sanitizeHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([name]) => SAFE_HEADER_NAMES.has(name.toLowerCase()))
    .map(([name, value]) => `${name.toLowerCase()} ${String(value).slice(0, 160)}`)
    .join('\n')
}

function resourceText(resources: TechnologyResourceRecord[]): string {
  return resources
    .slice(0, 300)
    .map((resource) => `${resource.hostname}${resource.pathname}`)
    .join('\n')
}

function uniqueEvidence(items: TechnologyEvidence[]): TechnologyEvidence[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.type}:${item.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 4)
}

/**
 * Detect technologies from capture evidence. The legacy two-argument call
 * remains source-compatible for offline fixtures, while production supplies
 * resources and runtime markers from the same Playwright navigation.
 */
export function detectTechnologies(
  html: string,
  responseHeaders: Record<string, string> = {},
  resources: TechnologyResourceRecord[] = [],
  runtimeMarkers: string[] = []
): DetectedTech[] {
  const sources: Record<SignalSource, string> = {
    html: html.slice(0, 2_000_000),
    headers: sanitizeHeaders(responseHeaders),
    resources: resourceText(resources),
    runtime: runtimeMarkers.slice(0, 32).join('\n'),
  }

  const detections: DetectedTech[] = []

  for (const rule of RULES) {
    let weight = 0
    const evidence: TechnologyEvidence[] = []
    for (const candidate of rule.signals) {
      candidate.pattern.lastIndex = 0
      if (!candidate.pattern.test(sources[candidate.source])) continue
      weight += candidate.weight
      evidence.push(candidate.evidence)
    }

    const confidence = Math.min(0.99, 0.62 + weight)
    if (confidence < TECHNOLOGY_MIN_CONFIDENCE) continue
    detections.push({
      name: rule.name,
      kind: rule.kind,
      confidence: Number(confidence.toFixed(2)),
      evidence: uniqueEvidence(evidence),
    })
  }

  return detections.sort((a, b) =>
    b.confidence - a.confidence || a.name.localeCompare(b.name)
  )
}

/**
 * Infer industry from the URL hostname and page text.
 * Returns a best-guess industry string or null.
 */
export function inferIndustry(hostname: string, pageText: string): string | null {
  const h = hostname.toLowerCase()
  const text = (h + ' ' + pageText).toLowerCase()

  const rules: Array<{ pattern: RegExp; industry: string }> = [
    { pattern: /\b(shop|store|buy|cart|product|commerce|checkout|ecommerce)\b/, industry: 'E-commerce' },
    { pattern: /\b(saas|app\.|api\.|dev\.|tool|platform|dashboard|software)\b/, industry: 'SaaS' },
    { pattern: /\b(agency|studio|design|consulting|services|creative)\b/, industry: 'Agency' },
    { pattern: /\b(learn|course|education|academy|school|training|university)\b/, industry: 'Education' },
    { pattern: /\b(health|medical|doctor|clinic|wellness|fitness|hospital)\b/, industry: 'Health' },
    { pattern: /\b(finance|bank|invest|crypto|fintech|payment|insurance)\b/, industry: 'Finance' },
    { pattern: /\b(news|media|magazine|journal|podcast|blog)\b/, industry: 'Media' },
    { pattern: /\b(portfolio|personal|resume|cv)\b/, industry: 'Portfolio' },
  ]

  for (const { pattern, industry } of rules) {
    if (pattern.test(text)) return industry
  }
  return null
}
