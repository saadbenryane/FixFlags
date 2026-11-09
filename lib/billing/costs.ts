import { executionTransaction } from '@/lib/audit/execution-ownership'
import { CostPricingBasis, Prisma } from '@prisma/client'
import { INITIAL_ANALYSIS_PROVIDER_PHASES, sumProviderPhases } from '@/lib/audit/provider-usage'
import { prisma } from '@/lib/db'
import { type LlmUsage } from '@/lib/audit/provider-usage-contract'
import { estimateLlmCostUsd, estimateLlmMeasurementCostUsd } from './provider-pricing'
export { estimateLlmCostUsd, estimateLlmMeasurementCostUsd } from './provider-pricing'

export type LlmCostPhase = 'triage' | 'prescription' | 'full'

export interface AuditRunCostMetrics {
  llmRecordedCostUsd?: number | null
  llmUsageComplete?: boolean
  llmMeasurements?: LlmUsage[]
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

type Measurement = LlmUsage

/** One phase's recorded provider usage together with the price of that usage. */
type PhaseSpend = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  model: string | null
  costUsd: number | null
}

/** Price usage from per-model measurements. A run that used more than one
 * model cannot be priced from a joined model string. */
function priceMeasurements(measurements: readonly Measurement[]): number | null {
  const costs = measurements.map(estimateLlmMeasurementCostUsd)
  return costs.some(cost => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + cost!, 0)
}

function measurementTotals(measurements: readonly Measurement[]) {
  return {
    inputTokens: measurements.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: measurements.reduce((sum, item) => sum + item.outputTokens, 0),
    cacheReadTokens: measurements.reduce((sum, item) => sum + (item.cacheReadTokens ?? 0), 0),
    cacheWriteTokens: measurements.reduce((sum, item) => sum + (item.cacheWriteTokens ?? 0), 0),
    model: [...new Set(measurements.map(item => item.model).filter(Boolean))].join(',') || null,
  }
}

/** The price a phase recorded. A null price means the consumption of that
 * phase is unknown, which is different from a phase that cost nothing. */
function recordedCost(value: Prisma.Decimal | null, basis: CostPricingBasis): number | null {
  return value == null || basis !== 'CONFIGURED_ESTIMATE' && basis !== 'UNPRICED' ? null : value.toNumber()
}

/** The usage a caller measured outside the provider response log. */
function callerSpend(metrics: AuditRunCostMetrics): PhaseSpend {
  const complete = metrics.llmUsageComplete !== false
  if (metrics.llmMeasurements) {
    return { ...measurementTotals(metrics.llmMeasurements),
      costUsd: complete ? metrics.llmRecordedCostUsd !== undefined ? metrics.llmRecordedCostUsd : priceMeasurements(metrics.llmMeasurements) : null }
  }
  return {
    inputTokens: metrics.llmInputTokens,
    outputTokens: metrics.llmOutputTokens,
    cacheReadTokens: metrics.llmCacheReadTokens ?? 0,
    cacheWriteTokens: metrics.llmCacheWriteTokens ?? 0,
    model: metrics.llmModel || null,
    costUsd: complete ? estimateLlmCostUsd(metrics.llmModel, metrics.llmInputTokens, metrics.llmOutputTokens,
      metrics.llmCacheReadTokens ?? 0, metrics.llmCacheWriteTokens ?? 0) : null,
  }
}

/** The provider responses an audit recorded for its initial analysis. A
 * recorded attempt without its response leaves the consumption unknown
 * rather than zero, so the phase stays unpriced. */
async function readLoggedInitialAnalysis(auditId: string): Promise<PhaseSpend | null> {
  const events = await prisma.auditPipelineEvent.findMany({ where: { auditId,
    event: { in: INITIAL_ANALYSIS_PROVIDER_PHASES.flatMap(name => [`${name}_provider_attempt`, `${name}_provider_response`]) } },
    select: { event: true, detail: true } })
  if (!events.length) return null
  const usage = sumProviderPhases(events, INITIAL_ANALYSIS_PROVIDER_PHASES)
  return { ...measurementTotals(usage.measurements), model: usage.model || null,
    costUsd: usage.complete ? usage.estimatedCostUsd : null }
}

