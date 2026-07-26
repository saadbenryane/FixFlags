import { Plan, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // Current models (USD per million tokens, sticker rates).
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-opus-4-8': { input: 5, output: 25 },
  // Legacy / retired IDs kept so historical audit rows still price correctly.
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
}

// Sonnet-tier approximate rates (USD per million tokens), fallback for unknown models.
const DEFAULT_INPUT_RATE = 3
const DEFAULT_OUTPUT_RATE = 15

function getInputRatePerMtok(model: string): number {
  const env = process.env.LLM_COST_INPUT_PER_MTOK
  if (env) return Number(env)
  return MODEL_RATES[model]?.input ?? DEFAULT_INPUT_RATE
}

function getOutputRatePerMtok(model: string): number {
  const env = process.env.LLM_COST_OUTPUT_PER_MTOK
  if (env) return Number(env)
  return MODEL_RATES[model]?.output ?? DEFAULT_OUTPUT_RATE
}

/**
 * Cached-input read multiplier vs. the base input rate.
 * Anthropic serves cache reads at ~0.1x; OpenAI cached input is ~0.5x.
 */
function cacheReadMultiplier(model: string): number {
  return model.includes('claude') ? 0.1 : 0.5
}

/**
 * Cache-write multiplier vs. the base input rate.
 * Anthropic charges 1.25x to write a 5-minute cache entry; OpenAI cache writes are free.
 */
function cacheWriteMultiplier(model: string): number {
  return model.includes('claude') ? 1.25 : 0
}

function estimateSingleModelCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0
): number {
  const inputRate = getInputRatePerMtok(model)
  const inputCost = (inputTokens / 1_000_000) * inputRate
  const outputCost = (outputTokens / 1_000_000) * getOutputRatePerMtok(model)
  const cacheReadCost = (cacheReadTokens / 1_000_000) * inputRate * cacheReadMultiplier(model)
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * inputRate * cacheWriteMultiplier(model)
  return inputCost + outputCost + cacheReadCost + cacheWriteCost
}

/**
 * Estimate LLM spend for a call (or a comma-joined multi-model run).
 *
 * `inputTokens` is the *uncached* input (both providers report this separately
 * from cache reads/writes). Pass cache tokens so the estimate reflects the
 * ~0.1x (Anthropic) / ~0.5x (OpenAI) discount instead of full input price.
 */
export function estimateLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0
): number {
  const models = model.split(',').map((m) => m.trim()).filter(Boolean)
  if (models.length <= 1) {
    return estimateSingleModelCostUsd(
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens
    )
  }
  const perModelInput = inputTokens / models.length
  const perModelOutput = outputTokens / models.length
  const perModelCacheRead = cacheReadTokens / models.length
  const perModelCacheWrite = cacheWriteTokens / models.length
  return models.reduce(
    (sum, m) =>
      sum +
      estimateSingleModelCostUsd(
        m,
        perModelInput,
        perModelOutput,
        perModelCacheRead,
        perModelCacheWrite
      ),
    0
  )
}

export type LlmCostPhase = 'triage' | 'prescription' | 'full'

export interface AuditRunCostMetrics {
  durationMs: number
  llmInputTokens: number
  llmOutputTokens: number
  llmModel: string
  pagespeedCalls: number
  phase?: LlmCostPhase
  /** Prompt-cache tokens served from cache this run (priced at the cache-read rate). */
  llmCacheReadTokens?: number
  /** Prompt-cache tokens written to cache this run (Anthropic 5-min write premium). */
  llmCacheWriteTokens?: number
}

const PAGESPEED_COST_PER_CALL = Number(process.env.COST_PAGESPEED_PER_CALL ?? 0.005)
const BROWSER_COST_PER_SECOND = Number(process.env.COST_BROWSER_PER_SECOND ?? 0.0001)

export function computeInfraOverheadUsd(pagespeedCalls: number, durationMs: number): number {
  return pagespeedCalls * PAGESPEED_COST_PER_CALL + (durationMs / 1000) * BROWSER_COST_PER_SECOND
}

