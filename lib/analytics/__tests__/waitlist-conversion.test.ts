import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  buildCapRows,
  buildConversionRows,
  buildFunnel,
  capRowsToCsv,
  conversionRowsToCsv,
  getWaitlistConversionData,
  isPaidSubscription,
  isPurchased,
  tierLabel,
  tierPercent,
  tierSlotCap,
  toWaitlistEntryStats,
  waitlistEntryStatsToCsv,
  type WaitlistEntryStats,
} from '@/lib/analytics/waitlist-conversion'

vi.mock('@/lib/db', () => ({
  prisma: { paidPlanWaitlistEntry: { findMany: vi.fn() } },
}))

function makeEntry(overrides: Partial<WaitlistEntryStats> = {}): WaitlistEntryStats {
  const base: WaitlistEntryStats = {
    id: 'entry-1',
    email: 'join@example.com',
    accountEmail: 'account@example.com',
    plan: 'BUILDER',
    tier: 1,
    joinedAt: new Date('2026-07-01T00:00:00Z'),
    invitedAt: null,
    convertedAt: null,
    source: null,
    campaign: 'waitlist_launch_2026',
    subscriptionStatus: 'NONE',
    currentPlan: 'FREE',
    completedAudits: 0,
    purchased: false,
    active: false,
  }
  return { ...base, ...overrides }
}

describe('tier helpers', () => {
  it('labels tiers by discount percent and maps slot caps to 500/500', () => {
    expect(tierLabel(1)).toContain('25%')
    expect(tierLabel(2)).toContain('15%')
    expect(tierLabel(null)).toContain('list')
    expect(tierPercent(1)).toBe(25)
    expect(tierPercent(2)).toBe(15)
    expect(tierPercent(null)).toBeNull()
    expect(tierSlotCap(1)).toBe(500)
    expect(tierSlotCap(2)).toBe(500)
    expect(tierSlotCap(null)).toBeNull()
  })
})

describe('paid status helpers', () => {
  it('treats ACTIVE and TRIALING subscriptions as purchased', () => {
    expect(isPaidSubscription('ACTIVE')).toBe(true)
    expect(isPaidSubscription('TRIALING')).toBe(true)
    for (const status of ['NONE', 'PAST_DUE', 'CANCELED', 'UNPAID'] as const) {
      expect(isPaidSubscription(status)).toBe(false)
    }
    expect(isPurchased({ plan: 'BUILDER', subscriptionStatus: 'ACTIVE' })).toBe(true)
    expect(isPurchased({ plan: 'BUILDER', subscriptionStatus: 'TRIALING' })).toBe(true)
    expect(isPurchased({ plan: 'BUILDER', subscriptionStatus: 'CANCELED' })).toBe(false)
    expect(isPurchased({ plan: 'FREE', subscriptionStatus: 'ACTIVE' })).toBe(false)
  })
})

describe('toWaitlistEntryStats', () => {
  it('derives purchased and active from Stripe state plus completed checks', () => {
    const entry = toWaitlistEntryStats({
      id: 'e1',
      email: 'join@example.com',
      plan: 'BUILDER',
      joinedAt: new Date('2026-07-01T00:00:00Z'),
      invitedAt: null,
      convertedAt: new Date('2026-08-01T00:00:00Z'),
      source: null,
      campaign: null,
      discountTier: 1,
      user: {
        email: 'account@example.com',
        plan: 'BUILDER',
        subscriptionStatus: 'ACTIVE',
        audits: [{ id: 'a1' }, { id: 'a2' }],
      },
    })
    expect(entry.purchased).toBe(true)
    expect(entry.active).toBe(true)
    expect(entry.completedAudits).toBe(2)
  })

  it('marks a paid subscription without checks as purchased but not active', () => {
    const entry = toWaitlistEntryStats({
      id: 'e2',
      email: null,
      plan: 'TEAM',
      joinedAt: new Date('2026-07-01T00:00:00Z'),
      invitedAt: null,
      convertedAt: null,
      source: null,
      campaign: null,
      discountTier: null,
      user: {
        email: 'account@example.com',
        plan: 'TEAM',
        subscriptionStatus: 'TRIALING',
        audits: [],
      },
    })
    expect(entry.purchased).toBe(true)
    expect(entry.active).toBe(false)
  })
})

