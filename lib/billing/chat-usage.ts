import { Prisma, type Plan } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { chatTokenLimitForPlan } from '@/lib/billing/plans'
import { hasOpenBetaAccess } from '@/lib/billing/beta-policy'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { estimateLlmCostUsd, priceProviderMeasurement, providerPricingSchema, captureChatGatewayPricing } from '@/lib/billing/provider-pricing'
import { llmUsageSchema, type LlmUsage } from '@/lib/audit/provider-request'
import { serializedProviderInputBound, type ProviderRequestBound } from '@/lib/audit/provider-request-bound'
import { providerBudgetAllocationSchema, reserveProviderBudget, settleProviderBudget } from './provider-budget'
import { getEnv } from '@/lib/env'

const CHAT_RESERVATION_TTL_MS = 5 * 60 * 1000
const legacyProviderReceiptSchema = z.object({ version: z.literal(1), attemptId: z.string().uuid(),
  model: z.string().min(1).max(200), transport: z.enum(['provider', 'gateway']), usage: llmUsageSchema.nullable(),
  estimatedCostUsd: z.number().finite().nonnegative().nullable(), pricedAt: z.string().datetime().nullable(),
}).strict()
const providerReceiptSchema = z.discriminatedUnion('version', [legacyProviderReceiptSchema,
  legacyProviderReceiptSchema.extend({ version: z.literal(2), budget: providerBudgetAllocationSchema,
    request: z.object({ bodySha256: z.string().length(64), bodyBytes: z.number().int().nonnegative(),
      images: z.number().int().nonnegative(), api: z.enum(['chat.completions', 'messages']),
      inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().positive(), maxCostUsd: z.number().finite().nonnegative().nullable(), pricing: providerPricingSchema.nullable() }).strict(),
  }).strict()])
type ProviderReceipt = z.infer<typeof providerReceiptSchema>
type ChatUsage = { inputTokens: number; outputTokens: number; model?: string }

export type ChatAllowance = {
  limit: number | null
  used: number
  reserved: number
  remaining: number | null
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
    limit: row.limitTokens < 0 ? null : row.limitTokens,
    used,
    reserved: row.reservedTokens,
    remaining: row.limitTokens < 0 ? null : Math.max(0, row.limitTokens - used - row.reservedTokens),
    resetAt: row.periodEnd.toISOString(),
  }
}

async function lockUserPeriod(tx: Prisma.TransactionClient, userId: string, periodStart: Date) {
  const key = `chat:${userId}:${periodStart.toISOString()}`
  // pg_advisory_xact_lock returns PostgreSQL `void`. Prisma attempts to
  // deserialize SELECT result columns, so execute it as a statement instead.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
}

