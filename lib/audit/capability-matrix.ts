import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'
import { CHECK_DEFINITIONS } from './check-registry'
import { QUALITATIVE_GUIDANCE_COPY as C } from '@/lib/marketing/copy/qualitative-guidance'

/** How a capability is evaluated in the FixFlags pipeline. */
export type AuditTool =
  | 'http-response' // Public HTTP response and access evidence
  | 'html-parse' // Cheerio metadata parse + deterministic checks
  | 'browser-capture' // Playwright screenshots + DOM metrics
  | 'flow-navigation' // CTA click + navigation trace
  | 'pagespeed' // Google PageSpeed / Lighthouse API
  | 'ai-judge' // Vision LLM rubric pass
  | 'internal-guard' // Repo CI guards (FixFlags codebase only)

export type AuditDimension = 'MESSAGE' | 'EXPERIENCE' | 'REACH'

export type CapabilityStatus = 'live' | 'partial' | 'planned'

export interface AuditCapability {
  id: string
  dimension: AuditDimension
  /** High-level bucket for planning and reports. */
  category:
    | 'copy'
    | 'metadata'
    | 'seo'
    | 'trust'
    | 'accessibility'
    | 'performance'
    | 'mobile'
    | 'layout'
    | 'interaction'
    | 'flow'
    | 'loading'
    | 'design-language'
    | 'measurement'
    | 'ai-review'
  label: string
  tool: AuditTool
  status: CapabilityStatus
  checkIds: string[]
  /** npm script or command to verify locally. */
  verify?: string
  notes?: string
}

/**
 * Canonical map of what FixFlags can analyze, how, and where it lives.
 * Used by scripts/audit-capability-report.ts and goal planning.
 */
