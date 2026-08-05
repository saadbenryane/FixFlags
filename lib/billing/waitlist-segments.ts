import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'

export type WaitlistSegment = 'power_waitlist' | 'power_no_waitlist' | 'waitlist_low_usage' | 'active_free'

export interface WaitlistRow {
  id: string
  userId: string
  /** Email captured at join time; may differ from the account email (SSO). */
  email: string
  accountEmail: string
  name: string | null
  plan: Plan
  joinedAt: Date
  source: string | null
  campaign: string | null
  invitedAt: Date | null
  convertedAt: Date | null
  /** 1 = first 500 (25% off), 2 = next 500 (15% off), null = list price. */
  discountTier: number | null
  founderOfferId: string | null
  auditsUsed: number
  auditsLimit: number
  completedAudits: number
  creditsExhausted: boolean
  segment: WaitlistSegment
}

function segmentForRow(input: {
  onWaitlist: boolean
  auditsUsed: number
  completedAudits: number
  creditsExhausted: boolean
}): WaitlistSegment {
  if (input.onWaitlist) {
    if (input.completedAudits >= 1 || input.creditsExhausted || input.auditsUsed >= 2) {
      return 'power_waitlist'
    }
    return 'waitlist_low_usage'
  }
  if (input.creditsExhausted || input.auditsUsed >= 2) {
    return 'power_no_waitlist'
  }
  return 'active_free'
}

export async function listWaitlistRows(plan?: Plan): Promise<WaitlistRow[]> {
  const entries = await prisma.paidPlanWaitlistEntry.findMany({
    where: plan ? { plan } : { plan: { in: ['BUILDER', 'TEAM'] } },
    orderBy: { joinedAt: 'desc' },
    include: {
      user: {
        select: {
          email: true,
          name: true,
          auditsUsed: true,
          auditsLimit: true,
          plan: true,
          audits: {
            where: { status: 'COMPLETED' },
            select: { id: true },
          },
        },
      },
    },
  })

  return entries.map((entry) => {
    const completedAudits = entry.user.audits.length
    const creditsExhausted =
      entry.user.plan === 'FREE' && entry.user.auditsUsed >= entry.user.auditsLimit
    return {
      id: entry.id,
      userId: entry.userId,
      email: entry.email ?? entry.user.email,
      accountEmail: entry.user.email,
      name: entry.user.name,
      plan: entry.plan,
      joinedAt: entry.joinedAt,
      source: entry.source,
      campaign: entry.campaign,
      invitedAt: entry.invitedAt,
      convertedAt: entry.convertedAt,
      discountTier: entry.discountTier,
      founderOfferId: entry.founderOfferId,
      auditsUsed: entry.user.auditsUsed,
      auditsLimit: entry.user.auditsLimit,
      completedAudits,
      creditsExhausted,
      segment: segmentForRow({
        onWaitlist: true,
        auditsUsed: entry.user.auditsUsed,
        completedAudits,
        creditsExhausted,
      }),
    }
  })
}

export function waitlistRowsToCsv(rows: WaitlistRow[]): string {
  const headers = [
    'email',
    'account_email',
    'name',
    'plan',
    'joined_at',
    'source',
    'campaign',
    'discount_tier',
    'invited_at',
    'converted_at',
    'audits_used',
    'audits_limit',
    'completed_audits',
    'credits_exhausted',
    'segment',
  ]
  const lines = rows.map((row) =>
    [
      row.email,
      row.accountEmail,
      row.name ?? '',
      row.plan,
      row.joinedAt.toISOString(),
      row.source ?? '',
      row.campaign ?? '',
      row.discountTier ?? '',
      row.invitedAt?.toISOString() ?? '',
      row.convertedAt?.toISOString() ?? '',
      String(row.auditsUsed),
      String(row.auditsLimit),
      String(row.completedAudits),
      row.creditsExhausted ? 'yes' : 'no',
      row.segment,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

/** How many members fall in each discount tier for a plan (null = list price). */
export async function waitlistTierCounts(plan: Plan) {
  const [tier1, tier2, noTier] = await Promise.all([
    prisma.paidPlanWaitlistEntry.count({ where: { plan, discountTier: 1 } }),
    prisma.paidPlanWaitlistEntry.count({ where: { plan, discountTier: 2 } }),
    prisma.paidPlanWaitlistEntry.count({ where: { plan, discountTier: null } }),
  ])
  return { tier1, tier2, noTier }
}