describe('buildConversionRows', () => {
  const entries = [
    makeEntry({ plan: 'BUILDER', tier: 1, purchased: true }),
    makeEntry({ plan: 'BUILDER', tier: 1, purchased: true, invitedAt: new Date() }),
    makeEntry({ plan: 'BUILDER', tier: 1, purchased: false, invitedAt: new Date() }),
    makeEntry({ plan: 'BUILDER', tier: 2, purchased: true }),
    makeEntry({ plan: 'BUILDER', tier: null, purchased: false }),
    makeEntry({ plan: 'TEAM', tier: 1, purchased: true }),
  ]

  it('counts signups, invited, and purchased per plan x tier with rounded conversion', () => {
    const rows = buildConversionRows(entries)
    const proT1 = rows.find((r) => r.plan === 'BUILDER' && r.tier === 1)
    expect(proT1).toMatchObject({ signups: 3, invited: 2, purchased: 2, conversionRate: 67 })
    const proT2 = rows.find((r) => r.plan === 'BUILDER' && r.tier === 2)
    expect(proT2).toMatchObject({ signups: 1, invited: 0, purchased: 1, conversionRate: 100 })
    const proNone = rows.find((r) => r.plan === 'BUILDER' && r.tier === null)
    expect(proNone).toMatchObject({ signups: 1, purchased: 0, conversionRate: 0 })
    const studioT1 = rows.find((r) => r.plan === 'TEAM' && r.tier === 1)
    expect(studioT1).toMatchObject({ signups: 1, purchased: 1, conversionRate: 100 })
    expect(rows).toHaveLength(6)
  })

  it('yields zero conversion rate (not NaN) when a group has no signups', () => {
    const rows = buildConversionRows([makeEntry({ plan: 'BUILDER', tier: 1 })])
    const studioT2 = rows.find((r) => r.plan === 'TEAM' && r.tier === 2)
    expect(studioT2?.signups).toBe(0)
    expect(studioT2?.conversionRate).toBe(0)
  })
})

describe('buildCapRows', () => {
  it('computes claimed, remaining, and fill percent against 500-slot caps', () => {
    const entries = Array.from({ length: 3 }, () => makeEntry({ plan: 'BUILDER', tier: 1 }))
    const rows = buildCapRows(entries)
    const proT1 = rows.find((r) => r.plan === 'BUILDER' && r.tier === 1)
    expect(proT1).toMatchObject({ cap: 500, claimed: 3, remaining: 497, fillPercent: 1 })
    const proT2 = rows.find((r) => r.plan === 'BUILDER' && r.tier === 2)
    expect(proT2).toMatchObject({ cap: 500, claimed: 0, remaining: 500, fillPercent: 0 })
    expect(rows.some((r) => r.tier === null)).toBe(false)
  })

  it('clamps remaining at zero and fill at 100% once a tier is full', () => {
    const entries = Array.from({ length: 500 }, () => makeEntry({ plan: 'BUILDER', tier: 1 }))
    const rows = buildCapRows(entries)
    const proT1 = rows.find((r) => r.plan === 'BUILDER' && r.tier === 1)
    expect(proT1).toMatchObject({ claimed: 500, remaining: 0, fillPercent: 100 })
  })
})

describe('buildFunnel', () => {
  it('shows stage counts and drop-off between waitlist, invite, purchase, and use', () => {
    const entries = [
      makeEntry({ invitedAt: new Date(), purchased: true, active: true }),
      makeEntry({ invitedAt: new Date(), purchased: true, active: false }),
      makeEntry({ invitedAt: new Date(), purchased: false }),
      makeEntry({ invitedAt: null, purchased: false }),
    ]
    const funnel = buildFunnel(entries)
    const byKey = Object.fromEntries(funnel.map((s) => [s.key, s]))
    expect(byKey.signups.count).toBe(4)
    expect(byKey.invited.count).toBe(3)
    expect(byKey.purchased.count).toBe(2)
    expect(byKey.active.count).toBe(1)
    expect(byKey.signups.delta).toBe(0)
    expect(byKey.invited.delta).toBe(-1)
    expect(byKey.invited.dropOffPercent).toBe(25)
    expect(byKey.purchased.delta).toBe(-1)
    expect(byKey.purchased.dropOffPercent).toBe(33)
    expect(byKey.active.delta).toBe(-1)
    expect(byKey.active.dropOffPercent).toBe(50)
  })

  it('handles an empty waitlist without dividing by zero', () => {
    const funnel = buildFunnel([])
    expect(funnel.map((s) => s.count)).toEqual([0, 0, 0, 0])
    expect(funnel.every((s) => s.dropOffPercent === 0)).toBe(true)
  })
})