export async function persistAuditRunCost(
  auditId: string,
  metrics: AuditRunCostMetrics
): Promise<void> {
  const phase = metrics.phase ?? 'full'
  const llmCostUsd = estimateLlmCostUsd(
    metrics.llmModel,
    metrics.llmInputTokens,
    metrics.llmOutputTokens,
    metrics.llmCacheReadTokens ?? 0,
    metrics.llmCacheWriteTokens ?? 0
  )
  const infraOverheadUsd = computeInfraOverheadUsd(metrics.pagespeedCalls, metrics.durationMs)

  if (phase === 'triage') {
    const estimatedCostUsd = llmCostUsd + infraOverheadUsd
    await prisma.auditRunCost.upsert({
      where: { auditId },
      create: {
        auditId,
        durationMs: metrics.durationMs,
        llmInputTokens: metrics.llmInputTokens,
        llmOutputTokens: metrics.llmOutputTokens,
        llmModel: metrics.llmModel,
        llmCostUsd: new Prisma.Decimal(llmCostUsd),
        pagespeedCalls: metrics.pagespeedCalls,
        estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd),
        triageInputTokens: metrics.llmInputTokens,
        triageOutputTokens: metrics.llmOutputTokens,
        triageModel: metrics.llmModel,
        triageCostUsd: new Prisma.Decimal(llmCostUsd),
      },
      update: {
        durationMs: metrics.durationMs,
        llmInputTokens: metrics.llmInputTokens,
        llmOutputTokens: metrics.llmOutputTokens,
        llmModel: metrics.llmModel,
        llmCostUsd: new Prisma.Decimal(llmCostUsd),
        pagespeedCalls: metrics.pagespeedCalls,
        estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd),
        triageInputTokens: metrics.llmInputTokens,
        triageOutputTokens: metrics.llmOutputTokens,
        triageModel: metrics.llmModel,
        triageCostUsd: new Prisma.Decimal(llmCostUsd),
      },
    })
    return
  }

  if (phase === 'prescription') {
    const existing = await prisma.auditRunCost.findUnique({ where: { auditId } })
    if (existing) {
      const triageInput = existing.triageInputTokens
      const triageOutput = existing.triageOutputTokens
      const triageCost = existing.triageCostUsd.toNumber()
      const totalInput = triageInput + metrics.llmInputTokens
      const totalOutput = triageOutput + metrics.llmOutputTokens
      const prescriptionCost = llmCostUsd
      const totalLlmCost = triageCost + prescriptionCost
      const durationMs = Math.max(existing.durationMs, metrics.durationMs)
      const pagespeedCalls = Math.max(existing.pagespeedCalls, metrics.pagespeedCalls)
      const estimatedCostUsd =
        totalLlmCost + computeInfraOverheadUsd(pagespeedCalls, durationMs)

      await prisma.auditRunCost.update({
        where: { auditId },
        data: {
          durationMs,
          llmInputTokens: totalInput,
          llmOutputTokens: totalOutput,
          llmModel: [existing.triageModel, metrics.llmModel].filter(Boolean).join(','),
          llmCostUsd: new Prisma.Decimal(totalLlmCost),
          pagespeedCalls,
          estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd),
          prescriptionInputTokens: metrics.llmInputTokens,
          prescriptionOutputTokens: metrics.llmOutputTokens,
          prescriptionModel: metrics.llmModel,
          prescriptionCostUsd: new Prisma.Decimal(prescriptionCost),
        },
      })
    }
    return
  }

  const estimatedCostUsd = llmCostUsd + infraOverheadUsd
  await prisma.auditRunCost.upsert({
    where: { auditId },
    create: {
      auditId,
      durationMs: metrics.durationMs,
      llmInputTokens: metrics.llmInputTokens,
      llmOutputTokens: metrics.llmOutputTokens,
      llmModel: metrics.llmModel,
      llmCostUsd: new Prisma.Decimal(llmCostUsd),
      pagespeedCalls: metrics.pagespeedCalls,
      estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd),
    },
    update: {
      durationMs: metrics.durationMs,
      llmInputTokens: metrics.llmInputTokens,
      llmOutputTokens: metrics.llmOutputTokens,
      llmModel: metrics.llmModel,
      llmCostUsd: new Prisma.Decimal(llmCostUsd),
      pagespeedCalls: metrics.pagespeedCalls,
      estimatedCostUsd: new Prisma.Decimal(estimatedCostUsd),
    },
  })
}

