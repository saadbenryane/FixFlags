import { Prisma, type Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { chatTokenLimitForPlan } from '@/lib/billing/plans'

const CHAT_RESERVATION_TTL_MS = 5 * 60 * 1000

export type ChatAllowance = {
  limit: number
  used: number
  reserved: number
  remaining: number
  resetAt: string
}

type ChatUsageUser = {
  id: string
  plan: Plan
  role: string
  subscriptionStatus: string
}

function effectiveChatPlan(user: ChatUsageUser): Plan {
  if (user.role === 'admin') return 'TEAM'
  if (hasRevokedSubscriptionStatus(user.subscriptionStatus)) return 'FREE'
  return user.plan
}

export function chatUsagePeriod(now = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

function allowanceFromRow(
  row: { limitTokens: number; inputTokens: number; outputTokens: number; reservedTokens: number; periodEnd: Date }
): ChatAllowance {
  const used = row.inputTokens + row.outputTokens
  return {
    limit: row.limitTokens,
    used,
    reserved: row.reservedTokens,
    remaining: Math.max(0, row.limitTokens - used - row.reservedTokens),
    resetAt: row.periodEnd.toISOString(),
  }
}

async function lockUserPeriod(tx: Prisma.TransactionClient, userId: string, periodStart: Date) {
  const key = `chat:${userId}:${periodStart.toISOString()}`
  // pg_advisory_xact_lock returns PostgreSQL `void`. Prisma attempts to
  // deserialize SELECT result columns, so execute it as a statement instead.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
}

async function ensurePeriod(tx: Prisma.TransactionClient, user: ChatUsageUser, now: Date) {
  const { start, end } = chatUsagePeriod(now)
  await lockUserPeriod(tx, user.id, start)
  let period = await tx.chatUsagePeriod.upsert({
    where: { userId_periodStart: { userId: user.id, periodStart: start } },
    create: {
      userId: user.id,
      periodStart: start,
      periodEnd: end,
      limitTokens: chatTokenLimitForPlan(effectiveChatPlan(user)),
    },
    update: {
      periodEnd: end,
      limitTokens: chatTokenLimitForPlan(effectiveChatPlan(user)),
    },
  })
  const stale = await tx.chatUsageReservation.aggregate({
    where: { periodId: period.id, status: 'RESERVED', expiresAt: { lte: now } },
    _sum: { reservedTokens: true },
  })
  const staleTokens = stale._sum.reservedTokens ?? 0
  if (staleTokens > 0) {
    await tx.chatUsageReservation.updateMany({
      where: { periodId: period.id, status: 'RESERVED', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', finalizedAt: now },
    })
    period = await tx.chatUsagePeriod.update({
      where: { id: period.id },
      data: { reservedTokens: { decrement: staleTokens } },
    })
  }
  return period
}

export async function getChatAllowance(user: ChatUsageUser, now = new Date()): Promise<ChatAllowance> {
  return prisma.$transaction(async (tx) => allowanceFromRow(await ensurePeriod(tx, user, now)))
}

export async function reserveChatUsage(
  user: ChatUsageUser,
  requestedTokens: number,
  now = new Date()
): Promise<{ reservationId: string; allowance: ChatAllowance } | { reservationId: null; allowance: ChatAllowance }> {
  return prisma.$transaction(async (tx) => {
    const period = await ensurePeriod(tx, user, now)
    const allowance = allowanceFromRow(period)
    if (allowance.remaining < requestedTokens) return { reservationId: null, allowance }

    const reservation = await tx.chatUsageReservation.create({
      data: {
        periodId: period.id,
        reservedTokens: requestedTokens,
        expiresAt: new Date(now.getTime() + CHAT_RESERVATION_TTL_MS),
      },
    })
    const updated = await tx.chatUsagePeriod.update({
      where: { id: period.id },
      data: { reservedTokens: { increment: requestedTokens } },
    })
    return { reservationId: reservation.id, allowance: allowanceFromRow(updated) }
  })
}

export async function finalizeChatUsage(
  reservationId: string,
  usage: { inputTokens: number; outputTokens: number }
): Promise<ChatAllowance> {
  const inputTokens = Math.max(0, Math.trunc(usage.inputTokens))
  const outputTokens = Math.max(0, Math.trunc(usage.outputTokens))
  return prisma.$transaction(async (tx) => {
    const identity = await tx.chatUsageReservation.findUnique({
      where: { id: reservationId },
      select: {
        period: { select: { userId: true, periodStart: true } },
      },
    })
    if (!identity) throw new Error('Chat usage reservation not found')
    await lockUserPeriod(tx, identity.period.userId, identity.period.periodStart)
    const reservation = await tx.chatUsageReservation.findUnique({
      where: { id: reservationId },
      include: { period: true },
    })
    if (!reservation) throw new Error('Chat usage reservation not found')
    if (reservation.status !== 'RESERVED') return allowanceFromRow(reservation.period)

    await tx.chatUsageReservation.update({
      where: { id: reservationId },
      data: { status: 'FINALIZED', inputTokens, outputTokens, finalizedAt: new Date() },
    })
    const period = await tx.chatUsagePeriod.update({
      where: { id: reservation.periodId },
      data: {
        reservedTokens: { decrement: reservation.reservedTokens },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
      },
    })
    return allowanceFromRow(period)
  })
}

export async function releaseChatUsage(reservationId: string): Promise<void> {
  await finalizeChatUsage(reservationId, { inputTokens: 0, outputTokens: 0 })
}
