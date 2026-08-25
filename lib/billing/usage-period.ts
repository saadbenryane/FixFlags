import type { Plan, Prisma, SubscriptionStatus, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  deepReviewLimitForPlan,
  scanLimitForPlan,
  usageAllowanceForPriceId,
} from '@/lib/billing/plans'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

type UsagePeriodUser = Pick<
  User,
  | 'id'
  | 'role'
  | 'plan'
  | 'subscriptionStatus'
  | 'stripePriceId'
  | 'stripeCurrentPeriodStart'
  | 'stripeCurrentPeriodEnd'
  | 'usagePeriodStart'
  | 'usagePeriodEnd'
  | 'auditsUsed'
  | 'auditsLimit'
  | 'deepReviewsUsed'
  | 'deepReviewsLimit'
>

export interface UsagePeriod {
  start: Date
  end: Date
}

export function calendarMonthUtc(now = new Date()): UsagePeriod {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

function isLivePaidPeriod(user: UsagePeriodUser, now: Date): boolean {
  return (
    user.plan !== 'FREE' &&
    (user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'TRIALING') &&
    user.stripeCurrentPeriodStart !== null &&
    user.stripeCurrentPeriodEnd !== null &&
    user.stripeCurrentPeriodStart <= now &&
    user.stripeCurrentPeriodEnd > now
  )
}

export function expectedUsagePeriod(user: UsagePeriodUser, now = new Date()): UsagePeriod {
  if (isLivePaidPeriod(user, now)) {
    return {
      start: user.stripeCurrentPeriodStart!,
      end: user.stripeCurrentPeriodEnd!,
    }
  }
  return calendarMonthUtc(now)
}

function sameInstant(left: Date | null | undefined, right: Date): boolean {
  return left?.getTime() === right.getTime()
}

function usageLimits(
  user: Pick<
    UsagePeriodUser,
    'role' | 'plan' | 'stripePriceId' | 'auditsLimit' | 'deepReviewsLimit'
  >,
  plan = user.plan,
  priceId = user.stripePriceId
): UsageAllowance {
  if (user.role === 'admin') {
    return { auditLimit: UNLIMITED_SCAN_LIMIT, deepReviewLimit: UNLIMITED_SCAN_LIMIT }
  }

  const priceAllowance = priceId ? usageAllowanceForPriceId(priceId) : null
  if (priceAllowance?.plan === plan) {
    return priceAllowance
  }

  // An already-attached paid price can predate the configured legacy lists.
  // Its persisted limits are the durable purchase record; preserve them until
  // Stripe reports a price change or cancellation.
  if (plan !== 'FREE' && priceId) {
    return { auditLimit: user.auditsLimit, deepReviewLimit: user.deepReviewsLimit }
  }

  return {
    auditLimit: scanLimitForPlan(plan),
    deepReviewLimit: deepReviewLimitForPlan(plan),
  }
}

/**
 * Roll both usage pools under a transaction-scoped user lock. Every admission
 * and completion path calls this before reading counters, so a month boundary
 * cannot race with a concurrent Review.
 */
export async function rollUserUsagePeriod(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date()
): Promise<UsagePeriodUser | null> {
  if (typeof tx.$executeRaw === 'function') {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`fixflags:usage-period:${userId}`}, 0))
    `
  }

  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user) return null
  // Narrow unit-test transaction doubles may omit newly-added persistence
  // fields. Real Prisma User rows always contain these non-null columns.
  if (!user.usagePeriodStart || !user.usagePeriodEnd || !user.plan) return user

  const period = expectedUsagePeriod(user, now)
  const { auditLimit, deepReviewLimit } = usageLimits(user)
  const periodChanged =
    !sameInstant(user.usagePeriodStart, period.start) ||
    !sameInstant(user.usagePeriodEnd, period.end)
  const limitsChanged =
    user.auditsLimit !== auditLimit || user.deepReviewsLimit !== deepReviewLimit

  if (!periodChanged && !limitsChanged) return user

  return tx.user.update({
    where: { id: userId },
    data: {
      usagePeriodStart: period.start,
      usagePeriodEnd: period.end,
      auditsLimit: auditLimit,
      deepReviewsLimit: deepReviewLimit,
      ...(periodChanged ? { auditsUsed: 0, deepReviewsUsed: 0 } : {}),
    },
  })
}

export async function refreshUserUsagePeriod(
  userId: string,
  now = new Date()
): Promise<UsagePeriodUser | null> {
  let conflicts = 0
  while (true) {
    try {
      return await prisma.$transaction(
        (tx) => rollUserUsagePeriod(tx, userId, now),
        { isolationLevel: 'Serializable' }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034' &&
        conflicts < 2
      ) {
        conflicts++
        continue
      }
      throw error
    }
  }
}

/** Exact Stripe bounds are persisted before normal rolling so paid usage follows renewal. */
export async function setStripeUsagePeriod(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    plan: Plan
    status: SubscriptionStatus
    priceId: string | null
    start: Date | null
    end: Date | null
  },
  now = new Date()
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`fixflags:usage-period:${input.userId}`}, 0))
  `
  const current = await tx.user.findUnique({ where: { id: input.userId } })
  if (!current) return

  const livePaid =
    input.plan !== 'FREE' &&
    (input.status === 'ACTIVE' || input.status === 'TRIALING') &&
    input.start !== null &&
    input.end !== null
  const period = livePaid
    ? { start: input.start!, end: input.end! }
    : calendarMonthUtc(now)
  const periodChanged =
    !sameInstant(current.usagePeriodStart, period.start) ||
    !sameInstant(current.usagePeriodEnd, period.end)
  const { auditLimit, deepReviewLimit } = usageLimits(current, input.plan, input.priceId)

  await tx.user.update({
    where: { id: input.userId },
    data: {
      plan: input.plan,
      subscriptionStatus: input.status,
      stripeCurrentPeriodStart: input.start,
      stripeCurrentPeriodEnd: input.end,
      usagePeriodStart: period.start,
      usagePeriodEnd: period.end,
      auditsLimit: auditLimit,
      deepReviewsLimit: deepReviewLimit,
      ...(periodChanged ? { auditsUsed: 0, deepReviewsUsed: 0 } : {}),
    },
  })
}