const CAPABILITY_DEFINITIONS: Omit<AuditCapability, 'checkIds'>[] = [
  { id: 'public-page-response', dimension: 'REACH', category: 'seo', label: 'Checked page availability and response errors',
    tool: 'http-response', status: 'live', verify: 'npx vitest run lib/audit/checks/page-response.test.ts',
    notes: 'Reuses the recorded public GET. Access restrictions and incomplete collection do not prove a failure or repair; rendered behavior is separate.' },
  {
    id: 'automatic-account-checks', dimension: 'EXPERIENCE', category: 'flow',
    label: 'Signup, email verification, signed-in pages and account deletion', tool: 'browser-capture', status: 'live',
    verify: 'npx vitest run lib/sites/accounts',
    notes: 'Owned Sites, verified mailbox infrastructure, encrypted credentials and supported same-origin forms only. Unsupported or incomplete lifecycle steps remain unknown.',
  },
  {
    id: 'search-evidence', dimension: 'REACH', category: 'seo', label: 'Public Search evidence and structured-data inspection',
    tool: 'browser-capture', status: 'live',

    verify: 'npx vitest run lib/audit/search',
    notes: 'Original response, rendered DOM, bounded site resources, and separately authorized Google evidence.',
  },
  // MESSAGE - messaging clarity
  {
    id: 'copy-messaging-clarity',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Value proposition clarity & jargon detection',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'message-conversion-friction',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Conversion path, risk reversal & social proof',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'message-trust-psychology',
    dimension: 'MESSAGE',
    category: 'trust',
    label: C.trustContextLabel,
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },

  // EXPERIENCE - visual hierarchy
  {
    id: 'experience-visual-hierarchy',
    dimension: 'EXPERIENCE',
    category: 'layout',
    label: 'Visual hierarchy, competing CTAs, font sprawl',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'experience-mobile-ux-quality',
    dimension: 'EXPERIENCE',
    category: 'mobile',
    label: 'Mobile UX: zoom, thumb zone, CTA labels, loading',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },

  // MESSAGE - copy & slop
  {
    id: 'copy-hero-specificity',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Hero headline specificity',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'copy-cta-presence',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'CTA detected in page',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'copy-cta-focus',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'CTA focus above the fold',
    tool: 'browser-capture',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'copy-heading-hierarchy',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Heading hierarchy (H1 + section H2s)',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'copy-slop-placeholders',
    dimension: 'MESSAGE',
    category: 'copy',
    label: C.placeholderLabel,
    tool: 'html-parse',
    status: 'live',
    notes: C.placeholderScope,
  },
  {
    id: 'copy-dead-cta-links',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Dead hash/empty CTA hrefs',
    tool: 'html-parse',
    status: 'live',

  },
  {
    id: 'copy-social-proof-quality',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Fake testimonials / unverifiable social proof',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },

  // REACH - measurement & security
  {
    id: 'measurement-analytics-scan',
    dimension: 'REACH',
    category: 'loading',
    label: 'Web analytics (GA4, GTM, PostHog)',
    tool: 'browser-capture',
    status: 'live',

    notes: 'Markup, recognized library transfers and event attempts retain distinct evidence. Event requests are suppressed; endpoint responses never certify ingestion. Phase-scoped HTTP findings require matching repair evidence.',
    verify: 'TRACKING_BROWSER_REQUIRED=true npx vitest run lib/audit/tracking/',
  },
  {
    id: 'ai-measurement-review',
    dimension: 'REACH',
    category: 'ai-review',
    label: 'AI review of measurement setup',
    tool: 'ai-judge',
    status: 'live',

    verify: 'npm run dev:all + audit URL',
  },

  // REACH - security basics
  {
    id: 'security-basics-scan',
    dimension: 'REACH',
    category: 'loading',
    label: 'Mixed content detection',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'security-headers-scan',
    dimension: 'REACH',
    category: 'trust',
    label: 'CSP, HSTS, X-Frame-Options, and other response security headers',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
    notes: 'Reads raw HTTP response headers captured during page navigation, not PageMetadata.',
  },

  // REACH - metadata & SEO
  {
    id: 'reach-title-description',
    dimension: 'REACH',
    category: 'metadata',
    label: 'Title & meta description',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'reach-social-preview',
    dimension: 'REACH',
    category: 'metadata',
    label: 'Open Graph & Twitter cards',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'reach-indexability',
    dimension: 'REACH',
    category: 'seo',
    label: 'Canonical, robots, structured data',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'reach-headings-seo',
    dimension: 'REACH',
    category: 'seo',
    label: 'H1 count & SEO headings',
    tool: 'html-parse',
    status: 'live',

  },
  {
    id: 'reach-site-map-robots',
    dimension: 'REACH',
    category: 'seo',
    label: 'sitemap.xml & robots.txt',
    tool: 'html-parse',
    status: 'live',

    notes: 'Domain-level; out of scope for demo fixture loop.',
  },
  {
    id: 'reach-search-performance',
    dimension: 'REACH',
    category: 'seo',
    label: 'Page indexing status & search performance signals',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
    notes: 'Uses GSC data from index_statuses and search_performance tables.',
  },
  {
    id: 'reach-broken-links',
    dimension: 'REACH',
    category: 'seo',
    label: 'Broken internal links',
    tool: 'html-parse',
    status: 'live',

  },

  // REACH - trust
  {
    id: 'reach-trust-signals',
    dimension: 'REACH',
    category: 'trust',
    label: 'HTTPS, privacy, contact, cookies',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit',
  },
  {
    id: 'reach-console-errors',
    dimension: 'MESSAGE',
    category: 'trust',
    label: 'JavaScript console errors',
    tool: 'browser-capture',
    status: 'live',

  },

  // EXPERIENCE - performance
  {
    id: 'experience-core-web-vitals',
    dimension: 'EXPERIENCE',
    category: 'performance',
    label: 'Core Web Vitals (LCP, CLS, INP)',
    tool: 'pagespeed',
    status: 'live',

    notes: 'Requires PageSpeed API; out of scope for offline demo loop.',
  },
  {
    id: 'experience-mobile-perf',
    dimension: 'EXPERIENCE',
    category: 'mobile',
    label: 'Mobile PageSpeed, LCP & CLS',
    tool: 'pagespeed',
    status: 'live',

  },

  // EXPERIENCE - accessibility
  {
    id: 'experience-a11y-dom',
    dimension: 'EXPERIENCE',
    category: 'accessibility',
    label: 'DOM accessibility (labels, alt, skip link)',
    tool: 'html-parse',
    status: 'live',

  },
  {
    id: 'experience-a11y-lighthouse',
    dimension: 'EXPERIENCE',
    category: 'accessibility',
    label: 'Lighthouse a11y audits (contrast, focus, keyboard)',
    tool: 'pagespeed',
    status: 'live',

  },
  {
    id: 'experience-a11y-axe-core',
    dimension: 'EXPERIENCE',
    category: 'accessibility',
    label: 'axe-core structural & landmark accessibility',
    tool: 'browser-capture',
    status: 'live',

    notes: 'Browser capture selects WCAG tags, registered heading and landmark best-practice rules, and the legacy control-identifier diagnostic. Actual rule outcomes retain scoped repair evidence; manual and assistive-technology review remain separate.',
  },
  {
    id: 'experience-keyboard-navigation', dimension: 'EXPERIENCE', category: 'accessibility',
    label: 'Exercised keyboard navigation and focus styles', tool: 'browser-capture', status: 'live',
    notes: 'Independent bounded page and declared popup probe. Menu arrows, dialog focus boundaries, Escape and restoration retain scoped repair proof. Unexercised states, computed focus styles and tab-order heuristics do not establish complete manual or assistive-technology coverage.',
    verify: 'KEYBOARD_BROWSER_REQUIRED=true npx vitest run lib/audit/browser/keyboard-probe.test.ts lib/audit/checks/keyboard.test.ts',
  },

  // EXPERIENCE - layout & mobile fold
  {
    id: 'experience-mobile-cta-fold',
    dimension: 'EXPERIENCE',
    category: 'layout',
    label: C.actionPositionLabel,
    tool: 'browser-capture',
    status: 'live',

    verify: 'npm run dev:all + full audit',
    notes: C.actionPositionScope,
  },
  {
    id: 'experience-auth-checkout',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Auth & checkout links resolve',
    tool: 'html-parse',
    status: 'live',

    notes: 'Bounded public GET checks login/sign-up and checkout/payment destinations, including cross-origin links. Transport refusals remain unknown; repair requires every original failed destination.',
  },

  // EXPERIENCE - interaction & loading
  {
    id: 'experience-loading-states',
    dimension: 'EXPERIENCE',
    category: 'loading',
    label: 'Slow or stuck loading / skeleton UI',
    tool: 'browser-capture',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
    notes: 'Detects visible skeleton/spinner/[aria-busy] after capture and slow first-screen loading states.',
  },
  {
    id: 'experience-form-feedback',
    dimension: 'EXPERIENCE',
    category: 'interaction',
    label: 'Form validation & submit feedback',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'npm run demo:audit:flow',
    notes: 'Static parse flags missing required/pattern attrs; flow probe verifies empty-submit feedback.',
  },
  {
    id: 'experience-motion-a11y',
    dimension: 'EXPERIENCE',
    category: 'interaction',
    label: 'prefers-reduced-motion & excessive animation',
    tool: 'browser-capture',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
    notes: 'Emulates prefers-reduced-motion during mobile capture; flags animations that still run.',
  },

  // EXPERIENCE - CTA flow
  {
    id: 'experience-nav-anchors',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'On-page hash links target existing sections',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'experience-cta-flow',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Primary CTA click & navigation',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'npm run demo:audit:flow',
  },
  {
    id: 'experience-overlay-blockers',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Overlay / modal click blockers',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/beat-scout-precision.test.ts',
    notes: 'elementFromPoint overlay detection when CTA/nav/form clicks fail.',
  },
  {
    id: 'experience-engagement-api',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Engagement API and form submit failures',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/beat-scout-precision.test.ts',
    notes: 'Same-origin network monitor + controlled journey form probe + silent failure.',
  },
  {
    id: 'experience-journey-review',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'User journey walk (first-visit, pricing, signup, contact)',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'Pro audit with journeyReviewIncluded',
    notes: 'Playwright multi-step journeys gated to Pro+. Fill-only signup; submissions blocked.',
  },
  {
    id: 'reach-corridor-og-consistency',
    dimension: 'REACH',
    category: 'metadata',
    label: 'Cross-page Open Graph consistency on conversion corridor',
    tool: 'html-parse',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/corridor.test.ts',
  },
  {
    id: 'experience-multi-step-flow',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Pricing nav, mobile menu, multi-step signup',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'npm run demo:audit:flow',
    notes: 'Nav probes run before primary CTA click on landing page.',
  },
  {
    id: 'experience-scroll-reveal',
    dimension: 'EXPERIENCE',
    category: 'layout',
    label: 'Scroll-triggered section visibility',
    tool: 'flow-navigation',
    status: 'live',

    verify: 'npm run demo:audit:flow',
  },
  {
    id: 'experience-slow-replay',
    dimension: 'EXPERIENCE',
    category: 'performance',
    label: 'Slow 3G load replay with timed captures',
    tool: 'browser-capture',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/run-page-production-path.test.ts',
    notes: 'Network emulation at 3G speeds with screenshots at 2s/5s/8s. Collected by progressive action tasks.',
  },

  // EXPERIENCE - design language
  {
    id: 'experience-design-tokens',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'Cross-section spacing, radius, typography consistency',
    tool: 'browser-capture',
    status: 'live',

    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
    notes: 'DOM style sampling during mobile capture.',
  },

  // AI review layer (includes visual polish / hierarchy / spacing feel via EXPERIENCE rubric)
  {
    id: 'ai-rubric-pass',
    dimension: 'MESSAGE',
    category: 'ai-review',
    label: 'AI judge MESSAGE / EXPERIENCE / REACH rubrics',
    tool: 'ai-judge',
    status: 'live',

    verify: 'npm run dev:all + audit URL',
    notes:
      'Covers visual polish and spacing feel via the EXPERIENCE rubric. Deterministic token checks live under experience-design-tokens / experience-visual-hierarchy.',
  },

  // Internal (FixFlags repo only)
  {
    id: 'internal-brand-hex',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'FixFlags brand hex drift guard',
    tool: 'internal-guard',
    status: 'live',

    verify: 'npm run brand:hex-guard',
  },
  {
    id: 'internal-ui-drift',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'FixFlags UI component drift guard',
    tool: 'internal-guard',
    status: 'live',

    verify: 'npm run ui:drift-guard',
  },
]

export const AUDIT_CAPABILITIES: AuditCapability[] = CAPABILITY_DEFINITIONS.map(definition => ({
  ...definition,
  checkIds: Object.entries(CHECK_DEFINITIONS).filter(([, check]) =>
    (check.capabilities as readonly string[]).includes(definition.id)).map(([id]) => id),
}))

/** All check IDs registered in the capability matrix (live capabilities only). */
export function liveCheckIdsFromMatrix(): string[] {
  const ids = new Set<string>()
  for (const cap of AUDIT_CAPABILITIES) {
    if (cap.status === 'live') {
      for (const id of cap.checkIds) ids.add(id)
    }
  }
  return [...ids].sort()
}

export function capabilitySummary() {
  const byStatus = { live: 0, partial: 0, planned: 0 }
  const byTool = new Map<AuditTool, number>()
  for (const cap of AUDIT_CAPABILITIES) {
    byStatus[cap.status]++
    byTool.set(cap.tool, (byTool.get(cap.tool) ?? 0) + 1)
  }
  const registeredChecks = new Set(AUDIT_CAPABILITIES.flatMap((c) => c.checkIds))
  const unmapped = ALL_CHECK_IDS.filter((id) => !registeredChecks.has(id))
  return { byStatus, byTool, unmapped, totalCapabilities: AUDIT_CAPABILITIES.length }
}
