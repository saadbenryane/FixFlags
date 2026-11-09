import { getJudgeProviderChain, getConfiguredJudgeProviderChain, getTriageProviderConfig } from '@/lib/audit/judge-config'
import { isAiProviderConfigured } from '@/lib/env'
import { getOpenAIProviderKey } from '@/lib/audit/llm-keys'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { sanitizeAuditErrorMessage } from '@/lib/audit/pipeline/context'
import { classifyJudgeProviderFailure, type JudgeProviderFailure } from '../judge'
import type { AdminActor } from '@/lib/auth/require-admin'
import { adminProviderUsage } from '@/lib/admin/provider-usage'
import { measuredProviderRequest, openAIResponseUsage, anthropicResponseUsage } from '../provider-request'
import { providerBudgetConfiguration } from '@/lib/billing/provider-budget'

export interface AiProviderHealth {
  configured: boolean
  providerChain: string[]
  configuredProviders: string[]
  openai: boolean
  anthropic: boolean
  budget: Pick<ReturnType<typeof providerBudgetConfiguration>, 'configured' | 'mode'>
}

export interface AiProviderValidation {
  ok: boolean
  provider: string
  model?: string
  failure?: JudgeProviderFailure
  error?: string
}

export function getAiProviderHealth(): AiProviderHealth {
  const { configured, mode } = providerBudgetConfiguration()
  return {
    configured: isAiProviderConfigured(),
    providerChain: getJudgeProviderChain(),
    configuredProviders: getConfiguredJudgeProviderChain(),
    openai: Boolean(getOpenAIProviderKey()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    budget: { configured, mode },
  }
}

/** Minimal live credential check for deploy smoke (does not run triage). */
export async function validateAiProviderCredentials(actor: AdminActor): Promise<AiProviderValidation | null> {
  const providers = getConfiguredJudgeProviderChain()
  if (providers.length === 0) return null

  const provider = providers[0]
  const model = getTriageProviderConfig(provider, 15_000).model
  const onAttempt = adminProviderUsage(actor)
  try {
    if (provider === 'openai') {
      const key = getOpenAIProviderKey()
      if (!key) throw new Error('OPENAI_API_KEY is not configured')
      const openai = new OpenAI({ apiKey: key, timeout: 15_000, maxRetries: 0 })
      const requestBody = {
        model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ok' }],
      } satisfies Parameters<typeof openai.chat.completions.create>[0]
      await measuredProviderRequest({ model, api: 'chat.completions', requestBody, onAttempt,
        request: () => openai.chat.completions.create(requestBody), usage: response => openAIResponseUsage(response, model) })
    } else if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
      const anthropic = new Anthropic({ apiKey: key, timeout: 15_000, maxRetries: 0 })
      const requestBody = {
        model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ok' }],
      } satisfies Parameters<typeof anthropic.messages.create>[0]
      await measuredProviderRequest({ model, api: 'messages', requestBody, onAttempt,
        request: () => anthropic.messages.create(requestBody), usage: response => anthropicResponseUsage(response, model) })
    } else {
      throw new Error(`Unknown provider: ${provider}`)
    }
    return { ok: true, provider, model }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      provider,
      model,
      failure: classifyJudgeProviderFailure(err) ?? 'provider_unavailable',
      error: sanitizeAuditErrorMessage(message),
    }
  }
}
