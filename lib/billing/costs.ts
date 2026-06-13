import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

const DEFAULT_LLM_MODEL = 'gpt-4o-mini'

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
}

// Claude Sonnet 4.6 approximate rates (USD per million tokens) — fallback
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

export function estimateLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * getInputRatePerMtok(model)
  const outputCost = (outputTokens / 1_000_000) * getOutputRatePerMtok(model)
  return inputCost + outputCost
}

export interface AuditRunCostMetrics {
  durationMs: number
  llmInputTokens: number
  llmOutputTokens: number
  llmModel: string
  pagespeedCalls: number
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
  const estimatedCostUsd = llmCostUsd

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
