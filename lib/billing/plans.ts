import { Plan } from '@prisma/client'
import { envPriceId } from '@/lib/billing/env'

export type PaidPlan = Exclude<Plan, 'FREE'>

export interface PlanDefinition {
  plan: Plan
  name: string
  label: string
  price: string
  period: string
  persona: string
  outcome: string
  /** Product review cap: monthly for paid, lifetime for FREE */
  auditLimit: number
  auditLimitKind: 'monthly' | 'lifetime'
  auditLimitLabel: string
  deepReviewLimit: number
  deepReviewLimitKind: 'monthly' | 'lifetime'
  deepReviewLimitLabel: string
  /** Monthly input plus output token allowance for authenticated report chat. */
  chatTokenLimit: number
  stripePriceId?: string
  projectLimit?: number
  features: readonly string[]
  highlight: boolean
  cta: string
  href: string
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
    auditLimitLabel: '3 product reviews (lifetime)',
    deepReviewLimit: 1,
    deepReviewLimitKind: 'lifetime',
    deepReviewLimitLabel: '1 deep review teaser (lifetime)',
    chatTokenLimit: 25_000,
    features: [
      '3 product reviews (lifetime) with full reports and fix prompts',
      '1 deep review teaser',
      'Update reviews use the same product review credits',
      'Upgrade anytime for more reviews',
    ],
    highlight: false,
    cta: 'Start free',
    href: '/sign-up?from=pricing',
  },
  BUILDER: {
    plan: 'BUILDER',
    name: 'Pro',
    label: 'Pro',
    price: '$69',
    period: '/mo',
    persona: 'Solo builders shipping weekly',
    outcome: 'Finish what your AI started, every week',
    auditLimit: 25,
    auditLimitKind: 'monthly',
    auditLimitLabel: '25 product reviews / month',
    deepReviewLimit: 4,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: '4 deep reviews / month',
    chatTokenLimit: 500_000,
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      '25 product reviews and 4 deep reviews per month',
      'Before/after comparisons',
      'MCP in supported builders',
      'Weekly product watch with regression email',
    ],
    highlight: true,
    cta: 'Start Pro',
    href: '/sign-up?plan=BUILDER',
  },
  TEAM: {
    plan: 'TEAM',
    name: 'Studio',
    label: 'Studio',
    price: '$199',
    period: '/mo',
    persona: 'Agencies and multi-site teams',
    outcome: 'Finish many products, not just one',
    auditLimit: 80,
    auditLimitKind: 'monthly',
    auditLimitLabel: '80 product reviews / month',
    deepReviewLimit: 10,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: '10 deep reviews / month',
    chatTokenLimit: 2_000_000,
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: 5,
    features: [
      'Everything in Pro',
      '80 product reviews and 10 deep reviews per month',
      'Up to 5 projects',
      'GitHub repository scans',

    ],
    highlight: false,
    cta: 'Start Studio',
    href: '/sign-up?plan=TEAM',
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

export function deepReviewLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].deepReviewLimit
}

export function chatTokenLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].chatTokenLimit
}

/**
 * Customer-facing plan name (Free / Pro / Studio). Never render the raw enum
 * (FREE / BUILDER / TEAM): "Builder" and "Team" are internal codes that do not
 * match what users bought, which reads as a billing bug to a paying customer.
 */
export function planLabel(plan: Plan | string): string {
  return PLAN_DEFINITIONS[plan as Plan]?.label ?? PLAN_DEFINITIONS.FREE.label
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
  outcome: 'Volume pricing for teams that need more reviews',
  audits: '500+ / month',
  features: [
    'Everything in Studio',
    'Custom review volume',
    'Talk through your workflow with us',
  ],
  cta: 'Talk to us',
  href: 'mailto:hello@fixflags.com?subject=FixFlags%20high%20volume',
  highlight: false,
  accountModel: 'Talk to us about your workflow.',
} as const
