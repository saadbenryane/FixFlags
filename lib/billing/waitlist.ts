import type {
  PaidPlanWaitlistEntry,
  Plan,
  Prisma,
  WaitlistInvite,
  WaitlistLead,
} from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import {
  DEFAULT_WAITLIST_CAMPAIGN,
  discountTierForPosition,
} from '@/lib/billing/discount-tiers'
import { isBatchReleased, openBatch } from '@/lib/billing/paid-open'

export type PaidWaitlistPlan = 'BUILDER' | 'TEAM'

export interface UpsertWaitlistInput {
  userId: string
  plan: PaidWaitlistPlan
  /** Captured email at join time; may differ from the account email (SSO private relay). */
  email?: string
  source?: string
  campaign?: string
}

/**
 * Batch sizing for the "first 500, then next 500" launch. Env-overridable via
 * WAITLIST_BATCH_SIZE (default 500). A batch is an ACCESS cohort (who may check
 * out); it is independent of the discount-tier caps in discount-tiers.ts, which
 * stay fixed at 500/500 per plan (Stripe promotion caps). Changing the batch
 * size changes release cohorts, not discount eligibility.
 */
export const DEFAULT_BATCH_SIZE = 500

export function waitlistBatchSize(): number {
  const raw = process.env.WAITLIST_BATCH_SIZE
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE
}

/** Access cohort for a 1-indexed join position per plan: 1, 2, or null past both caps. */
export function batchForPosition(position: number): number | null {
  const size = waitlistBatchSize()
  if (position <= size) return 1
  if (position <= size * 2) return 2
  return null
}

/**
 * Join the waitlist with an atomic, burst-safe tier + batch snapshot.
 *
 * Concurrency design: a Postgres advisory transaction lock keyed by plan
 * serializes every create for the same plan. Inside the lock we count existing
 * entries and assign the tier and access batch from the resulting position
 * (count + 1), so a Product Hunt burst can never overshoot 500 tier-1 / 500
 * tier-2 per plan. Positions map to joinedAt order because every create runs
 * under the same lock.
 *
 * Re-joins (an existing userId+plan row) update source/campaign/email but never
 * change the tier or batch: both are snapshots at the member's original join
 * time.
 */
export async function upsertPaidPlanWaitlistEntry(
  input: UpsertWaitlistInput
): Promise<PaidPlanWaitlistEntry> {
  const campaign = input.campaign ?? DEFAULT_WAITLIST_CAMPAIGN
  const entry = await prisma.$transaction((tx) =>
    claimOrCreateEntry(tx, {
      plan: input.plan,
      userId: input.userId,
      email: input.email,
      source: input.source,
      campaign,
    })
  )
  // Attach-on-signup: if the join email matches an unclaimed pre-account lead
  // (email-only capture or anonymous invite redeem), claim it and carry any
  // invite-granted batch/access onto the entry. Best-effort: a failure here
  // never fails the join.
  if (input.email) {
    await claimWaitlistLead(input.userId, input.email, input.plan)
  }
  return entry
}

interface ClaimOrCreateEntryInput {
  plan: PaidWaitlistPlan
  userId: string
  email?: string
  source?: string
  campaign?: string
  /** Invite-reserved batch override; when provided it wins over join-order batch. */
  batchOverride?: number
  /** Access grant stamped on create (invite redeem). */
  accessGrantedAt?: Date | null
}

/**
 * Shared entry create/claim under the per-plan advisory lock. Used by the plain
 * join and by invite redemption. The lock releases at commit, so tier and batch
 * assignments are exact even under a concurrent burst.
 */
async function claimOrCreateEntry(
  tx: Prisma.TransactionClient,
  input: ClaimOrCreateEntryInput
): Promise<PaidPlanWaitlistEntry> {
  const lockKey = `waitlist_tier:${input.plan}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`

  const existing = await tx.paidPlanWaitlistEntry.findUnique({
    where: { userId_plan: { userId: input.userId, plan: input.plan } },
  })
  if (existing) {
    return tx.paidPlanWaitlistEntry.update({
      where: { id: existing.id },
      data: {
        source: input.source ?? undefined,
        campaign: input.campaign ?? undefined,
        ...(input.email ? { email: input.email } : {}),
        ...(input.batchOverride !== undefined ? { batch: input.batchOverride } : {}),
        ...(input.accessGrantedAt ? { accessGrantedAt: input.accessGrantedAt } : {}),
      },
    })
  }

  const position =
    (await tx.paidPlanWaitlistEntry.count({ where: { plan: input.plan } })) + 1
  const discountTier = discountTierForPosition(position)

  return tx.paidPlanWaitlistEntry.create({
    data: {
      userId: input.userId,
      plan: input.plan,
      email: input.email,
      source: input.source,
      campaign: input.campaign,
      discountTier,
      batch:
        input.batchOverride !== undefined
          ? input.batchOverride
          : batchForPosition(position),
      accessGrantedAt: input.accessGrantedAt ?? null,
    },
  })
}

export async function markWaitlistInvited(entryId: string) {
  return prisma.paidPlanWaitlistEntry.update({
    where: { id: entryId },
    data: { invitedAt: new Date() },
  })
}

