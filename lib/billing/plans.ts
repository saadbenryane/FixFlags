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
  founding?: string
  foundingPriceId?: string
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
    outcome: 'See what\u2019s broken',
    auditLimit: 3,
    auditLimitKind: 'lifetime',
    auditLimitLabel: '3 audits total',
    features: [
      'Top 3 findings per area',
      'Human-readable fix text for top findings',
      'No credit card',
    ],
    highlight: false,
    cta: 'Get started free',
    href: '/sign-up',
  },
  BUILDER: {
    plan: 'BUILDER',
    name: 'Builder',
    label: 'Builder',
    price: '$49',
    period: '/mo',
    persona: 'Solo builders shipping weekly',
    outcome: 'Fix everything, re-check everything',
    auditLimit: 25,
    auditLimitKind: 'monthly',
    auditLimitLabel: '25 / month',
    founding: '$29/mo for 3 months',
    foundingPriceId: envPriceId('STRIPE_BUILDER_FOUNDING_PRICE_ID'),
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      'See every issue, not just the top 3',
      'Full agent-ready prompts on Builder+',
      'Prove your agent actually fixed it',
      'Audit history',
      'Audit from Cursor without switching tabs',
    ],
    highlight: true,
    cta: 'Start Builder',
    href: '/sign-up?plan=BUILDER',
  },
  TEAM: {
    plan: 'TEAM',
    name: 'Team',
    label: 'Team',
    price: '$199',
    period: '/mo',
    persona: 'Small teams with multiple sites',
    outcome: 'Organize audits across projects',
    auditLimit: 100,
    auditLimitKind: 'monthly',
    auditLimitLabel: '100 / month',
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: 5,
    features: [
      'Everything in Builder',
      'Up to 5 projects',
      'Assign audits to projects',
      'Show stakeholders what improved',
    ],
    highlight: false,
    cta: 'Start Team',
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
    founding: '$499/mo for 3 months',
    foundingPriceId: envPriceId('STRIPE_STUDIO_FOUNDING_PRICE_ID'),
    stripePriceId: envPriceId('STRIPE_STUDIO_PRICE_ID'),
    projectLimit: 20,
    features: [
      'Everything in Team',
      'Up to 20 projects',
      'Shareable public reports',
      'Agency use',
      'Priority support',
    ],
    highlight: false,
    cta: 'Start Studio',
    href: '/sign-up?plan=STUDIO',
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

export const STRIPE_FOUNDING_PRICE_IDS: Partial<Record<PaidPlan, string>> = Object.fromEntries(
  (['BUILDER', 'TEAM', 'STUDIO'] as const)
    .map((plan) => [plan, PLAN_DEFINITIONS[plan].foundingPriceId])
    .filter(([, id]) => id)
) as Partial<Record<PaidPlan, string>>

export function scanLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].auditLimit
}

export function projectLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].projectLimit ?? 0
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const def of Object.values(PLAN_DEFINITIONS)) {
    if (def.stripePriceId === priceId || def.foundingPriceId === priceId) {
      return def.plan
    }
  }
  return null
}

export function resolveCheckoutPriceId(plan: PaidPlan, useFounding: boolean): string | undefined {
  if (useFounding && PLAN_DEFINITIONS[plan].foundingPriceId) {
    return PLAN_DEFINITIONS[plan].foundingPriceId
  }
  return PLAN_DEFINITIONS[plan].stripePriceId
}

export function getMarketingPlans() {
  return (['FREE', 'BUILDER', 'TEAM', 'STUDIO'] as const).map((plan) => {
    const def = PLAN_DEFINITIONS[plan]
    return {
      name: def.name,
      plan: def.plan,
      price: def.price,
      period: def.period,
      persona: def.persona,
      outcome: def.outcome,
      audits: def.auditLimitLabel,
      founding: def.founding,
      features: def.features,
      cta: def.cta,
      href: def.href,
      highlight: def.highlight,
    }
  })
}

export const EXPERT_REVIEW_PRICE_USD = 500

export function getExpertReviewStripePriceId(): string | undefined {
  return envPriceId('STRIPE_EXPERT_REVIEW_PRICE_ID')
}
