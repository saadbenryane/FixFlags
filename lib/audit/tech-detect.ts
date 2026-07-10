/**
 * Technology detection engine.
 *
 * Inspects page HTML and HTTP response headers to identify frameworks,
 * builders, CMS platforms, hosting providers, and analytics tools.
 * Used by the audit pipeline to populate the knowledge graph's
 * SiteTechnology table, which feeds the /madewith public pages.
 *
 * All detection is pattern-based with confidence scores. Results below
 * MIN_CONFIDENCE (0.7) are filtered out to avoid noisy guesses.
 *
 * See docs/growth/architecture.md for how this feeds the knowledge loop.
 */
import type { GraphTechKind } from '@/lib/graph/types'

export interface DetectedTech {
  name: string
  kind: GraphTechKind
  confidence: number
}

/**
 * Minimum confidence score for a detection to be included in results.
 * Below this threshold, the signal is too weak to be useful.
 */
const MIN_CONFIDENCE = 0.7

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

interface TechPattern {
  name: string
  kind: GraphTechKind
  /** HTML patterns to match (lowercased). Any match triggers detection. */
  html?: RegExp[]
  /** Response header patterns (lowercased header values). */
  headers?: RegExp[]
  /** Meta generator content patterns. */
  generator?: RegExp[]
  /** Script src patterns. */
  scripts?: RegExp[]
  /** CSS class/id prefix patterns in the HTML. */
  classes?: RegExp[]
}