export function formatUsd(amount: number | Prisma.Decimal): string {
  const value = typeof amount === 'number' ? amount : amount.toNumber()
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

export async function sumEstimatedCost(
  where?: Prisma.AuditRunCostWhereInput
): Promise<number> {
  const result = await prisma.auditRunCost.aggregate({
    where,
    _sum: { estimatedCostUsd: true },
  })
  return result._sum.estimatedCostUsd?.toNumber() ?? 0
}

/** Sum estimated run cost for completed audits on a domain. */
export async function sumEstimatedCostForDomain(normalizedDomain: string): Promise<number> {
  const result = await prisma.auditRunCost.aggregate({
    where: {
      audit: {
        status: 'COMPLETED',
        OR: [{ normalizedDomain }, { url: { contains: normalizedDomain } }],
      },
    },
    _sum: { estimatedCostUsd: true },
  })
  return result._sum.estimatedCostUsd?.toNumber() ?? 0
}

export function decimalCost(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

export async function sumEstimatedCostByPlan(since: Date): Promise<Record<Plan, number>> {
  const costs = await prisma.auditRunCost.groupBy({
    by: ['auditId'],
    where: { createdAt: { gte: since } },
    _sum: { estimatedCostUsd: true },
  })
  if (costs.length === 0) return { FREE: 0, BUILDER: 0, TEAM: 0 }

  const auditIds = costs.map((c) => c.auditId)
  const audits = await prisma.audit.findMany({
    where: { id: { in: auditIds } },
    select: { id: true, userId: true },
  })
  const userIds = [...new Set(audits.map((a) => a.userId).filter(Boolean))] as string[]
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, plan: true },
      })
    : []
  const userPlanMap = new Map(users.map((u) => [u.id, u.plan]))
  const auditUserMap = new Map(audits.map((a) => [a.id, a.userId]))

  const planMap: Record<string, number> = {}
  for (const cost of costs) {
    const userId = auditUserMap.get(cost.auditId)
    if (!userId) continue
    const plan = userPlanMap.get(userId)
    if (!plan) continue
    planMap[plan] = (planMap[plan] ?? 0) + (cost._sum.estimatedCostUsd?.toNumber() ?? 0)
  }
  return {
    FREE: planMap.FREE ?? 0,
    BUILDER: planMap.BUILDER ?? 0,
    TEAM: planMap.TEAM ?? 0,
  }
}

const PLAN_MONTHLY_PRICE: Record<Plan, number> = {
  FREE: 0,
  BUILDER: 39,
  TEAM: 129,
}

export async function sumRevenueByPlan(since: Date): Promise<Record<Plan, { subscriptions: number; creditPacks: number; total: number }>> {
  const activeUsers = await prisma.user.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] } },
    select: { plan: true },
  })

  const subRevenue: Record<string, number> = {}
  for (const user of activeUsers) {
    subRevenue[user.plan] = (subRevenue[user.plan] ?? 0) + PLAN_MONTHLY_PRICE[user.plan]
  }

  const creditPurchases = await prisma.creditPurchase.findMany({
    where: { status: 'PAID', paidAt: { gte: since } },
    select: { userId: true, priceUsdCents: true },
  })

  const userIds = [...new Set(creditPurchases.map((p) => p.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, plan: true },
  })
  const userPlanMap = new Map(users.map((u) => [u.id, u.plan]))

  const creditRevenueMap: Record<string, number> = {}
  for (const purchase of creditPurchases) {
    const plan = userPlanMap.get(purchase.userId)
    if (!plan) continue
    creditRevenueMap[plan] = (creditRevenueMap[plan] ?? 0) + purchase.priceUsdCents / 100
  }

  const zero = { subscriptions: 0, creditPacks: 0, total: 0 }
  const result = {
    FREE: { ...zero },
    BUILDER: { ...zero },
    TEAM: { ...zero },
  } as Record<Plan, { subscriptions: number; creditPacks: number; total: number }>

  for (const plan of Object.keys(subRevenue) as Plan[]) {
    const subs = subRevenue[plan] ?? 0
    const credits = creditRevenueMap[plan] ?? 0
    result[plan] = { subscriptions: subs, creditPacks: credits, total: subs + credits }
  }

  for (const plan of Object.keys(creditRevenueMap) as Plan[]) {
    if (!result[plan]) {
      result[plan] = { subscriptions: 0, creditPacks: creditRevenueMap[plan], total: creditRevenueMap[plan] }
    }
  }

  return result
}

export async function getCostOutliers(
  days: number = 7
): Promise<Array<{
  auditId: string
  domain: string
  model: string | null
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
}>> {
  const since = new Date(Date.now() - days * 86_400_000)
  const costs = await prisma.auditRunCost.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { estimatedCostUsd: 'desc' },
    take: 10,
    include: {
      audit: { select: { url: true, normalizedDomain: true } },
    },
  })
  return costs.map((cost) => ({
    auditId: cost.auditId,
    domain: cost.audit.normalizedDomain ?? cost.audit.url,
    model: cost.llmModel,
    estimatedCostUsd: cost.estimatedCostUsd.toNumber(),
    inputTokens: cost.llmInputTokens,
    outputTokens: cost.llmOutputTokens,
  }))
}
