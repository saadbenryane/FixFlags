import { Plan, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
}

// Claude Sonnet 4 approximate rates (USD per million tokens), fallback
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

function estimateSingleModelCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * getInputRatePerMtok(model)
  const outputCost = (outputTokens / 1_000_000) * getOutputRatePerMtok(model)
  return inputCost + outputCost
}

export function estimateLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const models = model.split(',').map((m) => m.trim()).filter(Boolean)
  if (models.length <= 1) {
    return estimateSingleModelCostUsd(model, inputTokens, outputTokens)
  }
  const perModelInput = inputTokens / models.length
  const perModelOutput = outputTokens / models.length
  return models.reduce(
    (sum, m) => sum + estimateSingleModelCostUsd(m, perModelInput, perModelOutput),
    0
  )
}

export interface AuditRunCostMetrics {
  durationMs: number
  llmInputTokens: number
  llmOutputTokens: number
  llmModel: string
  pagespeedCalls: number
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
  const llmCostUsd = estimateLlmCostUsd(
    metrics.llmModel,
    metrics.llmInputTokens,
    metrics.llmOutputTokens
  )
  const infraOverheadUsd = computeInfraOverheadUsd(metrics.pagespeedCalls, metrics.durationMs)
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

export async function sumEstimatedCost(where?: Prisma.AuditRunCostWhereInput): Promise<number> {
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
  const planMap: Record<string, number> = {}
  for (const cost of costs) {
    const audit = await prisma.audit.findUnique({
      where: { id: cost.auditId },
      select: { userId: true },
    })
    if (!audit?.userId) continue
    const user = await prisma.user.findUnique({
      where: { id: audit.userId },
      select: { plan: true },
    })
    if (!user) continue
    const plan = user.plan
    planMap[plan] = (planMap[plan] ?? 0) + (cost._sum.estimatedCostUsd?.toNumber() ?? 0)
  }
  return { FREE: planMap['FREE'] ?? 0, BUILDER: planMap['BUILDER'] ?? 0, TEAM: planMap['TEAM'] ?? 0 }
}

export async function sumRevenueByPlan(_since: Date): Promise<Record<Plan, { subscriptions: number; creditPacks: number; total: number }>> {
  void _since
  const users = await prisma.user.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] } },
    select: { plan: true, stripePriceId: true },
  })
  const subRevenue: Record<string, number> = {}
  for (const user of users) {
    const def = PLAN_DEFINITIONS[user.plan]
    const price = def.price ? Number(def.price.replace('$', '')) : 0
    subRevenue[user.plan] = (subRevenue[user.plan] ?? 0) + price
  }

  return {
    FREE: { subscriptions: subRevenue['FREE'] ?? 0, creditPacks: 0, total: 0 },
    BUILDER: { subscriptions: subRevenue['BUILDER'] ?? 0, creditPacks: 0, total: subRevenue['BUILDER'] ?? 0 },
    TEAM: { subscriptions: subRevenue['TEAM'] ?? 0, creditPacks: 0, total: subRevenue['TEAM'] ?? 0 },
  }
}

export async function getCostOutliers(days: number = 7): Promise<Array<{ auditId: string; domain: string; model: string | null; estimatedCostUsd: number; inputTokens: number; outputTokens: number }>> {
  const since = new Date(Date.now() - days * 86_400_000)
  const costs = await prisma.auditRunCost.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { estimatedCostUsd: 'desc' },
    take: 10,
    include: {
      audit: { select: { url: true, normalizedDomain: true } },
    },
  })
  return costs.map((c) => ({
    auditId: c.auditId,
    domain: c.audit.normalizedDomain ?? c.audit.url,
    model: c.llmModel,
    estimatedCostUsd: c.estimatedCostUsd.toNumber(),
    inputTokens: c.llmInputTokens,
    outputTokens: c.llmOutputTokens,
  }))
}
