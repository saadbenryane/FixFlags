import { ALL_CHECK_IDS, type CheckId } from '@/lib/audit/check-ids'

/** How a capability is evaluated in the FixFlags pipeline. */
export type AuditTool =
  | 'html-parse' // Cheerio metadata parse + deterministic checks
  | 'browser-capture' // Puppeteer screenshots + DOM metrics
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
    | 'ai-review'
  label: string
  tool: AuditTool
  status: CapabilityStatus
  checkIds: CheckId[]
  /** npm script or command to verify locally. */
  verify?: string
  notes?: string
}

/**
 * Canonical map of what FixFlags can analyze, how, and where it lives.
 * Used by scripts/audit-capability-report.ts and goal planning.
 */
export const AUDIT_CAPABILITIES: AuditCapability[] = [
  // MESSAGE - copy & slop
  {
    id: 'copy-hero-specificity',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Hero headline specificity',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['h1-generic'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'copy-cta-presence',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'CTA detected in page',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['no-cta-detected'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'copy-heading-hierarchy',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Heading hierarchy (H1 + section H2s)',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['heading-hierarchy-missing'],
    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'copy-slop-placeholders',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Placeholder / lorem / TODO copy',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['placeholder-copy-detected', 'template-default-copy', 'unreplaced-template-token'],
  },
  {
    id: 'copy-dead-cta-links',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Dead hash/empty CTA hrefs',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['cta-dead-link'],
  },
  {
    id: 'copy-social-proof-quality',
    dimension: 'MESSAGE',
    category: 'copy',
    label: 'Fake testimonials / unverifiable social proof',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['social-proof-unverifiable'],
    verify: 'npm run demo:audit:offline',
  },

  // REACH - measurement & security
  {
    id: 'measurement-consent-scan',
    dimension: 'REACH',
    category: 'loading',
    label: 'Privacy consent controls',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['measurement-consent-blocking-incomplete'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'measurement-analytics-scan',
    dimension: 'REACH',
    category: 'loading',
    label: 'Web analytics (GA4, GTM, PostHog)',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['measurement-ga-gtm-posthog-missing'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'ai-measurement-review',
    dimension: 'REACH',
    category: 'ai-review',
    label: 'AI review of measurement setup',
    tool: 'ai-judge',
    status: 'live',
    checkIds: [],
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
    checkIds: ['security-mixed-content'],
    verify: 'npm run demo:audit:offline',
  },

  // REACH - metadata & SEO
  {
    id: 'reach-title-description',
    dimension: 'REACH',
    category: 'metadata',
    label: 'Title & meta description',
    tool: 'html-parse',
    status: 'live',
    checkIds: [
      'title-missing',
      'title-too-short',
      'title-too-long',
      'description-missing',
      'description-too-short',
      'description-too-long',
      'viewport-missing',
      'lang-missing',
      'favicon-missing',
    ],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'reach-social-preview',
    dimension: 'REACH',
    category: 'metadata',
    label: 'Open Graph & Twitter cards',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['og-image-missing', 'og-image-broken', 'og-title-missing', 'og-description-missing'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'reach-indexability',
    dimension: 'REACH',
    category: 'seo',
    label: 'Canonical, robots, structured data',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['canonical-missing', 'robots-blocks-indexing', 'no-structured-data'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'reach-headings-seo',
    dimension: 'REACH',
    category: 'seo',
    label: 'H1 count & SEO headings',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['h1-missing', 'h1-multiple'],
  },
  {
    id: 'reach-site-map-robots',
    dimension: 'REACH',
    category: 'seo',
    label: 'sitemap.xml & robots.txt',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['sitemap-missing', 'robots-txt-missing'],
    notes: 'Domain-level; out of scope for demo fixture loop.',
  },
  {
    id: 'reach-broken-links',
    dimension: 'REACH',
    category: 'seo',
    label: 'Broken internal links',
    tool: 'html-parse',
    status: 'live',
    checkIds: ['broken-internal-links', 'external-links-unsafe'],
  },

  // REACH - trust
  {
    id: 'reach-trust-signals',
    dimension: 'REACH',
    category: 'trust',
    label: 'HTTPS, privacy, contact, cookies',
    tool: 'html-parse',
    status: 'live',
    checkIds: [
      'no-https',
      'no-privacy-policy',
      'no-contact-info',
      'cookie-consent-absent',
    ],
    verify: 'npm run demo:audit',
  },
  {
    id: 'reach-console-errors',
    dimension: 'MESSAGE',
    category: 'trust',
    label: 'JavaScript console errors',
    tool: 'browser-capture',
    status: 'live',
    checkIds: ['console-errors-critical', 'console-errors-some'],
  },

  // EXPERIENCE - performance
  {
    id: 'experience-core-web-vitals',
    dimension: 'EXPERIENCE',
    category: 'performance',
    label: 'Core Web Vitals (LCP, CLS, INP)',
    tool: 'pagespeed',
    status: 'live',
    checkIds: [
      'perf-score-critical',
      'perf-score-poor',
      'lcp-critical',
      'lcp-poor',
      'cls-critical',
      'cls-poor',
      'inp-critical',
      'inp-poor',
      'render-blocking',
      'unused-js-large',
      'unused-css-large',
      'unoptimized-images',
    ],
    notes: 'Requires PageSpeed API; out of scope for offline demo loop.',
  },
  {
    id: 'experience-mobile-perf',
    dimension: 'EXPERIENCE',
    category: 'mobile',
    label: 'Mobile PageSpeed & LCP',
    tool: 'pagespeed',
    status: 'live',
    checkIds: ['mobile-perf-critical', 'mobile-perf-poor', 'mobile-lcp-critical', 'tap-targets-small'],
  },

  // EXPERIENCE - accessibility
  {
    id: 'experience-a11y-dom',
    dimension: 'EXPERIENCE',
    category: 'accessibility',
    label: 'DOM accessibility (labels, alt, skip link)',
    tool: 'html-parse',
    status: 'live',
    checkIds: [
      'images-missing-alt',
      'images-empty-alt',
      'form-inputs-no-label',
      'buttons-no-text',
      'links-no-text',
      'iframe-no-title',
      'tabindex-positive',
      'skip-link-missing',
    ],
  },
  {
    id: 'experience-a11y-lighthouse',
    dimension: 'EXPERIENCE',
    category: 'accessibility',
    label: 'Lighthouse a11y audits (contrast, focus, keyboard)',
    tool: 'pagespeed',
    status: 'live',
    checkIds: ['color-contrast-poor', 'keyboard-nav-trap', 'focus-visible-missing'],
  },

  // EXPERIENCE - layout & mobile fold
  {
    id: 'experience-mobile-cta-fold',
    dimension: 'EXPERIENCE',
    category: 'layout',
    label: 'Primary CTA above fold on mobile',
    tool: 'browser-capture',
    status: 'live',
    checkIds: ['cta-below-fold-mobile'],
    verify: 'npm run dev:all + full audit',
    notes: 'Uses CaptureMetrics from mobile Puppeteer viewport.',
  },

  // EXPERIENCE - interaction & loading
  {
    id: 'experience-loading-states',
    dimension: 'EXPERIENCE',
    category: 'loading',
    label: 'Stuck loading / skeleton UI after page load',
    tool: 'browser-capture',
    status: 'live',
    checkIds: ['loading-indicator-stuck'],
    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
    notes: 'Detects visible skeleton/spinner/[aria-busy] after capture.',
  },
  {
    id: 'experience-form-feedback',
    dimension: 'EXPERIENCE',
    category: 'interaction',
    label: 'Form validation & submit feedback',
    tool: 'flow-navigation',
    status: 'live',
    checkIds: ['form-missing-validation', 'flow-form-no-validation', 'flow-form-slow-feedback'],
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
    checkIds: ['motion-ignores-reduced-preference'],
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
    checkIds: ['broken-page-anchors'],
    verify: 'npm run demo:audit:offline',
  },
  {
    id: 'experience-cta-flow',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Primary CTA click & navigation',
    tool: 'flow-navigation',
    status: 'live',
    checkIds: [
      'flow-no-cta-found',
      'flow-cta-unclickable',
      'flow-cta-404',
      'flow-cta-dead-end',
      'flow-cta-external-leave',
      'flow-cta-blank-destination',
      'flow-cta-stuck-loading',
      'flow-cta-destination-no-trust',
    ],
    verify: 'npm run demo:audit:flow',
  },
  {
    id: 'experience-multi-step-flow',
    dimension: 'EXPERIENCE',
    category: 'flow',
    label: 'Pricing nav, mobile menu, multi-step signup',
    tool: 'flow-navigation',
    status: 'live',
    checkIds: ['flow-pricing-nav-broken', 'flow-mobile-menu-broken'],
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
    checkIds: ['scroll-ghost-sections'],
    verify: 'npm run demo:audit:flow',
  },
  {
    id: 'experience-mobile-input-zoom',
    dimension: 'EXPERIENCE',
    category: 'accessibility',
    label: 'Mobile form input font-size (iOS zoom)',
    tool: 'browser-capture',
    status: 'live',
    checkIds: ['form-inputs-zoom-mobile'],
    verify: 'npm run test:unit -- lib/audit/__tests__/checks.test.ts',
  },
  {
    id: 'experience-slow-replay',
    dimension: 'EXPERIENCE',
    category: 'performance',
    label: 'Slow 3G load replay with timed captures',
    tool: 'browser-capture',
    status: 'live',
    checkIds: ['slow-3g-blank-screen', 'slow-3g-cta-delayed'],
    verify: 'npm run demo:audit:flow',
    notes: 'Network emulation at 3G speeds with screenshots at 2s/5s/8s.',
  },

  // EXPERIENCE - design language (mostly AI today)
  {
    id: 'experience-visual-polish',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'Visual polish, hierarchy, spacing feel',
    tool: 'ai-judge',
    status: 'partial',
    checkIds: [],
    verify: 'lib/audit/__tests__/judge-rubric.test.ts',
    notes: 'AI judge EXPERIENCE rubric; no deterministic token checks yet.',
  },
  {
    id: 'experience-design-tokens',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'Cross-section spacing, radius, typography consistency',
    tool: 'browser-capture',
    status: 'live',
    checkIds: ['font-family-sprawl', 'button-radius-inconsistent', 'visual-radius-inconsistent', 'visual-typography-sprawl'],
    verify: 'npm run test:unit -- lib/audit/__tests__/design-language.test.ts',
    notes: 'DOM style sampling during mobile capture.',
  },

  // AI review layer
  {
    id: 'ai-rubric-pass',
    dimension: 'MESSAGE',
    category: 'ai-review',
    label: 'AI judge MESSAGE / EXPERIENCE / REACH rubrics',
    tool: 'ai-judge',
    status: 'live',
    checkIds: [],
    verify: 'npm run dev:all + audit URL',
  },

  // Internal (FixFlags repo only)
  {
    id: 'internal-brand-hex',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'FixFlags brand hex drift guard',
    tool: 'internal-guard',
    status: 'live',
    checkIds: [],
    verify: 'npm run brand:hex-guard',
  },
  {
    id: 'internal-ui-drift',
    dimension: 'EXPERIENCE',
    category: 'design-language',
    label: 'FixFlags UI component drift guard',
    tool: 'internal-guard',
    status: 'live',
    checkIds: [],
    verify: 'npm run ui:drift-guard',
  },
]

/** All check IDs registered in the capability matrix (live capabilities only). */
export function liveCheckIdsFromMatrix(): CheckId[] {
  const ids = new Set<CheckId>()
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
