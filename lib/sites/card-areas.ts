import { registeredCheck } from '@/lib/audit/check-registry'

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
export const ADDABLE_BOARD_CARDS: SiteCardArea[] = ['accessibility']

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
    name: 'Pages',
    question: 'Which pages has FixFlags discovered?',
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

export function cardAreaForCheck(input: {
  checkId: string | null | undefined
  rubric?: string | null
  impactTag?: string | null
}): SiteCardArea {
  const checkId = (input.checkId ?? '').toLowerCase()
  const registered = registeredCheck(checkId)
  if (registered) return registered.area
  // Unknown historical identities retain their explicit impact attribution.
  const impact = (input.impactTag ?? '').toUpperCase()
  if (impact === 'CONVERSION' || impact === 'REVENUE') return 'conversion'
  if (impact === 'MEASUREMENT') return 'tracking'
  if (impact === 'SEO' || impact === 'SHARING') return 'search'
  if (impact === 'ACCESSIBILITY') return 'accessibility'

  return 'site'
}