async function lockReservation(tx: Prisma.TransactionClient, reservationId: string) {
  const identity = await tx.chatUsageReservation.findUnique({ where: { id: reservationId },
    select: { period: { select: { userId: true, periodStart: true } } } })
  if (!identity) throw new Error('Chat usage reservation not found')
  await lockUserPeriod(tx, identity.period.userId, identity.period.periodStart)
  const current = await tx.chatUsageReservation.findUnique({ where: { id: reservationId }, include: { period: true } })
  if (!current) throw new Error('Chat usage reservation not found')
  return current
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
      limitTokens: hasOpenBetaAccess(user) ? -1 : chatTokenLimitForPlan(effectiveChatPlan(user)),
    },
    update: {
      periodEnd: end,
      limitTokens: hasOpenBetaAccess(user) ? -1 : chatTokenLimitForPlan(effectiveChatPlan(user)),
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
  // Expiry proves only that the request owner disappeared. A dispatched
  // request may have been consumed, so its conservative reservation remains.
  await tx.chatUsageReservation.updateMany({
    where: { periodId: period.id, status: 'REQUESTED', expiresAt: { lte: now } },
    data: { status: 'UNKNOWN', finalizedAt: now },
  })
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
  if (!Number.isSafeInteger(requestedTokens) || requestedTokens <= 0) throw new Error('Chat reservation requires a positive token bound')
  return prisma.$transaction(async (tx) => {
    const period = await ensurePeriod(tx, user, now)
    const allowance = allowanceFromRow(period)
    if (allowance.remaining !== null && allowance.remaining < requestedTokens) return { reservationId: null, allowance }

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
  usage: ChatUsage | null,
  receipt?: ProviderReceipt,
): Promise<ChatAllowance> {
  const tokens = usage ? { inputTokens: Math.trunc(usage.inputTokens), outputTokens: Math.trunc(usage.outputTokens) } : null
  if (tokens && Object.values(tokens).some(value => !Number.isSafeInteger(value) || value < 0))
    throw new Error('Chat usage requires valid nonnegative token counts')
  let recordedUserId: string | null = null
  const allowance = await prisma.$transaction(async (tx) => {
    const reservation = await lockReservation(tx, reservationId)
    if (!['RESERVED', 'REQUESTED', 'UNKNOWN'].includes(reservation.status)) return allowanceFromRow(reservation.period)
    if (receipt) {
      const admitted = providerReceiptSchema.parse(reservation.providerUsage)
      if (admitted.attemptId !== receipt.attemptId || admitted.model !== receipt.model)
        throw new Error('Chat response does not own its admitted provider request')
    }
    if (!tokens) {
      if (reservation.status === 'UNKNOWN') return allowanceFromRow(reservation.period)
      await tx.chatUsageReservation.update({ where: { id: reservationId },
        data: { status: 'UNKNOWN', finalizedAt: new Date(), ...(receipt ? { providerUsage: receipt } : {}) } })
      return allowanceFromRow(reservation.period)
    }
    recordedUserId = reservation.period.userId
    if (receipt?.version === 2) await settleProviderBudget(tx, receipt.budget, receipt.estimatedCostUsd)

    await tx.chatUsageReservation.update({
      where: { id: reservationId },
      data: { status: 'FINALIZED', ...tokens, finalizedAt: new Date(),
        ...(receipt ? { providerUsage: receipt } : {}) },
    })
    const period = await tx.chatUsagePeriod.update({
      where: { id: reservation.periodId },
      data: {
        reservedTokens: { decrement: reservation.reservedTokens },
        inputTokens: { increment: tokens.inputTokens },
        outputTokens: { increment: tokens.outputTokens },
      },
    })
    return allowanceFromRow(period)
  })
  if (recordedUserId && usage?.model && tokens) {
    await recordSiteLifecycleEvent({
      name: 'agent_usage_recorded', idempotencyKey: `agent-usage:${reservationId}`, userId: recordedUserId,
      properties: { ...tokens, model: usage.model,
        estimatedCostUsd: receipt ? receipt.estimatedCostUsd : estimateLlmCostUsd(usage.model, tokens.inputTokens, tokens.outputTokens),
        ...(receipt?.usage ? { provider: receipt.usage.provider, api: receipt.usage.api,
          transport: receipt.transport, serviceTier: receipt.usage.serviceTier, cacheReadTokens: receipt.usage.cacheReadTokens,
          cacheWriteTokens: receipt.usage.cacheWriteTokens } : {}) },
    }).catch(() => undefined)
  }
  return allowance
}

export async function releaseChatUsage(reservationId: string): Promise<void> {
  // Only an undispatched reservation can be released as zero consumption.
  // Taking the same period lock as admission/settlement prevents a late
  // release from erasing an in-flight or unknown attempt.
  await prisma.$transaction(async tx => {
    const reservation = await lockReservation(tx, reservationId)
    if (reservation.status === 'RESERVED') {
      await tx.chatUsageReservation.update({ where: { id: reservationId },
        data: { status: 'FINALIZED', inputTokens: 0, outputTokens: 0, finalizedAt: new Date() } })
      await tx.chatUsagePeriod.update({ where: { id: reservation.periodId },
        data: { reservedTokens: { decrement: reservation.reservedTokens } } })
    } else if (reservation.status === 'REQUESTED') {
      await tx.chatUsageReservation.update({ where: { id: reservationId }, data: { status: 'UNKNOWN', finalizedAt: new Date() } })
    }
  })
}

/** Admission commits before the SDK can send. Consumption is retained before
 * generated text is parsed or a customer reply is published. */
export async function beginChatProviderUsage(reservationId: string, model: string, bound: ProviderRequestBound, siteId: string | null) {
  if (bound.model !== model) throw new Error('Chat request model does not match its admission')
  const receipt = await prisma.$transaction(async tx => {
    const reservation = await lockReservation(tx, reservationId)
    if (reservation.status !== 'RESERVED' || reservation.expiresAt <= new Date())
      throw new Error('Chat provider request was already admitted or its reservation expired')
    if (siteId && !await tx.project.findFirst({ where: { id: siteId, userId: reservation.period.userId,
      deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } }, select: { id: true } }))
      throw new Error('Chat provider request no longer owns its Site')
    const transport = getEnv().CHAT_BASE_URL ? 'gateway' : 'provider'
    const pricing = transport === 'gateway' ? captureChatGatewayPricing(model) : bound.pricing
    // A compatible protocol does not establish a gateway's context window.
    const inputTokens = transport === 'gateway' ? serializedProviderInputBound(bound) : bound.inputTokens
    const maxCostUsd = transport === 'gateway' ? pricing ? (inputTokens * pricing.inputPerMtok
      * Math.max(1, pricing.cacheReadMultiplier, pricing.cacheWriteMultiplier) + bound.outputTokens * pricing.outputPerMtok) / 1_000_000 : null : bound.maxCostUsd
    const budget = await reserveProviderBudget(tx, { runId: `chat:${reservationId}`, siteId }, { ...bound, inputTokens, maxCostUsd, pricing })
    const { model: _model, ...request } = { ...bound, inputTokens, maxCostUsd, pricing }
    void _model
    const receipt = providerReceiptSchema.parse({ version: 2, attemptId: randomUUID(), model,
      transport, usage: null, estimatedCostUsd: null, pricedAt: null, budget, request })
    const admitted = await tx.chatUsageReservation.updateMany({
      where: { id: reservationId, status: 'RESERVED', expiresAt: { gt: new Date() } },
      data: { status: 'REQUESTED', providerUsage: receipt },
    })
    if (admitted.count !== 1) throw new Error('Chat provider request was already admitted or its reservation expired')
    return receipt
  })
  return async (measurement: LlmUsage | null) => {
    const response = providerReceiptSchema.parse({ ...receipt, usage: measurement,
      estimatedCostUsd: measurement && receipt.version === 2 ? priceProviderMeasurement(measurement, receipt.request.pricing) : null,
      pricedAt: measurement ? new Date().toISOString() : null,
    })
    await finalizeChatUsage(reservationId, measurement ? {
      inputTokens: measurement.inputTokens + (measurement.cacheReadTokens ?? 0) + (measurement.cacheWriteTokens ?? 0),
      outputTokens: measurement.outputTokens, model: measurement.model,
    } : null, response)
  }
}
