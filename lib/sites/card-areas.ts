/** Card areas on the Site board. Checks and Flags project into these. */

export const SITE_CARD_AREAS = [
  'site',
  'security',
  'search',
  'performance',
  'conversion',
  'tracking',
  'uptime',
  'accessibility',
] as const

export type SiteCardArea = (typeof SITE_CARD_AREAS)[number]

export const STARTER_BOARD_CARDS: SiteCardArea[] = [
  'site',
  'conversion',
  'security',
  'search',
  'performance',
  'tracking',
]

/** Public-check cards the Add library can place on a board. No connections required. */
export const ADDABLE_BOARD_CARDS: SiteCardArea[] = ['uptime', 'accessibility']

export type CardHealthState =
  | 'healthy'
  | 'attention'
  | 'problem'
  | 'unknown'
  | 'checking'

export const CARD_CATALOG: Record<
  SiteCardArea,
  { name: string; question: string; category: string }
> = {
  site: {
    name: 'Site',
    question: 'The website we’re looking after',
    category: 'Website',
  },
  security: {
    name: 'Security',
    question: 'Is the public website safely configured?',
    category: 'Website',
  },
  search: {
    name: 'Search',
    question: 'Can people discover your website?',
    category: 'Growth',
  },
  performance: {
    name: 'Performance',
    question: 'Is the experience fast enough?',
    category: 'Website',
  },
  conversion: {
    name: 'Conversion',
    question: 'Can people do what matters?',
    category: 'Growth',
  },
  tracking: {
    name: 'Tracking',
    question: 'Are important events being measured?',
    category: 'Measurement',
  },
  uptime: {
    name: 'Uptime',
    question: 'Is your website reachable?',
    category: 'Website',
  },
  accessibility: {
    name: 'Accessibility',
    question: 'Can everyone use the essentials?',
    category: 'Website',
  },
}

/**
 * Map deterministic checkId prefixes / ids into board card areas.
 * Same scan work; new packaging.
 */
const CHECK_ID_TO_AREA: Array<{ match: RegExp; area: SiteCardArea }> = [
  { match: /^(no-https|security-|cookie-consent|mixed-content)/, area: 'security' },
  { match: /^(slow-3g-|flow-destination-slow-load|perf-|lcp-|cls-|inp-|render-blocking|unused-|unoptimized|mobile-perf|mobile-lcp)/, area: 'performance' },
  {
    match:
      /^(title-|description-|og-|canonical-|robots-|h1-|sitemap-|structured|broken-internal|broken-page|favicon|lang-|viewport-missing|no-structured)/,
    area: 'search',
  },
  {
    match:
      /^(journey-|funnel-|no-cta|cta-|conversion-|auth-checkout|interaction-|form-|tap-targets|heading-|h1-generic|messaging-|slop-|visual-)/,
    area: 'conversion',
  },
  { match: /^(measurement-|analytics-|pixel-|meta-|gtm-|tag-)/, area: 'tracking' },
  { match: /^(images-missing|form-inputs|buttons-no|links-no|iframe-|tabindex|color-contrast|skip-link|keyboard|focus-visible|axe-)/, area: 'accessibility' },
  { match: /^(console-errors|broken-page)/, area: 'uptime' },
]

const RUBRIC_FALLBACK: Record<string, SiteCardArea> = {
  MESSAGE: 'conversion',
  EXPERIENCE: 'performance',
  REACH: 'search',
}

export function cardAreaForCheck(input: {
  checkId: string | null | undefined
  rubric?: string | null
  impactTag?: string | null
}): SiteCardArea {
  const checkId = (input.checkId ?? '').toLowerCase()
  for (const rule of CHECK_ID_TO_AREA) {
    if (rule.match.test(checkId)) return rule.area
  }

  const impact = (input.impactTag ?? '').toUpperCase()
  if (impact === 'CONVERSION' || impact === 'REVENUE') return 'conversion'
  if (impact === 'MEASUREMENT') return 'tracking'
  if (impact === 'SEO' || impact === 'SHARING') return 'search'
  if (impact === 'ACCESSIBILITY') return 'accessibility'

  const rubric = (input.rubric ?? '').toUpperCase()
  return RUBRIC_FALLBACK[rubric] ?? 'site'
}
