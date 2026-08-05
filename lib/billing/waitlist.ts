import type {
  PaidPlanWaitlistEntry,
  Plan,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_WAITLIST_CAMPAIGN,
  discountTierForPosition,
} from '@/lib/billing/discount-tiers'

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
 * Join the waitlist with an atomic, burst-safe tier snapshot.
 *
 * Concurrency design: a Postgres advisory transaction lock keyed by plan
 * serializes every create for the same plan. Inside the lock we count existing
 * entries and assign the tier from the resulting position (count + 1), so a
 * Product Hunt burst can never overshoot 500 tier-1 / 500 tier-2 per plan.
 * Positions map to joinedAt order because every create runs under the same
 * lock.
 *
 * Re-joins (an existing userId+plan row) update source/campaign/email but never
 * change the tier: the tier is a snapshot at the member's original join time.
 */
export async function upsertPaidPlanWaitlistEntry(
  input: UpsertWaitlistInput
): Promise<PaidPlanWaitlistEntry> {
  const campaign = input.campaign ?? DEFAULT_WAITLIST_CAMPAIGN

  return prisma.$transaction(async (tx) => {
    // Serialize tier assignment per plan; the lock releases at commit.
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
          campaign,
          ...(input.email ? { email: input.email } : {}),
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
        campaign,
        discountTier,
      },
    })
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
