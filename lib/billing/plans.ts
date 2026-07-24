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
    auditLimitLabel: '3 new URL checks',
    features: [
      '3 new URL checks with full reports and fix prompts',
      'Unlimited re-checks on reports you own',
      'Upgrade anytime for more new checks',
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
    outcome: 'Prove every fix, audit from your editor',
    auditLimit: 25,
    auditLimitKind: 'monthly',
    auditLimitLabel: '25 / month',
    stripePriceId: envPriceId('STRIPE_BUILDER_PRICE_ID'),
    features: [
      'Before/after comparisons',
      'MCP in supported builders',
      '25 new URL checks per month',
      'Weekly product watch with regression email',
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
    persona: 'Freelancers, agencies, and client-driven teams',
    outcome: 'Send polished client reports with one link',
    auditLimit: 100,
    auditLimitKind: 'monthly',
    auditLimitLabel: '100 / month',
    stripePriceId: envPriceId('STRIPE_TEAM_PRICE_ID'),
    projectLimit: 5,
    features: [
      'Everything in Pro',
      'Client-ready public share links',
      'Up to 5 projects',
      'GitHub repository scans',
      'Draft Fix PRs from repo findings (secrets auto-patch when possible)',
      'Daily product watch with regression email',
    ],
    highlight: false,
    cta: 'Start Agency',
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

/**
 * Customer-facing plan name (Free / Pro / Agency). Never render the raw enum
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
  outcome: 'Volume pricing for teams that need more checks',
  audits: '500+ / month',
  features: [
    'Everything in Agency',
    'Custom audit volume',
    'Talk through your workflow with us',
  ],
  cta: 'Talk to us',
  href: 'mailto:hello@fixflags.com?subject=FixFlags%20high%20volume',
  highlight: false,
  accountModel: 'Talk to us about your workflow.',
} as const
