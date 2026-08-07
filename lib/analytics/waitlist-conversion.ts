import type { Plan, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { TIER_1_CAP, TIER_2_CAP, TIER_PERCENT } from '@/lib/billing/discount-tiers'
import { pct } from '@/lib/admin/date-ranges'

/**
 * Waitlist conversion analytics for the launch promise: how many waitlist
 * signups convert to paid plans, by discount tier, and whether the 500/500
 * discount caps are filling.
 *
 * "Purchased" is derived from Stripe-backed account state (plan + subscription
 * status), matching the checkout webhook's paid-entitlement rule, rather than
 * from the waitlist row's convertedAt stamp alone. convertedAt is written once
 * on first payment and never cleared on cancellation; the Stripe fields reflect
 * the current paid state.
 *
 * Tier snapshot at join time: 1 = first 500 (25% off), 2 = next 500 (15% off),
 * null = list price. Caps are per plan (Pro and Studio each have their own
 * 500/500 slots).
 */

export type WaitlistTier = 1 | 2 | null

export const WAITLIST_TIERS: WaitlistTier[] = [1, 2, null]

export const WAITLIST_PLANS: Plan[] = ['BUILDER', 'TEAM']

/** Tier-2 slot count: positions 501..1000 of each plan (500 slots). */
export const TIER_2_SLOTS = TIER_2_CAP - TIER_1_CAP

export function tierLabel(tier: WaitlistTier): string {
  if (tier === 1) return 'T1 · 25% off'
  if (tier === 2) return 'T2 · 15% off'
  return 'No tier (list)'
}

export function tierShortLabel(tier: WaitlistTier): string {
  if (tier === 1) return 'T1'
  if (tier === 2) return 'T2'
  return 'None'
}

/** Discount percentage per tier (25 or 15), or null for list price. */
export function tierPercent(tier: WaitlistTier): number | null {
  return tier === 1 || tier === 2 ? TIER_PERCENT[tier] : null
}

/** Slot cap per tier: 500 for tier 1, 500 for tier 2, none past the caps. */
export function tierSlotCap(tier: WaitlistTier): number | null {
  if (tier === 1) return TIER_1_CAP
  if (tier === 2) return TIER_2_SLOTS
  return null
}

/**
 * Paid entitlement mirrors the Stripe checkout webhook
 * (app/api/webhooks/stripe/route.ts hasPaidEntitlement): ACTIVE and TRIALING
 * subscriptions hold paid access. PAST_DUE / CANCELED / UNPAID do not count as
 * currently purchased.
 */
export function isPaidSubscription(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'TRIALING'
}

export function isPurchased(user: {
  plan: Plan
  subscriptionStatus: SubscriptionStatus
}): boolean {
  return user.plan !== 'FREE' && isPaidSubscription(user.subscriptionStatus)
}

/** Active use = purchased and at least one completed check (the core loop). */
export function isActiveUser(user: {
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  completedAudits: number
}): boolean {
  return isPurchased(user) && user.completedAudits >= 1
}

export interface WaitlistEntryStats {
  id: string
  /** Email captured at join time; may differ from the account email (SSO). */
  email: string | null
  accountEmail: string
  plan: Plan
  tier: number | null
  joinedAt: Date
  invitedAt: Date | null
  convertedAt: Date | null
  source: string | null
  campaign: string | null
  subscriptionStatus: SubscriptionStatus
  currentPlan: Plan
  completedAudits: number
  purchased: boolean
  active: boolean
}

export interface ConversionRow {
  plan: Plan
  tier: WaitlistTier
  tierLabel: string
  tierPercent: number | null
  signups: number
  invited: number
  purchased: number
  /** Percentage of signups that purchased, rounded to whole percent. */
  conversionRate: number
}

export interface CapRow {
  plan: Plan
  tier: WaitlistTier
  tierLabel: string
  /** Slot cap: 500 for tier 1, 500 for tier 2, null past the caps. */
  cap: number | null
  /** Slots claimed by waitlist members at join time. */
  claimed: number
  /** Remaining capacity, 0 once a tier is full. */
  remaining: number
  /** Fill percentage of the cap, rounded. */
  fillPercent: number
}

export interface FunnelStage {
  key: 'signups' | 'invited' | 'purchased' | 'active'
  label: string
  count: number
  /** Drop from the previous stage (negative = drop-off, 0 for the first stage). */
  delta: number
  /** Percentage of the previous stage that dropped before this one. */
  dropOffPercent: number
}

export interface WaitlistConversionData {
  entries: WaitlistEntryStats[]
  conversionRows: ConversionRow[]
  capRows: CapRow[]
  funnel: FunnelStage[]
}

export function toWaitlistEntryStats(entry: {
  id: string
  email: string | null
  plan: Plan
  joinedAt: Date
  invitedAt: Date | null
  convertedAt: Date | null
  source: string | null
  campaign: string | null
  discountTier: number | null
  user: {
    email: string
    plan: Plan
    subscriptionStatus: SubscriptionStatus
    audits: Array<{ id: string }>
  }
}): WaitlistEntryStats {
  const purchased = isPurchased(entry.user)
  return {
    id: entry.id,
    email: entry.email,
    accountEmail: entry.user.email,
    plan: entry.plan,
    tier: entry.discountTier,
    joinedAt: entry.joinedAt,
    invitedAt: entry.invitedAt,
    convertedAt: entry.convertedAt,
    source: entry.source,
    campaign: entry.campaign,
    subscriptionStatus: entry.user.subscriptionStatus,
    currentPlan: entry.user.plan,
    completedAudits: entry.user.audits.length,
    purchased,
    active: purchased && entry.user.audits.length >= 1,
  }
}

function entriesFor(entries: WaitlistEntryStats[], plan: Plan, tier: WaitlistTier) {
  return entries.filter((entry) => entry.plan === plan && entry.tier === tier)
}

/** Conversion rows per plan x discount tier (signups -> invited -> purchased). */
export function buildConversionRows(entries: WaitlistEntryStats[]): ConversionRow[] {
  const rows: ConversionRow[] = []
  for (const plan of WAITLIST_PLANS) {
    for (const tier of WAITLIST_TIERS) {
      const group = entriesFor(entries, plan, tier)
      const signups = group.length
      const invited = group.filter((entry) => entry.invitedAt !== null).length
      const purchased = group.filter((entry) => entry.purchased).length
      rows.push({
        plan,
        tier,
        tierLabel: tierLabel(tier),
        tierPercent: tierPercent(tier),
        signups,
        invited,
        purchased,
        conversionRate: pct(purchased, signups),
      })
    }
  }
  return rows
}

/** Cap fill status per plan x tier: claimed slots, remaining capacity, fill %. */
export function buildCapRows(entries: WaitlistEntryStats[]): CapRow[] {
  const rows: CapRow[] = []
  for (const plan of WAITLIST_PLANS) {
    for (const tier of WAITLIST_TIERS) {
      const cap = tierSlotCap(tier)
      if (cap === null) continue
      const claimed = entriesFor(entries, plan, tier).length
      rows.push({
        plan,
        tier,
        tierLabel: tierLabel(tier),
        cap,
        claimed,
        remaining: Math.max(0, cap - claimed),
        fillPercent: pct(claimed, cap),
      })
    }
  }
  return rows
}

/**
 * Funnel bottleneck stages: waitlist signup -> invited -> plan purchase ->
 * active use (purchased with at least one completed check).
 */
export function buildFunnel(entries: WaitlistEntryStats[]): FunnelStage[] {
  const counts = {
    signups: entries.length,
    invited: entries.filter((entry) => entry.invitedAt !== null).length,
    purchased: entries.filter((entry) => entry.purchased).length,
    active: entries.filter((entry) => entry.active).length,
  }
  const order: Array<FunnelStage['key']> = ['signups', 'invited', 'purchased', 'active']
  const labels: Record<FunnelStage['key'], string> = {
    signups: 'Waitlist signups',
    invited: 'Invited',
    purchased: 'Purchased plan',
    active: 'Active use (paid + ≥1 check)',
  }
  return order.map((key, index) => {
    const count = counts[key]
    const previous = index === 0 ? count : counts[order[index - 1]]
    const delta = count - previous
    return {
      key,
      label: labels[key],
      count,
      delta,
      dropOffPercent: index === 0 ? 0 : pct(Math.max(0, previous - count), previous),
    }
  })
}

/** Escaped CSV cell, matching the waitlist export convention. */
function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function conversionRowsToCsv(rows: ConversionRow[]): string {
  const headers = [
    'plan',
    'tier',
    'tier_label',
    'discount_percent',
    'signups',
    'invited',
    'purchased',
    'conversion_rate_pct',
  ]
  const lines = rows.map((row) =>
    [
      row.plan,
      row.tier ?? '',
      row.tierLabel,
      row.tierPercent ?? '',
      row.signups,
      row.invited,
      row.purchased,
      row.conversionRate,
    ]
      .map(csvCell)
      .join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

export function capRowsToCsv(rows: CapRow[]): string {
  const headers = ['plan', 'tier', 'tier_label', 'cap', 'claimed', 'remaining', 'fill_percent']
  const lines = rows.map((row) =>
    [row.plan, row.tier ?? '', row.tierLabel, row.cap ?? '', row.claimed, row.remaining, row.fillPercent]
      .map(csvCell)
      .join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

/** Waitlist entries with tier + status, for the CSV export table. */
export function waitlistEntryStatsToCsv(entries: WaitlistEntryStats[]): string {
  const headers = [
    'email',
    'account_email',
    'plan',
    'discount_tier',
    'joined_at',
    'source',
    'campaign',
    'invited_at',
    'converted_at',
    'subscription_status',
    'current_plan',
    'purchased',
    'active',
    'completed_audits',
  ]
  const lines = entries.map((entry) =>
    [
      entry.email ?? '',
      entry.accountEmail,
      entry.plan,
      entry.tier ?? '',
      entry.joinedAt.toISOString(),
      entry.source ?? '',
      entry.campaign ?? '',
      entry.invitedAt?.toISOString() ?? '',
      entry.convertedAt?.toISOString() ?? '',
      entry.subscriptionStatus,
      entry.currentPlan,
      entry.purchased ? 'yes' : 'no',
      entry.active ? 'yes' : 'no',
      entry.completedAudits,
    ]
      .map(csvCell)
      .join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

/**
 * Load every paid-plan waitlist entry with the Stripe-backed account state
 * needed for conversion and cap analytics. Computed in memory so the pure
 * aggregation functions stay trivially testable.
 */
export async function getWaitlistConversionData(): Promise<WaitlistConversionData> {
  const rawEntries = await prisma.paidPlanWaitlistEntry.findMany({
    where: { plan: { in: WAITLIST_PLANS } },
    orderBy: [{ plan: 'asc' }, { joinedAt: 'asc' }],
    include: {
      user: {
        select: {
          email: true,
          plan: true,
          subscriptionStatus: true,
          audits: {
            where: { status: 'COMPLETED' },
            select: { id: true },
          },
        },
      },
    },
  })

  const entries = rawEntries.map(toWaitlistEntryStats)
  return {
    entries,
    conversionRows: buildConversionRows(entries),
    capRows: buildCapRows(entries),
    funnel: buildFunnel(entries),
  }
}
