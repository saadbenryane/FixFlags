import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getConfiguredJudgeProviderChain } from './judge-config'
import { isRetryableJudgeError } from './judge'
import { JudgeContractError } from './validate-judge-output'
import { logger } from '@/lib/logger'

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export const MAX_RETRIES = 3
export const RETRY_DELAY_MS = 2000

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  model: string
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RunLlmWithRetryOptions<TInput, TOutput> {
  label: string
  input: TInput
  attemptFn: (provider: string, input: TInput) => Promise<TOutput>
  isRetryable?: (err: unknown) => boolean
}

function defaultIsRetryable(err: unknown): boolean {
  return isRetryableJudgeError(err) || err instanceof JudgeContractError
}

export async function runLlmWithRetry<TInput, TOutput>({
  label,
  input,
  attemptFn,
  isRetryable = defaultIsRetryable,
}: RunLlmWithRetryOptions<TInput, TOutput>): Promise<TOutput> {
  const chain = getConfiguredJudgeProviderChain()
  if (chain.length === 0) {
    throw new Error('No AI provider keys configured')
  }

  const attemptErrors: string[] = []
  let lastError: Error | null = null

  for (const provider of chain) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await attemptFn(provider, input)
        logger.info(`${label} succeeded`, { provider, attempt })
        return result
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        attemptErrors.push(`${provider}#${attempt}: ${lastError.message}`)
        logger.warn(`${label} attempt failed`, { provider, attempt, err: lastError.message })
        if (!isRetryable(err)) break
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt)
        }
      }
    }
  }

  const detail = attemptErrors.length > 0 ? attemptErrors.join('; ') : 'no attempts recorded'
  throw lastError ?? new Error(`${label} failed: ${detail}`)
}

export function isProviderConfigured(): boolean {
  return Boolean(anthropic || openai)
}