describe('CSV serializers', () => {
  it('escapes quotes and includes headers for conversion and cap tables', () => {
    const conversionCsv = conversionRowsToCsv(buildConversionRows([makeEntry()]))
    expect(conversionCsv.split('\n')[0]).toBe(
      'plan,tier,tier_label,discount_percent,signups,invited,purchased,conversion_rate_pct'
    )
    const capCsv = capRowsToCsv(buildCapRows([makeEntry()]))
    expect(capCsv.split('\n')[0]).toBe(
      'plan,tier,tier_label,cap,claimed,remaining,fill_percent'
    )
  })

  it('serializes waitlist entries with tier, status, and paid state', () => {
    const csv = waitlistEntryStatsToCsv([
      makeEntry({ email: 'a"b@example.com', purchased: true, active: true }),
    ])
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'email,account_email,plan,discount_tier,joined_at,source,campaign,invited_at,converted_at,subscription_status,current_plan,purchased,active,completed_audits'
    )
    expect(lines[1]).toContain('"a""b@example.com"')
    expect(lines[1]).toContain('"yes"')
  })
})

describe('getWaitlistConversionData (mocked prisma)', () => {
  const mockFindMany = vi.mocked(prisma.paidPlanWaitlistEntry.findMany)

  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it('queries both plans and returns conversion, cap, and funnel aggregates', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'e1',
        email: 'join@example.com',
        plan: 'BUILDER',
        joinedAt: new Date('2026-07-01T00:00:00Z'),
        invitedAt: new Date('2026-08-01T00:00:00Z'),
        convertedAt: new Date('2026-08-10T00:00:00Z'),
        source: null,
        campaign: 'waitlist_launch_2026',
        discountTier: 1,
        user: {
          email: 'account@example.com',
          plan: 'BUILDER',
          subscriptionStatus: 'ACTIVE',
          audits: [{ id: 'a1' }],
        },
      },
      {
        id: 'e2',
        email: 'join2@example.com',
        plan: 'TEAM',
        joinedAt: new Date('2026-07-02T00:00:00Z'),
        invitedAt: null,
        convertedAt: null,
        source: 'ph',
        campaign: 'waitlist_launch_2026',
        discountTier: 2,
        user: {
          email: 'account2@example.com',
          plan: 'FREE',
          subscriptionStatus: 'NONE',
          audits: [],
        },
      },
    ] as never)

    const data = await getWaitlistConversionData()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { plan: { in: ['BUILDER', 'TEAM'] } } })
    )
    expect(data.entries).toHaveLength(2)
    expect(data.entries[0].purchased).toBe(true)
    expect(data.entries[1].purchased).toBe(false)
    const proT1 = data.conversionRows.find((r) => r.plan === 'BUILDER' && r.tier === 1)
    expect(proT1).toMatchObject({ signups: 1, purchased: 1, conversionRate: 100 })
    const studioT2 = data.conversionRows.find((r) => r.plan === 'TEAM' && r.tier === 2)
    expect(studioT2).toMatchObject({ signups: 1, purchased: 0, conversionRate: 0 })
    expect(data.capRows.find((r) => r.plan === 'BUILDER' && r.tier === 1)).toMatchObject({
      claimed: 1,
      remaining: 499,
    })
    expect(data.funnel.find((s) => s.key === 'purchased')?.count).toBe(1)
    expect(data.funnel.find((s) => s.key === 'active')?.count).toBe(1)
  })

  it('returns empty aggregates when no entries exist', async () => {
    mockFindMany.mockResolvedValue([] as never)
    const data = await getWaitlistConversionData()
    expect(data.entries).toHaveLength(0)
    expect(data.conversionRows.every((r) => r.signups === 0)).toBe(true)
    expect(data.capRows.every((r) => r.claimed === 0 && r.remaining === r.cap)).toBe(true)
    expect(data.funnel.every((s) => s.count === 0)).toBe(true)
  })
})
