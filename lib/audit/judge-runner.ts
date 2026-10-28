import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getConfiguredJudgeProviderChain } from './judge-config'
import { hasAnthropicProviderKey, getOpenAIProviderKey } from './llm-keys'
import { isRetryableJudgeError } from './judge'
import { JudgeContractError } from './validate-judge-output'
import { logger } from '@/lib/logger'
import { currentExecutionOwnership, ExecutionOwnershipLost } from './execution-ownership'

const openAiApiKey = getOpenAIProviderKey()

/** Every SDK consumer shares the owning execution's transport lifetime. */
const executionFetch: typeof globalThis.fetch = (input, init) => {
  const executionSignal = currentExecutionOwnership()?.signal
  if (!executionSignal) return globalThis.fetch(input, init)
  executionSignal.throwIfAborted()
  const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  return globalThis.fetch(input, { ...init,
    signal: requestSignal ? AbortSignal.any([requestSignal, executionSignal]) : executionSignal })
}

// Application attempts own retries, deadlines and provider-consumption custody.
export const anthropic = hasAnthropicProviderKey()
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, fetch: executionFetch })
  : null

export const openai = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey, maxRetries: 0, fetch: executionFetch }) : null

export const MAX_RETRIES = 3
export const RETRY_DELAY_MS = 2000

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  model: string
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

import { sleep } from '@/lib/utils/sleep'

export interface RunLlmWithRetryOptions<TInput, TOutput> {
  label: string
  input: TInput
  attemptFn: (provider: string, input: TInput) => Promise<TOutput>
  isRetryable?: (err: unknown) => boolean
  deadline?: number
}

function defaultIsRetryable(err: unknown): boolean {
  return isRetryableJudgeError(err) || err instanceof JudgeContractError
}

export async function runLlmWithRetry<TInput, TOutput>({
  label,
  input,
  attemptFn,
  isRetryable = defaultIsRetryable,
  deadline,
}: RunLlmWithRetryOptions<TInput, TOutput>): Promise<TOutput> {
  const signal = currentExecutionOwnership()?.signal
  const chain = getConfiguredJudgeProviderChain()
  if (chain.length === 0) {
    throw new Error('No AI provider keys configured')
  }

  const attemptErrors: string[] = []
  let lastError: Error | null = null

  for (const provider of chain) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new ExecutionOwnershipLost()
      if (deadline !== undefined && Date.now() >= deadline) {
        throw Object.assign(new Error(`${label} time budget exhausted`), { code: 'ETIMEDOUT' })
      }
      try {
        const result = await attemptFn(provider, input)
        if (signal?.aborted) throw new ExecutionOwnershipLost()
        logger.info(`${label} succeeded`, { provider, attempt })
        return result
      } catch (err) {
        if (signal?.aborted) throw new ExecutionOwnershipLost()
        lastError = err instanceof Error ? err : new Error(String(err))
        attemptErrors.push(`${provider}#${attempt}: ${lastError.message}`)
        logger.warn(`${label} attempt failed`, { provider, attempt, err: lastError.message })
        if (!isRetryable(err)) break
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(RETRY_DELAY_MS * attempt, deadline === undefined ? Infinity : Math.max(0, deadline - Date.now()))
          if (signal) await sleep(delay, signal)
          else await sleep(delay)
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
