import { Plan } from '@prisma/client'
import { envPriceId, envPriceIds } from '@/lib/billing/env'

export type PaidPlan = Exclude<Plan, 'FREE'>

export interface UsageAllowance {
  auditLimit: number
  /** Legacy persistence field. Browser-path depth is unmetered inside Product Reviews. */
  deepReviewLimit: number
}

const UNMETERED_LEGACY_DEPTH = -1

/**
 * The allowance sold with the retired $39/$129 Stripe prices. These values
 * stay price-bound so changing today's plan definitions cannot silently alter
 * an active subscriber's purchase.
 */
export const LEGACY_PRICE_ALLOWANCES: Record<PaidPlan, UsageAllowance> = {
  BUILDER: { auditLimit: 25, deepReviewLimit: UNMETERED_LEGACY_DEPTH },
  TEAM: { auditLimit: 80, deepReviewLimit: UNMETERED_LEGACY_DEPTH },
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
  /** @deprecated Legacy DB compatibility. Not a customer plan allowance. */
  deepReviewLimit: number
  /** @deprecated Legacy DB compatibility. */
  deepReviewLimitKind: 'monthly' | 'lifetime'
  /** @deprecated Legacy DB compatibility. */
  deepReviewLimitLabel: string
  /** Monthly input plus output token allowance for authenticated report chat. */
  chatTokenLimit: number
  stripePriceId?: string
  /** Managed Products available to the account. Null means unlimited. */
  projectLimit: number | null
  projectLimitLabel: string
  scheduledReviews: boolean
  workspaceSeatLimit: number | null
  workspaceSeatsLabel: string
  accountModel: string
  features: readonly string[]
  /** How far a public Product Review fully judges: 1 this page, 2 linked pages, 3 one level beyond. */
  reviewDepth: 1 | 2 | 3
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
    persona: 'One website',
    outcome: '24/7 monitoring, checked every 24 hours',
    auditLimit: 3,
    auditLimitKind: 'monthly',
    auditLimitLabel: 'Every 24 hours',
    deepReviewLimit: UNMETERED_LEGACY_DEPTH,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: 'Path depth included',
    chatTokenLimit: 25_000,
    projectLimit: 1,
    projectLimitLabel: '1 product',
    scheduledReviews: true,
    workspaceSeatLimit: 1,
    workspaceSeatsLabel: '1 seat',
    accountModel: 'One account for one website.',
    features: [
      '1 website',
      '24/7 monitoring',
      'Checked every 24 hours',
      'Flags with evidence and a next step',
      'Verify after you publish',
      'Connections included',
    ],
    reviewDepth: 1,
    highlight: false,
    cta: 'Check my website',
    href: '/new',
  },
  BUILDER: {
    plan: 'BUILDER',
    name: 'Pro',
    label: 'Pro',
    price: '$49',
    period: '/website/mo',
    persona: 'Hourly monitoring per website',
    outcome: '24/7 monitoring, up to every hour',
    auditLimit: 30,
    auditLimitKind: 'monthly',
    auditLimitLabel: 'Up to every hour',
    deepReviewLimit: UNMETERED_LEGACY_DEPTH,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: 'Path depth included',
    chatTokenLimit: 500_000,
    projectLimit: 5,
    projectLimitLabel: 'Pay per website',
    scheduledReviews: true,
    workspaceSeatLimit: 1,
    workspaceSeatsLabel: '1 seat',
    accountModel: 'One account. Pay per website.',
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      '24/7 monitoring',
      'Checked up to every hour',
      'Billed per website',
      'Flags, evidence, and verify',
      'Connections included',
    ],
    reviewDepth: 2,
    highlight: true,
    cta: 'Request a demo',
    href: '/request-demo?plan=pro',
  },
  TEAM: {
    plan: 'TEAM',
    name: 'Studio',
    label: 'Studio',
    price: 'Volume',
    period: '',
    persona: 'Several websites, billed per website',
    outcome: 'Hourly monitoring on a volume quote',
    auditLimit: 90,
    auditLimitKind: 'monthly',
    auditLimitLabel: 'Up to every hour',
    deepReviewLimit: UNMETERED_LEGACY_DEPTH,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: 'Path depth included',
    chatTokenLimit: 2_000_000,
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: null,
    projectLimitLabel: 'Many websites, quoted',
    scheduledReviews: true,
    workspaceSeatLimit: null,
    workspaceSeatsLabel: 'Quoted with the volume',
    accountModel: 'Client websites on one login, billed per website.',
    features: [
      'Hourly monitoring, billed per website',
      'Client websites on one login',
      'Flags, evidence, and verify',
      'Connections included',
      'Volume quoted on a demo',
    ],
    reviewDepth: 3,
    highlight: false,
    cta: 'Request a demo',
    href: '/request-demo?plan=studio',
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

export function proUpgradeCta(prefix = 'Request a demo'): string {
  return prefix
}

export function reviewDepthForPlan(plan: Plan): 1 | 2 | 3 {
  return PLAN_DEFINITIONS[plan]?.reviewDepth ?? 1
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

export function projectLimitForPlan(plan: Plan): number | null {
  return PLAN_DEFINITIONS[plan].projectLimit
}

export function scanLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].auditLimit
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
      products: def.projectLimitLabel,
      accountModel: def.accountModel,
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
  audits: 'More than 90 / month',
  features: [
    'Custom review volume',
    'A product and workspace setup that fits your team',
    'Talk through your workflow with us',
  ],
  cta: 'Talk to us',
  href: 'mailto:hello@fixflags.com?subject=FixFlags%20high%20volume',
  highlight: false,
  accountModel: 'Talk to us about your workflow.',
} as const