export async function markWaitlistConverted(
  userId: string,
  plan: Plan,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  if (plan !== 'BUILDER' && plan !== 'TEAM') return
  await client.paidPlanWaitlistEntry.updateMany({
    where: { userId, plan, convertedAt: null },
    data: { convertedAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Batch access grants
// ---------------------------------------------------------------------------

export interface WaitlistAccessRow {
  batch: number | null
  accessGrantedAt: Date | null
}

/**
 * Checkout eligibility for a waitlist row, applied AFTER the global
 * isPaidOpenServer() master switch:
 * - explicit accessGrantedAt (invite redeem or admin grant) -> allowed
 * - batch released (batch <= WAITLIST_OPEN_BATCH) -> allowed
 * - batch 2 fully open (general release) -> every member allowed (list price
 *   for members beyond the caps)
 * - otherwise blocked (BATCH_ACCESS_REQUIRED)
 *
 * A user with NO waitlist row is governed by the master switch alone (legacy
 * behavior when paid opens globally); the batch model constrains waitlist
 * members, which is the launch cohort.
 */
export function isCheckoutEligible(entry: WaitlistAccessRow | null): boolean {
  if (!entry) return true
  if (entry.accessGrantedAt) return true
  const open = openBatch()
  if (open <= 0) return false
  if (isBatchReleased(entry.batch)) return true
  return open >= 2
}

export async function hasPlanAccessGranted(
  userId: string,
  plan: Plan
): Promise<boolean> {
  const entry = await prisma.paidPlanWaitlistEntry.findUnique({
    where: { userId_plan: { userId, plan } },
    select: { batch: true, accessGrantedAt: true },
  })
  return isCheckoutEligible(entry)
}

/** Explicit per-member grant (admin "Grant access" action). */
export async function grantWaitlistEntryAccess(
  entryId: string
): Promise<PaidPlanWaitlistEntry> {
  return prisma.paidPlanWaitlistEntry.update({
    where: { id: entryId },
    data: { accessGrantedAt: new Date() },
  })
}

/**
 * Bulk grant for a whole cohort: sets accessGrantedAt on every not-yet-granted
 * member of a plan's batch. Returns the number of members newly granted.
 */
export async function grantBatchAccess(
  plan: PaidWaitlistPlan,
  batch: number
): Promise<number> {
  const result = await prisma.paidPlanWaitlistEntry.updateMany({
    where: { plan, batch, accessGrantedAt: null },
    data: { accessGrantedAt: new Date() },
  })
  return result.count
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

/**
 * Create a one-time invite with a unique 8-char URL-safe code (base64url of 6
 * random bytes). Collisions are handled by the unique constraint with a retry.
 */
export async function generateWaitlistInvite(input: {
  inviteeEmail: string
  plan: PaidWaitlistPlan
  batch?: number | null
  inviterUserId?: string | null
}): Promise<WaitlistInvite> {
  const inviteeEmail = input.inviteeEmail.trim().toLowerCase()
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomBytes(6).toString('base64url')
    try {
      return await prisma.waitlistInvite.create({
        data: {
          inviteeEmail,
          plan: input.plan,
          batch: input.batch ?? null,
          inviterUserId: input.inviterUserId ?? null,
          code,
        },
      })
    } catch (error) {
      const code_ = (error as { code?: string } | null)?.code
      if (code_ !== 'P2002') throw error
    }
  }
  throw new Error(`Could not allocate a unique invite code for ${inviteeEmail}`)
}

export type RedeemInviteFailure =
  | 'NOT_FOUND'
  | 'PLAN_MISMATCH'
  | 'REVOKED'
  | 'ALREADY_REDEEMED'
  | 'EMAIL_REQUIRED'

export type RedeemInviteResult =
  | {
      ok: true
      /** The member's waitlist entry (signed-in) or the captured lead (pre-account). */
      entryId: string
      batch: number | null
      accessGrantedAt: Date | null
      /** 'entry' = PaidPlanWaitlistEntry created/claimed, 'lead' = email-only capture. */
      mode: 'entry' | 'lead'
    }
  | { ok: false; reason: RedeemInviteFailure }

/**
 * Redeem a one-time invite code (/join?code=...&plan=...). Grants immediate
 * access: the invitee's waitlist row (or pre-account lead) is created with the
 * invite's batch and accessGrantedAt = now. A signed-in user gets a real
 * PaidPlanWaitlistEntry; an anonymous invitee is captured email-only and the
 * grant is carried onto the entry when the account signs up and joins.
 */
export async function redeemInvite(input: {
  code: string
  plan: PaidWaitlistPlan
  userId?: string
  email?: string
}): Promise<RedeemInviteResult> {
  const invite = await prisma.waitlistInvite.findUnique({
    where: { code: input.code.trim() },
  })
  if (!invite) return { ok: false, reason: 'NOT_FOUND' }
  if (invite.status === 'REVOKED') return { ok: false, reason: 'REVOKED' }
  if (invite.status === 'JOINED') return { ok: false, reason: 'ALREADY_REDEEMED' }
  if (invite.plan !== input.plan) return { ok: false, reason: 'PLAN_MISMATCH' }

  const grantedAt = new Date()
  const { userId, email: redeemEmail } = input

  if (userId) {
    const entry = await prisma.$transaction((tx) =>
      claimOrCreateEntry(tx, {
        plan: input.plan,
        userId,
        email: redeemEmail,
        batchOverride: invite.batch ?? undefined,
        accessGrantedAt: grantedAt,
        source: 'invite',
        campaign: DEFAULT_WAITLIST_CAMPAIGN,
      })
    )
    await prisma.waitlistInvite.update({
      where: { id: invite.id },
      data: { status: 'JOINED', redeemedAt: grantedAt, joinedUserId: userId },
    })
    return {
      ok: true,
      entryId: entry.id,
      batch: entry.batch,
      accessGrantedAt: entry.accessGrantedAt,
      mode: 'entry',
    }
  }

  if (!input.email) return { ok: false, reason: 'EMAIL_REQUIRED' }
  const lead = await upsertWaitlistLead({
    email: input.email,
    plan: input.plan,
    batch: invite.batch ?? null,
    accessGrantedAt: grantedAt,
    source: 'invite',
  })
  await prisma.waitlistInvite.update({
    where: { id: invite.id },
    data: { status: 'JOINED', redeemedAt: grantedAt },
  })
  return {
    ok: true,
    entryId: lead.id,
    batch: lead.batch,
    accessGrantedAt: lead.accessGrantedAt,
    mode: 'lead',
  }
}

// ---------------------------------------------------------------------------
// Pre-account (email-only) capture
// ---------------------------------------------------------------------------

/**
 * Email-only waitlist join for visitors without a session. Creates a
 * WaitlistLead row; when the account signs up and joins, claimWaitlistLead
 * attaches it and carries any invite-granted batch/access onto the real entry.
 */
export async function upsertWaitlistLead(input: {
  email: string
  plan: PaidWaitlistPlan
  source?: string
  campaign?: string
  batch?: number | null
  accessGrantedAt?: Date | null
}): Promise<WaitlistLead> {
  const email = input.email.trim().toLowerCase()
  const campaign = input.campaign ?? DEFAULT_WAITLIST_CAMPAIGN
  const existing = await prisma.waitlistLead.findUnique({
    where: { email_plan: { email, plan: input.plan } },
  })
  if (existing) {
    return prisma.waitlistLead.update({
      where: { id: existing.id },
      data: {
        source: input.source ?? undefined,
        campaign,
        ...(input.batch !== undefined && input.batch !== null
          ? { batch: input.batch }
          : {}),
        ...(input.accessGrantedAt ? { accessGrantedAt: input.accessGrantedAt } : {}),
      },
    })
  }
  return prisma.waitlistLead.create({
    data: {
      email,
      plan: input.plan,
      source: input.source,
      campaign,
      batch: input.batch ?? null,
      accessGrantedAt: input.accessGrantedAt ?? null,
    },
  })
}

export interface ClaimedLeadResult {
  entryId: string
  inheritedBatch: number | null
  accessGranted: boolean
}

/**
 * Attach a pre-account WaitlistLead to an account (attach-on-signup). Call
 * after upsertPaidPlanWaitlistEntry for the same (email, plan): carries any
 * invite-reserved batch and access grant onto the member's real entry, so the
 * invitee never loses their grant between anonymous redeem and signup. Returns
 * null when no unclaimed lead matches.
 */
export async function claimWaitlistLead(
  userId: string,
  email: string,
  plan: PaidWaitlistPlan
): Promise<ClaimedLeadResult | null> {
  // Optional chaining keeps callers test-safe when the prisma client is mocked
  // without a waitlistLead model; production always has it.
  try {
    const normalized = email.trim().toLowerCase()
    const lead =
      (await prisma.waitlistLead?.findFirst({
        where: { email: normalized, plan, status: 'PENDING', claimedUserId: null },
      })) ?? null
    if (!lead) return null

    await prisma.waitlistLead?.update({
      where: { id: lead.id },
      data: { status: 'CLAIMED', claimedUserId: userId, claimedAt: new Date() },
    })

    const entry = await prisma.paidPlanWaitlistEntry.findUnique({
      where: { userId_plan: { userId, plan } },
    })
    // An invite-granted lead explicitly designates the access cohort, so its
    // batch wins over the join-position batch on the entry. Plain pre-account
    // joins have a null lead batch and keep the position-derived batch.
    const needsBatch = lead.batch != null
    const needsGrant =
      lead.accessGrantedAt != null && (entry?.accessGrantedAt ?? null) == null
    if (entry && (needsBatch || needsGrant)) {
      await prisma.paidPlanWaitlistEntry.update({
        where: { id: entry.id },
        data: {
          ...(needsBatch ? { batch: lead.batch } : {}),
          ...(needsGrant ? { accessGrantedAt: lead.accessGrantedAt } : {}),
        },
      })
    }

    return {
      entryId: entry?.id ?? lead.id,
      inheritedBatch: lead.batch,
      accessGranted: Boolean(lead.accessGrantedAt),
    }
  } catch {
    return null
  }
}
