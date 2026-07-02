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

const TRIAGE_DEFAULT_MAX_TOKENS = 1500

/**
 * Phase-1 triage config: same provider/timeout resolution as the full judge,
 * but with a much smaller token budget and an optional cheaper model override.
 * The small max_tokens + trimmed tool schema are what keep the anonymous pass
 * cheap.
 */
export function getTriageProviderConfig(provider: string, maxTimeoutMs?: number): ProviderConfig {
  const env = getEnv()
  const base = getProviderConfig(provider, maxTimeoutMs)
  const maxTokens = Number(env.TRIAGE_MAX_TOKENS) || TRIAGE_DEFAULT_MAX_TOKENS
  return {
    ...base,
    model:
      env.TRIAGE_MODEL ??
      (provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini'),
    maxTokens,
  }
}