const PATTERNS: TechPattern[] = [
  // ── Frameworks ──────────────────────────────────────────────────────────
  {
    name: 'Next.js',
    kind: 'framework',
    html: [/_next\/static/, /__next/, /next\.config/],
    generator: [/next/i],
    scripts: [/\/_next\//],
  },
  {
    name: 'React',
    kind: 'framework',
    html: [/__react/, /data-reactroot/, /react\.production/i],
    scripts: [/react\.production/, /react\.development/],
    classes: [/\breact-/],
  },
  {
    name: 'Vue',
    kind: 'framework',
    html: [/__vue__/, /data-v-[a-f0-9]/, /vue\.runtime/i],
    scripts: [/vue\.runtime/, /vue\.min\.js/],
  },
  {
    name: 'Nuxt',
    kind: 'framework',
    html: [/__nuxt/, /_nuxt\//, /nuxt\.config/],
    scripts: [/_nuxt\//],
  },
  {
    name: 'Angular',
    kind: 'framework',
    html: [/ng-version/, /ng-app/, /angular/i],
    scripts: [/angular\.min\.js/, /polyfills\.js/],
    classes: [/ng-/],
  },
  {
    name: 'Svelte',
    kind: 'framework',
    html: [/__svelte/, /svelte-[a-z]/],
    scripts: [/_immutable\/chunks/],
  },
  {
    name: 'Gatsby',
    kind: 'framework',
    html: [/___gatsby/, /gatsby-/],
    scripts: [/gatsby/],
    classes: [/___gatsby/],
  },
  {
    name: 'Remix',
    kind: 'framework',
    html: [/__remix/, /remix-run/],
    scripts: [/__remix/],
  },
  {
    name: 'Hugo',
    kind: 'framework',
    generator: [/hugo/i],
  },
  {
    name: 'Jekyll',
    kind: 'framework',
    generator: [/jekyll/i],
  },

  // ── Builders ────────────────────────────────────────────────────────────
  {
    name: 'Lovable',
    kind: 'builder',
    html: [/lovable\.dev/, /gptengineer/, /lovable/i],
  },
  {
    name: 'Bolt',
    kind: 'builder',
    html: [/bolt\.new/, /stackblitz/],
  },
  {
    name: 'v0',
    kind: 'builder',
    html: [/v0\.dev/, /\bv0\(/],
  },
  {
    name: 'Cursor',
    kind: 'builder',
    html: [/cursor\.sh/, /cursor/i],
  },
  {
    name: 'Windsurf',
    kind: 'builder',
    html: [/windsurf\.ai/, /windsurf/i],
  },

  // ── CMS ─────────────────────────────────────────────────────────────────
  {
    name: 'WordPress',
    kind: 'cms',
    html: [/wp-content/, /wp-includes/, /wordpress/],
    generator: [/wordpress/i],
    scripts: [/wp-content/, /wp-includes/],
    classes: [/wp-/],
  },
  {
    name: 'Shopify',
    kind: 'cms',
    html: [/cdn\.shopify\.com/, /shopify\.section/, /shopify-/],
    scripts: [/cdn\.shopify\.com/],
  },
  {
    name: 'Webflow',
    kind: 'cms',
    html: [/webflow\.com/, /wf-cdn/, /wf-/],
    generator: [/webflow/i],
    classes: [/w-layout/, /w-[A-Z]/],
  },
  {
    name: 'Squarespace',
    kind: 'cms',
    html: [/sqsp/, /squarespace/],
    classes: [/sqs-/],
  },
  {
    name: 'Framer',
    kind: 'cms',
    html: [/framer\.com/, /framerusercontent/],
    scripts: [/framer\.com/],
  },
  {
    name: 'Wix',
    kind: 'cms',
    html: [/wix\.com/, /parastorage\.com/],
    classes: [/wix_/],
  },
  {
    name: 'Ghost',
    kind: 'cms',
    html: [/ghost\./, /ghost-/],
    generator: [/ghost/i],
  },
  {
    name: 'Contentful',
    kind: 'cms',
    html: [/contentful\.com/, /ctfassets\.net/],
    scripts: [/contentful/],
  },

  // ── Hosting ─────────────────────────────────────────────────────────────
  {
    name: 'Vercel',
    kind: 'hosting',
    headers: [/vercel/i],
    html: [/vercel\.app/, /vercel\.com/],
  },
  {
    name: 'Netlify',
    kind: 'hosting',
    headers: [/netlify/i],
    html: [/netlify\.app/, /\.netlify/],
  },
  {
    name: 'Cloudflare',
    kind: 'hosting',
    headers: [/cf-ray/, /cloudflare/i],
  },
  {
    name: 'AWS Amplify',
    kind: 'hosting',
    html: [/amplifyapp\.com/],
  },
  {
    name: 'GitHub Pages',
    kind: 'hosting',
    html: [/github\.io/],
    headers: [/github\.com/i],
  },

  // ── Analytics ───────────────────────────────────────────────────────────
  {
    name: 'Google Analytics',
    kind: 'analytics',
    html: [/google-analytics/, /googletagmanager/, /gtag\(/, /ga\.js/, /analytics\.js/],
    scripts: [/google-analytics/, /googletagmanager/, /gtag/],
  },
  {
    name: 'Segment',
    kind: 'analytics',
    html: [/segment\.com\/analytics/, /cdn\.segment\.com/],
    scripts: [/cdn\.segment\.com/],
  },
  {
    name: 'Mixpanel',
    kind: 'analytics',
    html: [/mixpanel\.com/, /mixpanel/],
    scripts: [/mixpanel/],
  },
  {
    name: 'PostHog',
    kind: 'analytics',
    html: [/posthog\.com/, /posthog/, /cdn\.posthog\.com/],
    scripts: [/cdn\.posthog\.com/],
  },
  {
    name: 'Plausible',
    kind: 'analytics',
    html: [/plausible\.io/],
    scripts: [/plausible\.io/],
  },
  {
    name: 'Fathom',
    kind: 'analytics',
    html: [/fathom\.analytics/, /usefathom\.com/],
    scripts: [/cdn\.fathom\.com/],
  },
  {
    name: 'Hotjar',
    kind: 'analytics',
    html: [/hotjar\.com/, /hotjar/],
    scripts: [/hotjar/],
  },
  {
    name: 'Amplitude',
    kind: 'analytics',
    html: [/amplitude\.com/],
    scripts: [/amplitude/],
  },
  {
    name: 'Heap',
    kind: 'analytics',
    html: [/heapanalytics\.com/, /heap-analytics/],
    scripts: [/heapanalytics/],
  },
  {
    name: 'FullStory',
    kind: 'analytics',
    html: [/fullstory\.com/],
    scripts: [/fullstory/],
  },
  {
    name: 'HubSpot',
    kind: 'analytics',
    html: [/hubspot\.com/, /hs-scripts/, /hs-analytics/],
    scripts: [/hubspot/],
  },
  {
    name: 'Meta Pixel',
    kind: 'analytics',
    html: [/facebook\.net\/en_US\/fbevents/, /fbq\(/],
    scripts: [/facebook\.net/],
  },
  {
    name: 'Twitter Ads',
    kind: 'analytics',
    html: [/static\.ads-twitter\.com/],
    scripts: [/ads-twitter\.com/],
  },
  {
    name: 'Bing Ads',
    kind: 'analytics',
    html: [/bat\.bing\.com/],
    scripts: [/bat\.bing\.com/],
  },
  {
    name: 'Matomo',
    kind: 'analytics',
    html: [/matomo/, /piwik/],
    scripts: [/matomo/, /piwik/],
  },
]

// ---------------------------------------------------------------------------
// Detection logic
// ---------------------------------------------------------------------------

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

/**
 * Run a single pattern against the HTML and headers.
 * Returns the confidence if detected, 0 otherwise.
 */
function detectPattern(
  pattern: TechPattern,
  htmlLower: string,
  headerStr: string,
): number {
  let detected = false

  if (pattern.html && matchesAny(htmlLower, pattern.html)) detected = true
  if (pattern.headers && matchesAny(headerStr, pattern.headers)) detected = true
  if (pattern.generator) {
    // Extract meta generator content
    const genMatch = htmlLower.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i)
    if (genMatch && matchesAny(genMatch[1], pattern.generator)) detected = true
  }
  if (pattern.scripts && matchesAny(htmlLower, pattern.scripts)) detected = true
  if (pattern.classes && matchesAny(htmlLower, pattern.classes)) detected = true

  if (!detected) return 0

  // Confidence scoring based on signal strength
  let confidence = 0.7 // base for any match

  // HTML structure matches are strongest
  if (pattern.html && matchesAny(htmlLower, pattern.html)) {
    confidence = Math.max(confidence, 0.85)
  }

  // Generator meta tags are very reliable
  if (pattern.generator) {
    const genMatch = htmlLower.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i)
    if (genMatch && matchesAny(genMatch[1], pattern.generator)) {
      confidence = Math.max(confidence, 0.95)
    }
  }

  // Header matches are reliable but less specific
  if (pattern.headers && matchesAny(headerStr, pattern.headers)) {
    confidence = Math.max(confidence, 0.8)
  }

  // Script src matches are strong
  if (pattern.scripts && matchesAny(htmlLower, pattern.scripts)) {
    confidence = Math.max(confidence, 0.9)
  }

  return confidence
}

/**
 * Detect technologies from page HTML and response headers.
 *
 * @param html - Raw HTML string (rendered, post-JS if available)
 * @param responseHeaders - HTTP response headers (lowercased keys optional)
 * @returns Array of detected technologies above MIN_CONFIDENCE, deduplicated
 */
export function detectTechnologies(
  html: string,
  responseHeaders: Record<string, string> = {},
): DetectedTech[] {
  const htmlLower = html.toLowerCase()
  // Include both header keys and values so patterns like /cf-ray/ match the key name
  const headerStr = Object.entries(responseHeaders)
    .map(([k, v]) => `${k} ${v}`)
    .join(' ')
    .toLowerCase()

  const seen = new Map<string, DetectedTech>()

  for (const pattern of PATTERNS) {
    const confidence = detectPattern(pattern, htmlLower, headerStr)
    if (confidence < MIN_CONFIDENCE) continue

    const existing = seen.get(pattern.name)
    if (!existing || confidence > existing.confidence) {
      seen.set(pattern.name, {
        name: pattern.name,
        kind: pattern.kind,
        confidence,
      })
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence)
}

/**
 * Infer industry from the URL hostname and page text.
 * Returns a best-guess industry string or null.
 *
 * Uses hostname keywords + page content for classification.
 * Designed to be called once per audit, not per page.
 */
export function inferIndustry(hostname: string, pageText: string): string | null {
  const h = hostname.toLowerCase()
  const text = (h + ' ' + pageText).toLowerCase()

  // Order matters: more specific patterns first
  const rules: Array<{ pattern: RegExp; industry: string }> = [
    // E-commerce (check early — "shop" in hostname is very reliable)
    { pattern: /\b(shop|store|buy|cart|product|commerce|checkout|ecommerce)\b/, industry: 'E-commerce' },
    // SaaS / tech
    { pattern: /\b(saas|app\.|api\.|dev\.|tool|platform|dashboard|software)\b/, industry: 'SaaS' },
    // Agency / services
    { pattern: /\b(agency|studio|design|consulting|services|creative)\b/, industry: 'Agency' },
    // Education
    { pattern: /\b(learn|course|education|academy|school|training|university)\b/, industry: 'Education' },
    // Health
    { pattern: /\b(health|medical|doctor|clinic|wellness|fitness|hospital)\b/, industry: 'Health' },
    // Finance
    { pattern: /\b(finance|bank|invest|crypto|fintech|payment|insurance)\b/, industry: 'Finance' },
    // Media / content
    { pattern: /\b(news|media|magazine|journal|podcast|blog)\b/, industry: 'Media' },
    // Portfolio / personal (check last — broadest match)
    { pattern: /\b(portfolio|personal|resume|cv)\b/, industry: 'Portfolio' },
  ]

  for (const { pattern, industry } of rules) {
    if (pattern.test(text)) return industry
  }

  return null
}
