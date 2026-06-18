import { Plan } from '@prisma/client'

export type PaidPlan = Exclude<Plan, 'FREE'>

export interface PlanDefinition {
  plan: Plan
  name: string
  label: string
  price: string
  period: string
  persona: string
  outcome: string
  /** Monthly audit cap, or lifetime total for FREE */
  auditLimit: number
  auditLimitKind: 'monthly' | 'lifetime'
  auditLimitLabel: string
  stripePriceId?: string
  projectLimit?: number
  features: readonly string[]
  highlight: boolean
  cta: string
  href: string
}

function envPriceId(key: string): string | undefined {
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    plan: 'FREE',
    name: 'Free',
    label: 'Free',
    price: '$0',
    period: '',
    persona: 'Try before launch',
    outcome: 'See everything on one page',
    auditLimit: 3,
    auditLimitKind: 'lifetime',
    auditLimitLabel: '3 AI reports',
    features: [
      'Unlimited deterministic checks',
      '3 AI reports with fix prompts',
      'Unlimited re-checks on your reports',
    ],
    highlight: false,
    cta: 'Audit Free',
    href: '/sign-up?from=pricing',
  },
  BUILDER: {
    plan: 'BUILDER',
    name: 'Pro',
    label: 'Pro',
    price: '$29',
    period: '/mo',
    persona: 'Solo builders shipping weekly',
    outcome: 'Prove every fix, audit from your editor',
    auditLimit: 25,
    auditLimitKind: 'monthly',
    auditLimitLabel: '25 / month',
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      'Unlimited re-checks + before/after compare',
      'MCP in Cursor or Claude',
      '25 audits per month',
    ],
    highlight: true,
    cta: 'Start Pro',
    href: '/sign-up?plan=BUILDER',
  },
  TEAM: {
    plan: 'TEAM',
    name: 'Agency',
    label: 'Agency',
    price: '$99',
    period: '/mo',
    persona: 'Independent agencies with multiple sites',
    outcome: 'Share proof with clients',
    auditLimit: 100,
    auditLimitKind: 'monthly',
    auditLimitLabel: '100 / month',
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: 5,
    features: [
      'Everything in Pro',
      'Public share links',
      'Up to 5 projects',
    ],
    highlight: false,
    cta: 'Start Agency',
    href: '/sign-up?plan=TEAM',
  },
  STUDIO: {
    plan: 'STUDIO',
    name: 'Studio',
    label: 'Studio',
    price: '$999',
    period: '/mo',
    persona: 'Agencies and dev shops',
    outcome: 'Audit client sites at scale',
    auditLimit: 500,
    auditLimitKind: 'monthly',
    auditLimitLabel: '500 / month',
    stripePriceId: envPriceId('STRIPE_STUDIO_PRICE_ID'),
    projectLimit: 20,
    features: [
      'Everything in Agency',
      'Up to 20 projects',
      'Agency use',
      '500 audits per month',
    ],
    highlight: false,
    cta: 'Contact Us',
    href: 'mailto:hello@fixflags.com?subject=FixFlags%20high%20volume',
  },
}

export const PLAN_LIMITS: Record<Plan, { audits: number; label: string; price: string }> =
  Object.fromEntries(
    Object.values(PLAN_DEFINITIONS).map((def) => [
      def.plan,
      { audits: def.auditLimit, label: def.label, price: `${def.price}${def.period}` },
    ])
  ) as Record<Plan, { audits: number; label: string; price: string }>

export const STRIPE_PRICE_IDS: Partial<Record<Plan, string>> = Object.fromEntries(
  Object.values(PLAN_DEFINITIONS)
    .filter((def) => def.stripePriceId)
    .map((def) => [def.plan, def.stripePriceId])
) as Partial<Record<Plan, string>>

export function proUpgradeCta(prefix = 'Upgrade to Pro'): string {
  const def = PLAN_DEFINITIONS.BUILDER
  return `${prefix} - ${def.price}${def.period}`
}

export function scanLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].auditLimit
}

export function projectLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].projectLimit ?? 0
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const def of Object.values(PLAN_DEFINITIONS)) {
    if (def.stripePriceId === priceId) return def.plan
  }
  return null
}

export function getMarketingPlans() {
  return (['FREE', 'BUILDER', 'TEAM'] as const).map((plan) => {
    const def = PLAN_DEFINITIONS[plan]
    return {
      name: def.name,
      plan: def.plan,
      price: def.price,
      period: def.period,
      persona: def.persona,
      outcome: def.outcome,
      audits: def.auditLimitLabel,
      features: def.features,
      cta: def.cta,
      href: def.href,
      highlight: def.highlight,
      accountModel: 'Single account. No seats or shared workspace.',
    }
  })
}

export const CONTACT_PLAN = {
  name: 'High volume',
  plan: 'CONTACT' as const,
  price: 'Custom',
  period: '',
  persona: 'Teams auditing at scale',
  outcome: 'Volume pricing and dedicated support',
  audits: '500+ / month',
  features: [
    'Everything in Agency',
    'Custom audit volume',
    'Dedicated onboarding',
  ],
  cta: 'Contact Us',
  href: 'mailto:hello@fixflags.com?subject=FixFlags%20high%20volume',
  highlight: false,
  accountModel: 'Talk to us about your workflow.',
} as const

export const EXPERT_REVIEW_PRICE_USD = 500

export function getExpertReviewStripePriceId(): string | undefined {
  return envPriceId('STRIPE_EXPERT_REVIEW_PRICE_ID')
}
