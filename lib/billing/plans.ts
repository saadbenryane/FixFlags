import { Plan } from '@prisma/client'
import { envPriceId, envPriceIds } from '@/lib/billing/env'

export type PaidPlan = Exclude<Plan, 'FREE'>

export interface UsageAllowance {
  auditLimit: number
  deepReviewLimit: number
}

/**
 * The allowance sold with the retired $39/$129 Stripe prices. These values
 * stay price-bound so changing today's plan definitions cannot silently alter
 * an active subscriber's purchase.
 */
export const LEGACY_PRICE_ALLOWANCES: Record<PaidPlan, UsageAllowance> = {
  BUILDER: { auditLimit: 25, deepReviewLimit: 4 },
  TEAM: { auditLimit: 80, deepReviewLimit: 10 },
}

export interface PlanDefinition {
  plan: Plan
  name: string
  label: string
  price: string
  period: string
  persona: string
  outcome: string
  /** Product review cap for each monthly usage period. */
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
    auditLimitKind: 'monthly',
    auditLimitLabel: '3 product reviews / month',
    deepReviewLimit: 1,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: '1 deep review / month',
    chatTokenLimit: 25_000,
    projectLimit: 5,
    features: [
      '3 product reviews and 1 deep review per month',
      'Full reports and fix prompts',
      'Update reviews use the same product review credits',
      'History, sharing, comparisons, Canvas, and Watch',
    ],
    highlight: false,
    cta: 'Start free',
    href: '/sign-up?from=pricing',
  },
  BUILDER: {
    plan: 'BUILDER',
    name: 'Pro',
    label: 'Pro',
    price: '$29',
    period: '/mo',
    persona: 'Solo builders shipping weekly',
    outcome: 'Finish what your AI started, every week',
    auditLimit: 15,
    auditLimitKind: 'monthly',
    auditLimitLabel: '15 product reviews / month',
    deepReviewLimit: 3,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: '3 deep reviews / month',
    chatTokenLimit: 500_000,
    projectLimit: 5,
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      '15 product reviews and 3 deep reviews per month',
      'Full reports and fix prompts',
      'Update reviews use the same product review credits',
      'History, sharing, comparisons, Canvas, and Watch',
    ],
    highlight: true,
    cta: 'Start Pro',
    href: '/sign-up?plan=BUILDER',
  },
  TEAM: {
    plan: 'TEAM',
    name: 'Studio',
    label: 'Studio',
    price: '$79',
    period: '/mo',
    persona: 'Agencies and multi-site teams',
    outcome: 'Finish many products, across teams and releases',
    auditLimit: 50,
    auditLimitKind: 'monthly',
    auditLimitLabel: '50 product reviews / month',
    deepReviewLimit: 10,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: '10 deep reviews / month',
    chatTokenLimit: 2_000_000,
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: 5,
    features: [
      '50 product reviews and 10 deep reviews per month',
      'Full reports and fix prompts',
      'Update reviews use the same product review credits',
      'History, sharing, comparisons, Canvas, and Watch',
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
  return PLAN_DEFINITIONS[plan].projectLimit ?? PLAN_DEFINITIONS.FREE.projectLimit!
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const def of Object.values(PLAN_DEFINITIONS)) {
    if (def.stripePriceId === priceId) return def.plan
  }
  if (envPriceIds('STRIPE_LEGACY_BUILDER_PRICE_IDS').includes(priceId)) return 'BUILDER'
  if (envPriceIds('STRIPE_LEGACY_TEAM_PRICE_IDS').includes(priceId)) return 'TEAM'
  return null
}

export function usageAllowanceForPriceId(
  priceId: string
): (UsageAllowance & { plan: PaidPlan; legacy: boolean }) | null {
  for (const plan of ['BUILDER', 'TEAM'] as const) {
    if (PLAN_DEFINITIONS[plan].stripePriceId === priceId) {
      return {
        plan,
        auditLimit: PLAN_DEFINITIONS[plan].auditLimit,
        deepReviewLimit: PLAN_DEFINITIONS[plan].deepReviewLimit,
        legacy: false,
      }
    }
  }

  if (envPriceIds('STRIPE_LEGACY_BUILDER_PRICE_IDS').includes(priceId)) {
    return { plan: 'BUILDER', ...LEGACY_PRICE_ALLOWANCES.BUILDER, legacy: true }
  }
  if (envPriceIds('STRIPE_LEGACY_TEAM_PRICE_IDS').includes(priceId)) {
    return { plan: 'TEAM', ...LEGACY_PRICE_ALLOWANCES.TEAM, legacy: true }
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
