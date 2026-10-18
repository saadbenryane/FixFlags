import { executionWrite } from '@/lib/audit/execution-ownership'
import { Prisma } from '@prisma/client'
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

function configuredRate(model: string, side: 'input' | 'output'): number | null {
  const override =
    process.env[side === 'input' ? 'LLM_COST_INPUT_PER_MTOK' : 'LLM_COST_OUTPUT_PER_MTOK']
  const rate =
    override === undefined || override === '' ? MODEL_RATES[model]?.[side] : Number(override)
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 ? rate : null
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
  cacheWriteTokens = 0,
): number | null {
  if ([inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].every((value) => value === 0))
    return 0
  const inputRate = configuredRate(model, 'input')
  const outputRate = configuredRate(model, 'output')
  if (inputRate === null || outputRate === null) return null
  const inputCost = (inputTokens / 1_000_000) * inputRate
  const outputCost = (outputTokens / 1_000_000) * outputRate
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
  cacheWriteTokens = 0,
): number | null {
  if (
    [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    return null
  // A combined token total cannot establish how much each model consumed.
  if (model.split(',').filter((value) => value.trim()).length > 1) return null
  return estimateSingleModelCostUsd(
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  )
}

export type LlmCostPhase = 'triage' | 'prescription' | 'full'

export interface AuditRunCostMetrics {
  llmUsageComplete?: boolean
  llmMeasurements?: Array<{ model: string; inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number }>
  durationMs: number
  llmInputTokens: number
  llmOutputTokens: number
  llmModel: string
  pagespeedCalls: number
  phase?: LlmCostPhase
  pagesReviewed?: number
  openCheckRequests?: number
  /** Prompt-cache tokens served from cache this run (priced at the cache-read rate). */
  llmCacheReadTokens?: number
  /** Prompt-cache tokens written to cache this run (Anthropic 5-min write premium). */
  llmCacheWriteTokens?: number
}

function coverageCostFields(metrics: AuditRunCostMetrics) {
  return {
    ...(typeof metrics.pagesReviewed === 'number' ? { pagesReviewed: metrics.pagesReviewed } : {}),
    ...(typeof metrics.openCheckRequests === 'number'
      ? { openCheckRequests: metrics.openCheckRequests }
      : {}),
  }
}
const PAGESPEED_COST_PER_CALL = Number(process.env.COST_PAGESPEED_PER_CALL ?? 0.005)
const BROWSER_COST_PER_SECOND = Number(process.env.COST_BROWSER_PER_SECOND ?? 0.0001)

export function computeInfraOverheadUsd(pagespeedCalls: number, durationMs: number): number {
  return pagespeedCalls * PAGESPEED_COST_PER_CALL + (durationMs / 1000) * BROWSER_COST_PER_SECOND
}

export async function persistAuditRunCost(
  auditId: string,
  metrics: AuditRunCostMetrics,
): Promise<void> {
  const admission = await prisma.audit.findUniqueOrThrow({
    where: { id: auditId },
    select: { planAtAdmission: true },
  })
  const phase = metrics.phase ?? 'full'
  const aggregateLlmCostUsd = estimateLlmCostUsd(
    metrics.llmModel,
    metrics.llmInputTokens,
    metrics.llmOutputTokens,
    metrics.llmCacheReadTokens ?? 0,
    metrics.llmCacheWriteTokens ?? 0,
  )
  const measuredCosts = metrics.llmMeasurements?.map(item => estimateLlmCostUsd(item.model, item.inputTokens,
    item.outputTokens, item.cacheReadTokens ?? 0, item.cacheWriteTokens ?? 0))
  const llmCostUsd = metrics.llmUsageComplete === false ? null : measuredCosts
    ? measuredCosts.some(cost => cost === null) ? null : measuredCosts.reduce<number>((sum, cost) => sum + cost!, 0)
    : aggregateLlmCostUsd
  const infraOverheadUsd = computeInfraOverheadUsd(metrics.pagespeedCalls, metrics.durationMs)

  if (phase === 'triage') {
    const estimatedCostUsd = llmCostUsd === null ? null : llmCostUsd + infraOverheadUsd
    await executionWrite((tx) =>
      tx.auditRunCost.upsert({
        where: { auditId },
        create: {
          auditId,
          planAtRun: admission.planAtAdmission,
          durationMs: metrics.durationMs,
          llmInputTokens: metrics.llmInputTokens,
          llmOutputTokens: metrics.llmOutputTokens,
          llmModel: metrics.llmModel,
          llmCostUsd: decimalCost(llmCostUsd),
          pagespeedCalls: metrics.pagespeedCalls,
          estimatedCostUsd: decimalCost(estimatedCostUsd),
          pricingBasis: estimatedCostUsd === null ? 'UNPRICED' : 'CONFIGURED_ESTIMATE',
          ...coverageCostFields(metrics),
          triageInputTokens: metrics.llmInputTokens,
          triageOutputTokens: metrics.llmOutputTokens,
          triageModel: metrics.llmModel,
          triageCostUsd: decimalCost(llmCostUsd),
        },
        update: {
          durationMs: metrics.durationMs,
          llmInputTokens: metrics.llmInputTokens,
          llmOutputTokens: metrics.llmOutputTokens,
          llmModel: metrics.llmModel,
          llmCostUsd: decimalCost(llmCostUsd),
          pagespeedCalls: metrics.pagespeedCalls,
          estimatedCostUsd: decimalCost(estimatedCostUsd),
          pricingBasis: estimatedCostUsd === null ? 'UNPRICED' : 'CONFIGURED_ESTIMATE',
          ...coverageCostFields(metrics),
          triageInputTokens: metrics.llmInputTokens,
          triageOutputTokens: metrics.llmOutputTokens,
          triageModel: metrics.llmModel,
          triageCostUsd: decimalCost(llmCostUsd),
        },
      }),
    )
    return
  }

  if (phase === 'prescription') {
    const existing = await prisma.auditRunCost.findUnique({ where: { auditId } })
    if (existing) {
      const triageInput = existing.triageInputTokens
      const triageOutput = existing.triageOutputTokens
      const triageCost =
        existing.pricingBasis === 'CONFIGURED_ESTIMATE'
          ? (existing.triageCostUsd?.toNumber() ?? null)
          : null
      const totalInput = triageInput + metrics.llmInputTokens
      const totalOutput = triageOutput + metrics.llmOutputTokens
      const prescriptionCost = llmCostUsd
      const totalLlmCost =
        triageCost === null || prescriptionCost === null ? null : triageCost + prescriptionCost
      const durationMs = Math.max(existing.durationMs, metrics.durationMs)
      const pagespeedCalls = Math.max(existing.pagespeedCalls, metrics.pagespeedCalls)
      const estimatedCostUsd =
        totalLlmCost === null
          ? null
          : totalLlmCost + computeInfraOverheadUsd(pagespeedCalls, durationMs)

      await executionWrite((tx) =>
        tx.auditRunCost.update({
          where: { auditId },
          data: {
            durationMs,
            llmInputTokens: totalInput,
            llmOutputTokens: totalOutput,
            llmModel: [existing.triageModel, metrics.llmModel].filter(Boolean).join(','),
            llmCostUsd: decimalCost(totalLlmCost),
            pagespeedCalls,
            estimatedCostUsd: decimalCost(estimatedCostUsd),
            pricingBasis: estimatedCostUsd === null ? 'UNPRICED' : 'CONFIGURED_ESTIMATE',
            prescriptionInputTokens: metrics.llmInputTokens,
            prescriptionOutputTokens: metrics.llmOutputTokens,
            prescriptionModel: metrics.llmModel,
            prescriptionCostUsd: decimalCost(prescriptionCost),
          },
        }),
      )
    }
    return
  }

  const estimatedCostUsd = llmCostUsd === null ? null : llmCostUsd + infraOverheadUsd
  await executionWrite((tx) =>
    tx.auditRunCost.upsert({
      where: { auditId },
      create: {
        auditId,
        planAtRun: admission.planAtAdmission,
        durationMs: metrics.durationMs,
        llmInputTokens: metrics.llmInputTokens,
        llmOutputTokens: metrics.llmOutputTokens,
        llmModel: metrics.llmModel,
        llmCostUsd: decimalCost(llmCostUsd),
        pagespeedCalls: metrics.pagespeedCalls,
        estimatedCostUsd: decimalCost(estimatedCostUsd),
        pricingBasis: estimatedCostUsd === null ? 'UNPRICED' : 'CONFIGURED_ESTIMATE',
        ...coverageCostFields(metrics),
      },
      update: {
        durationMs: metrics.durationMs,
        llmInputTokens: metrics.llmInputTokens,
        llmOutputTokens: metrics.llmOutputTokens,
        llmModel: metrics.llmModel,
        llmCostUsd: decimalCost(llmCostUsd),
        pagespeedCalls: metrics.pagespeedCalls,
        estimatedCostUsd: decimalCost(estimatedCostUsd),
        pricingBasis: estimatedCostUsd === null ? 'UNPRICED' : 'CONFIGURED_ESTIMATE',
        ...coverageCostFields(metrics),
      },
    }),
  )
}

export function formatUsd(amount: number | Prisma.Decimal | null | undefined): string {
  if (amount === null || amount === undefined) return 'Not priced'
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
        normalizedDomain,
      },
    },
    _sum: { estimatedCostUsd: true },
  })
  return result._sum.estimatedCostUsd?.toNumber() ?? 0
}

export function decimalCost(value: number): Prisma.Decimal
export function decimalCost(value: number | null): Prisma.Decimal | null
export function decimalCost(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value)
}

export async function getCostOutliers(days: number = 7): Promise<
  Array<{
    auditId: string
    domain: string
    model: string | null
    estimatedCostUsd: number
    inputTokens: number
    outputTokens: number
  }>
> {
  const since = new Date(Date.now() - days * 86_400_000)
  const costs = await prisma.auditRunCost.findMany({
    where: { createdAt: { gte: since }, estimatedCostUsd: { not: null } },
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
    estimatedCostUsd: cost.estimatedCostUsd!.toNumber(),
    inputTokens: cost.llmInputTokens,
    outputTokens: cost.llmOutputTokens,
  }))
}