export async function persistAuditRunCost(
  auditId: string,
  metrics: AuditRunCostMetrics,
): Promise<void> {
  const phase = metrics.phase ?? 'full'
  const admission = await prisma.audit.findUniqueOrThrow({
    where: { id: auditId },
    select: { planAtAdmission: true },
  })
  // The provider response log is the authoritative record of what an audit
  // spent. The initial analysis owns the triage, journey planner and journey
  // evaluator responses; the prescription phase owns the repair guidance it
  // produced. Each phase writes only its own columns and recomputes the
  // cumulative total from them, so a phase can never erase the spend another
  // phase already recorded.
  const logged = await readLoggedInitialAnalysis(auditId)
  await executionTransaction(async tx => {
    // The Audit lock serializes phase totals for worker and post-settlement writers.
    await tx.$queryRaw`SELECT id FROM audits WHERE id = ${auditId} FOR UPDATE`
    const existing = await tx.auditRunCost.findUnique({ where: { auditId } })
    const prescription = phase === 'prescription'
    const own = prescription
      ? callerSpend(metrics)
      : (logged
          ? { ...logged, costUsd: metrics.llmUsageComplete === false ? null : logged.costUsd }
          : callerSpend(metrics))
    const prior = prescription
      ? (existing
          ? { inputTokens: existing.triageInputTokens, outputTokens: existing.triageOutputTokens,
              model: existing.triageModel, costUsd: recordedCost(existing.triageCostUsd, existing.pricingBasis) }
          : (logged ?? { inputTokens: 0, outputTokens: 0, model: null, costUsd: 0 }))
      : (existing
          ? { inputTokens: existing.prescriptionInputTokens, outputTokens: existing.prescriptionOutputTokens,
              model: existing.prescriptionModel, costUsd: recordedCost(existing.prescriptionCostUsd, existing.pricingBasis) }
          : { inputTokens: 0, outputTokens: 0, model: null, costUsd: 0 })

    const totalLlmCost = prior.costUsd === null || own.costUsd === null ? null : prior.costUsd + own.costUsd
    const durationMs = Math.max(existing?.durationMs ?? 0, metrics.durationMs)
    const pagespeedCalls = Math.max(existing?.pagespeedCalls ?? 0, metrics.pagespeedCalls)
    const estimatedCostUsd = totalLlmCost === null ? null : totalLlmCost + computeInfraOverheadUsd(pagespeedCalls, durationMs)
    const cumulative = {
      durationMs,
      llmInputTokens: prior.inputTokens + own.inputTokens,
      llmOutputTokens: prior.outputTokens + own.outputTokens,
      llmModel: [prior.model, own.model].filter(Boolean).join(',') || null,
      llmCostUsd: decimalCost(totalLlmCost),
      pagespeedCalls,
      estimatedCostUsd: decimalCost(estimatedCostUsd),
      pricingBasis: (estimatedCostUsd === null ? 'UNPRICED' : 'CONFIGURED_ESTIMATE') as CostPricingBasis,
    }
    const phaseColumns = prescription
      ? { prescriptionInputTokens: own.inputTokens, prescriptionOutputTokens: own.outputTokens,
          prescriptionModel: own.model, prescriptionCostUsd: decimalCost(own.costUsd) }
      : { triageInputTokens: own.inputTokens, triageOutputTokens: own.outputTokens,
          triageModel: own.model, triageCostUsd: decimalCost(own.costUsd) }

    if (prescription) {
      // A prescription can be settled without a recorded triage. Its own spend
      // is still recorded, and the initial analysis the log already holds is
      // adopted so that no earlier spend is lost.
      if (existing) {
        await tx.auditRunCost.update({
          where: { auditId },
          data: { ...cumulative, ...phaseColumns },
        })
      } else {
        await tx.auditRunCost.create({
          data: {
            auditId,
            planAtRun: admission.planAtAdmission,
            ...cumulative,
            triageInputTokens: prior.inputTokens, triageOutputTokens: prior.outputTokens,
            triageModel: prior.model, triageCostUsd: decimalCost(prior.costUsd),
            ...phaseColumns,
          },
        })
      }
      return
    }

    await tx.auditRunCost.upsert({
        where: { auditId },
        create: {
          auditId,
          planAtRun: admission.planAtAdmission,
          ...cumulative,
          ...coverageCostFields(metrics),
          ...phaseColumns,
        },
        update: {
          ...cumulative,
          ...coverageCostFields(metrics),
          ...phaseColumns,
        },
      })
  })
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
