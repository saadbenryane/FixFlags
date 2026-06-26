import { getEnv } from '@/lib/env'

export interface ProviderConfig {
  model: string
  maxTokens: number
  timeoutMs: number
  imageDetail: 'low' | 'high' | 'auto'
}

const DEFAULTS: Record<string, ProviderConfig> = {
  openai: {
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    timeoutMs: 60_000,
    imageDetail: 'low',
  },
  anthropic: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    timeoutMs: 45_000,
    imageDetail: 'auto',
  },
}

/**
 * @param maxTimeoutMs When set, clamps the provider timeout so a judge call can
 *   never exceed the audit's remaining deadline budget.
 */
export function getProviderConfig(provider: string, maxTimeoutMs?: number): ProviderConfig {
  const env = getEnv()
  const defaults = DEFAULTS[provider] ?? DEFAULTS.openai
  const configuredTimeout = Number(env.JUDGE_TIMEOUT_MS) || defaults.timeoutMs

  return {
    model:
      provider === 'openai'
        ? (env.OPENAI_JUDGE_MODEL ?? defaults.model)
        : provider === 'anthropic'
          ? (env.ANTHROPIC_JUDGE_MODEL ?? defaults.model)
          : defaults.model,
    maxTokens:
      provider === 'openai'
        ? Number(env.OPENAI_JUDGE_MAX_TOKENS) || defaults.maxTokens
        : defaults.maxTokens,
    timeoutMs:
      maxTimeoutMs != null && maxTimeoutMs > 0
        ? Math.min(configuredTimeout, maxTimeoutMs)
        : configuredTimeout,
    imageDetail:
      provider === 'openai'
        ? (env.OPENAI_JUDGE_IMAGE_DETAIL ?? defaults.imageDetail)
        : defaults.imageDetail,
  }
}

export function getJudgeProviderChain(): string[] {
  return getEnv().JUDGE_PROVIDER_CHAIN
}
