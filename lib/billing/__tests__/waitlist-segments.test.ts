import { beforeEach, describe, expect, it, vi } from 'vitest'

const waitlistEntryMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}))
const inviteMock = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    paidPlanWaitlistEntry: waitlistEntryMock,
    waitlistInvite: inviteMock,
  },
}))

import type { WaitlistRow } from '@/lib/billing/waitlist-segments'
import {
  listWaitlistRows,
  waitlistBatchCounts,
  waitlistGrantCounts,
  waitlistRowsToCsv,
  waitlistTierCounts,
} from '@/lib/billing/waitlist-segments'

const USER = {
  email: 'member@example.com',
  name: 'Member',
  auditsUsed: 0,
  auditsLimit: 3,
  plan: 'FREE',
  audits: [],
}

function entry(overrides: Record<string, unknown>) {
  return {
    id: 'entry-1',
    userId: 'user-1',
    email: 'member@example.com',
    plan: 'FREE',
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    source: null,
    campaign: null,
    invitedAt: null,
    convertedAt: null,
    discountTier: null,
    batch: null,
    accessGrantedAt: null,
    founderOfferId: null,
    user: { ...USER },
    ...overrides,
  }
}

describe('listWaitlistRows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inviteMock.findMany.mockResolvedValue([])
  })

  it('segments waitlist members with usage into the power waitlist', async () => {
    waitlistEntryMock.findMany.mockResolvedValue([
      entry({ user: { ...USER, auditsUsed: 3 } }),
      entry({ id: 'e2', userId: 'user-2', user: { ...USER, auditsUsed: 1, auditsLimit: 1 } }),
      entry({
        id: 'e3',
        userId: 'user-3',
        user: { ...USER, audits: [{ id: 'a1' }] },
      }),
      entry({ id: 'e4', userId: 'user-4', user: { ...USER, auditsUsed: 1 } }),
    ])

    const rows = await listWaitlistRows()
    expect(rows.map((r) => r.segment)).toEqual([
      'power_waitlist',
      'power_waitlist',
      'power_waitlist',
      'waitlist_low_usage',
    ])
    expect(rows[0]?.creditsExhausted).toBe(true)
    expect(rows[1]?.creditsExhausted).toBe(true)
    expect(rows[2]?.completedAudits).toBe(1)
    expect(rows[3]?.completedAudits).toBe(0)
  })

  it('falls back to the account email when the join email is missing', async () => {
    waitlistEntryMock.findMany.mockResolvedValue([
      entry({ email: null, user: { ...USER, email: 'account@example.com' } }),
    ])
    const rows = await listWaitlistRows()
    expect(rows[0]?.email).toBe('account@example.com')
    expect(rows[0]?.accountEmail).toBe('account@example.com')
  })

  it('attaches the latest invite code by joined user and pending email', async () => {
    waitlistEntryMock.findMany.mockResolvedValue([
      entry({ id: 'e1', userId: 'user-1', email: 'member@example.com' }),
      entry({ id: 'e2', userId: 'user-2', email: 'other@example.com' }),
    ])
    inviteMock.findMany.mockResolvedValue([
      { joinedUserId: 'user-1', plan: 'FREE', code: 'INV-1', status: 'REDEEMED', inviteeEmail: null },
      {
        joinedUserId: null,
        plan: 'FREE',
        code: 'INV-2',
        status: 'PENDING',
        inviteeEmail: 'other@example.com',
      },
    ])

    const rows = await listWaitlistRows()
    expect(rows[0]?.inviteCode).toBe('INV-1')
    expect(rows[1]?.inviteCode).toBe('INV-2')
  })

  it('filters by plan when requested', async () => {
    waitlistEntryMock.findMany.mockResolvedValue([])
    await listWaitlistRows('TEAM')
    expect(waitlistEntryMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { plan: 'TEAM' } })
    )
  })
})

describe('waitlistRowsToCsv', () => {
  const row: WaitlistRow = {
    id: 'e1',
    userId: 'user-1',
    email: 'member@example.com',
    accountEmail: 'account@example.com',
    name: null,
    plan: 'FREE',
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    source: 'pricing',
    campaign: null,
    invitedAt: null,
    convertedAt: null,
    discountTier: 1,
    batch: 2,
    accessGrantedAt: null,
    inviteCode: 'INV-1',
    founderOfferId: null,
    auditsUsed: 1,
    auditsLimit: 3,
    completedAudits: 0,
    creditsExhausted: false,
    segment: 'waitlist_low_usage',
  }

  it('emits a header row and one line per member', () => {
    const csv = waitlistRowsToCsv([row])
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'email,account_email,name,plan,joined_at,source,campaign,discount_tier,batch,access_granted_at,invite_code,invited_at,converted_at,audits_used,audits_limit,completed_audits,credits_exhausted,segment'
    )
    expect(lines[1]).toContain('member@example.com')
    expect(lines[1]).toContain('INV-1')
    expect(lines[1]).toContain('"1"')
    expect(lines[1]).toContain('"2"')
    expect(lines[1]).toContain('2026-01-01T00:00:00.000Z')
    expect(lines[1]).toContain('no')
    expect(lines[1]).toContain('waitlist_low_usage')
  })

  it('quotes cells and escapes embedded quotes', () => {
    const csv = waitlistRowsToCsv([
      { ...row, email: 'say "hi"@example.com', creditsExhausted: true },
    ])
    expect(csv).toContain('"say ""hi""@example.com"')
    expect(csv).toContain('yes')
  })

  it('renders blank cells for absent optional values', () => {
    const csv = waitlistRowsToCsv([{ ...row, discountTier: null, batch: null, name: null }])
    // Data cells are quoted: name="", plan="FREE", joined_at=..., source="pricing", campaign="", discount_tier="", batch=""
    expect(csv).toContain('"","FREE","2026-01-01T00:00:00.000Z","pricing",""')
  })
})

describe('waitlist admin counts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    waitlistEntryMock.count.mockResolvedValue(2)
  })

  it('counts discount tiers per plan', async () => {
    const counts = await waitlistTierCounts('BUILDER')
    expect(counts).toEqual({ tier1: 2, tier2: 2, noTier: 2 })
    expect(waitlistEntryMock.count).toHaveBeenCalledTimes(3)
  })

  it('counts access batches per plan', async () => {
    const counts = await waitlistBatchCounts('BUILDER')
    expect(counts).toEqual({ batch1: 2, batch2: 2, noBatch: 2 })
  })

  it('counts granted and converted members per plan', async () => {
    const counts = await waitlistGrantCounts('BUILDER')
    expect(counts).toEqual({ granted: 2, grantedBatch1: 2, grantedBatch2: 2, converted: 2 })
  })
})
