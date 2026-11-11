import { Plan } from '@prisma/client'
import { envPriceId, envPriceIds } from '@/lib/billing/env'
import { OPEN_BETA_ACCESS, PLANNED_PAID_PRICING } from '@/lib/billing/beta-policy'

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
    outcome: 'Verified weekly',
    auditLimit: 3,
    auditLimitKind: 'monthly',
    auditLimitLabel: 'Verified weekly',
    deepReviewLimit: UNMETERED_LEGACY_DEPTH,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: 'Path depth included',
    chatTokenLimit: 25_000,
    projectLimit: 1,
    projectLimitLabel: '1 website',
    scheduledReviews: true,
    workspaceSeatLimit: 1,
    workspaceSeatsLabel: '1 seat',
    accountModel: 'One account for one website.',
    features: [
      '1 website',
      'Verified weekly',
      'Flags with evidence and a next step',
      'Verify after you publish',
      'Connections included',
    ],
    reviewDepth: 1,
    highlight: false,
    cta: 'Analyze',
    href: '/new',
  },
  BUILDER: {
    plan: 'BUILDER',
    name: 'Pro',
    label: 'Pro',
    price: PLANNED_PAID_PRICING.BUILDER.price,
    period: PLANNED_PAID_PRICING.BUILDER.period,
    persona: 'One website, checked daily',
    outcome: 'Priced per account with 1 website included',
    auditLimit: 30,
    auditLimitKind: 'monthly',
    auditLimitLabel: 'Daily checks',
    deepReviewLimit: UNMETERED_LEGACY_DEPTH,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: 'Path depth included',
    chatTokenLimit: 500_000,
    projectLimit: 5,
    projectLimitLabel: '1 website included',
    scheduledReviews: true,
    workspaceSeatLimit: 1,
    workspaceSeatsLabel: '1 seat',
    accountModel: 'One account with 1 website included. Extra websites cost a monthly fee.',
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      '1 website included',
      'Daily checks',
      'Flags, evidence, and verify',
      'Connections included',
      'We are not charging yet',
    ],
    reviewDepth: 2,
    highlight: true,
    cta: 'Join waitlist',
    href: '/waitlist/pro',
  },
  // Internal plan TEAM displays as Team (formerly Studio); the id and Stripe price stay.
  TEAM: {
    plan: 'TEAM',
    name: 'Team',
    label: 'Team',
    price: PLANNED_PAID_PRICING.TEAM.price,
    period: PLANNED_PAID_PRICING.TEAM.period,
    persona: 'A few websites that change often',
    outcome: 'Priced per account with 5 websites included',
    auditLimit: 90,
    auditLimitKind: 'monthly',
    auditLimitLabel: 'Daily checks and a check after every deploy',
    deepReviewLimit: UNMETERED_LEGACY_DEPTH,
    deepReviewLimitKind: 'monthly',
    deepReviewLimitLabel: 'Path depth included',
    chatTokenLimit: 2_000_000,
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: null,
    projectLimitLabel: '5 websites included',
    scheduledReviews: true,
    workspaceSeatLimit: null,
    workspaceSeatsLabel: 'Seats confirmed at launch',
    accountModel: 'One account with 5 websites included. Extra websites cost a monthly fee.',
    features: [
      '5 websites included',
      'Daily checks',
      'A check after every deploy',
      'Flags, evidence, and verify',
      'We are not charging yet',
    ],
    reviewDepth: 3,
    highlight: false,
    cta: 'Join waitlist',
    href: '/waitlist/team',
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

export function proUpgradeCta(prefix = 'Join waitlist'): string {
  return prefix
}

export function reviewDepthForPlan(plan: Plan): 1 | 2 | 3 {
  if (OPEN_BETA_ACCESS && plan in PLAN_DEFINITIONS) return 3
  return PLAN_DEFINITIONS[plan]?.reviewDepth ?? 1
}

export function deepReviewLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].deepReviewLimit
}

export function chatTokenLimitForPlan(plan: Plan): number {
  return PLAN_DEFINITIONS[plan].chatTokenLimit
}

/**
 * Customer-facing plan name (Free / Pro / Team). Never render the raw enum
 * (FREE / BUILDER / TEAM): "Builder" is an internal code that does not match
 * what users bought, which reads as a billing bug to a paying customer.
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
