import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import type { ProviderRequestBound } from '@/lib/audit/provider-request-bound'
import { prisma } from '@/lib/db'

export class ProviderBudgetError extends Error {
  readonly code = 'PROVIDER_BUDGET_UNAVAILABLE'
  constructor(message: string) { super(message); this.name = 'ProviderBudgetError' }
}

const applicationAllocationSchema = z.object({
  keys: z.array(z.string().min(1).max(500)).min(2).max(3),
  reservedMicros: z.number().int().positive().safe(),
  limitsMicros: z.array(z.number().int().positive().safe()).min(2).max(3),
}).strict()
export const providerBudgetAllocationSchema = z.union([applicationAllocationSchema,
  z.object({ mode: z.literal('provider'), keys: z.array(z.string()).length(0),
    reservedMicros: z.literal(0), limitsMicros: z.array(z.number()).length(0) }).strict(),
])
export type ProviderBudgetAllocation = z.infer<typeof providerBudgetAllocationSchema>

function budgetMode(): 'provider' | 'application' {
  const mode = process.env.LLM_BUDGET_MODE ?? 'provider'
  if (mode !== 'provider' && mode !== 'application')
    throw new ProviderBudgetError('LLM_BUDGET_MODE must be provider or application')
  return mode
}

function configuredLimit(name: string): bigint {
  const value = process.env[name]
  // Operational allowances must be explicitly frozen by the operator. They
  // are independent of customer plans and never imply new paid authorization.
  if (!value || !/^\d+(?:\.\d{1,6})?$/.test(value))
    throw new ProviderBudgetError(`Configure ${name} before enabling paid inference`)
  const micros = Number(value) * 1_000_000
  if (!Number.isSafeInteger(Math.round(micros)) || micros <= 0)
    throw new ProviderBudgetError(`Invalid ${name}`)
  return BigInt(Math.round(micros))
}

export function providerBudgetConfiguration() {
  try {
    const mode = budgetMode()
    if (mode === 'provider') return { configured: true, mode }
    return { configured: true, mode, dailyUsd: Number(configuredLimit('LLM_BUDGET_DAILY_USD')) / 1_000_000,
      siteDailyUsd: Number(configuredLimit('LLM_BUDGET_SITE_DAILY_USD')) / 1_000_000,
      runUsd: Number(configuredLimit('LLM_BUDGET_RUN_USD')) / 1_000_000 }
  } catch { return { configured: false, mode: process.env.LLM_BUDGET_MODE ?? 'provider' } }
}

async function lockWindows(tx: Prisma.TransactionClient, keys: readonly string[]) {
  for (const key of [...new Set(keys)].sort())
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`provider-budget:${key}`}, 0))`
}

/** Caller commits this allocation on its existing attempt receipt in the same
 * transaction. Unknown requests keep their allocation until reconciled. */
export async function reserveProviderBudget(tx: Prisma.TransactionClient,
  scope: { runId: string; siteId: string | null }, bound: ProviderRequestBound, now = new Date()): Promise<ProviderBudgetAllocation> {
  // Provider-managed spending is an explicit operating choice. Preserve the
  // owning request/usage receipt without claiming an application dollar cap.
  if (budgetMode() === 'provider') return { mode: 'provider', keys: [], reservedMicros: 0, limitsMicros: [] }
  if (bound.maxCostUsd === null || !Number.isFinite(bound.maxCostUsd) || bound.maxCostUsd < 0)
    throw new ProviderBudgetError('The requested provider/model/tier has no configured price bound')
  const micros = Math.max(1, Math.ceil(bound.maxCostUsd * 1_000_000))
  if (!Number.isSafeInteger(micros)) throw new ProviderBudgetError('Provider request exceeds the supported dollar bound')
  const day = now.toISOString().slice(0, 10)
  const dayEnd = new Date(`${day}T00:00:00.000Z`); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
  const dailyLimit = configuredLimit('LLM_BUDGET_DAILY_USD')
  const siteLimit = configuredLimit('LLM_BUDGET_SITE_DAILY_USD')
  const runLimit = configuredLimit('LLM_BUDGET_RUN_USD')
  const windows = [
    { key: `day:${day}`, limit: dailyLimit, expiresAt: dayEnd },
    { key: `run:${scope.runId}`, limit: runLimit, expiresAt: new Date(now.getTime() + 30 * 86400_000) },
    ...(scope.siteId ? [{ key: `site:${scope.siteId}:${day}`, limit: siteLimit, expiresAt: dayEnd }] : []),
  ]
  await lockWindows(tx, windows.map(window => window.key))
  for (const window of windows) {
    const row = await tx.providerSpendWindow.upsert({ where: { key: window.key },
      create: { key: window.key, expiresAt: window.expiresAt, limitMicros: window.limit }, update: {} })
    if (row.limitMicros !== window.limit)
      throw new ProviderBudgetError('Operational dollar limits differ from the frozen admission window')
    if (row.reservedMicros + row.settledMicros + BigInt(micros) > window.limit)
      throw new ProviderBudgetError('The operational inference budget is fully reserved or consumed')
  }
  for (const window of windows) await tx.providerSpendWindow.update({ where: { key: window.key },
    data: { reservedMicros: { increment: BigInt(micros) } } })
  return { keys: windows.map(window => window.key), reservedMicros: micros, limitsMicros: windows.map(window => Number(window.limit)) }
}

/** Retire only fully settled admission counters. Unknown allocations and their
 * receipts survive ordinary expiry, which cannot establish zero consumption. */
export async function deleteExpiredProviderWindows(now = new Date()) {
  const result = await prisma.providerSpendWindow.deleteMany({ where: { expiresAt: { lt: now }, reservedMicros: BigInt(0) } })
  return result.count
}

/** Call once, guarded by the owning receipt's terminal transition. Pricing
 * failures and lost responses leave the conservative reservation intact. */
export async function settleProviderBudget(tx: Prisma.TransactionClient, allocation: ProviderBudgetAllocation, costUsd: number | null) {
  // Use the admitted mode, even if configuration changed during the request.
  if ('mode' in allocation && allocation.mode === 'provider') return
  if (costUsd === null) return
  if (!Number.isFinite(costUsd) || costUsd < 0 || !Number.isSafeInteger(Math.ceil(costUsd * 1_000_000)))
    throw new ProviderBudgetError('Invalid measured provider cost')
  await lockWindows(tx, allocation.keys)
  const measured = BigInt(Math.ceil(costUsd * 1_000_000))
  for (const key of allocation.keys) {
    const result = await tx.providerSpendWindow.updateMany({ where: { key, reservedMicros: { gte: BigInt(allocation.reservedMicros) } },
      data: { reservedMicros: { decrement: BigInt(allocation.reservedMicros) }, settledMicros: { increment: measured } } })
    if (result.count !== 1) throw new Error('Provider allocation no longer matches its operational window')
  }
}
