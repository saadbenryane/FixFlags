import { getJudgeProviderChain, getConfiguredJudgeProviderChain } from '@/lib/audit/judge-config'
import { isAiProviderConfigured } from '@/lib/env'
import { getOpenAIProviderKey } from '@/lib/audit/llm-keys'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { sanitizeAuditErrorMessage } from '@/lib/audit/pipeline/context'

export interface AiProviderHealth {
  configured: boolean
  providerChain: string[]
  configuredProviders: string[]
  openai: boolean
  anthropic: boolean
}

export interface AiProviderValidation {
  ok: boolean
  provider: string
  error?: string
}

export function getAiProviderHealth(): AiProviderHealth {
  return {
    configured: isAiProviderConfigured(),
    providerChain: getJudgeProviderChain(),
    configuredProviders: getConfiguredJudgeProviderChain(),
    openai: Boolean(getOpenAIProviderKey()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  }
}

/** Minimal live credential check for deploy smoke (does not run triage). */
export async function validateAiProviderCredentials(): Promise<AiProviderValidation | null> {
  const providers = getConfiguredJudgeProviderChain()
  if (providers.length === 0) return null

  const provider = providers[0]
  try {
    if (provider === 'openai') {
      const key = getOpenAIProviderKey()
      if (!key) throw new Error('OPENAI_API_KEY is not configured')
      const openai = new OpenAI({ apiKey: key })
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ok' }],
      })
    } else if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
      const anthropic = new Anthropic({ apiKey: key })
      await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ok' }],
      })
    } else {
      throw new Error(`Unknown provider: ${provider}`)
    }
    return { ok: true, provider }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      provider,
      error: sanitizeAuditErrorMessage(message),
    }
  }
}
