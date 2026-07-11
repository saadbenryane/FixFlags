import { getJudgeProviderChain } from '@/lib/audit/judge-config'
import { isAiProviderConfigured } from '@/lib/env'

export interface AiProviderHealth {
  configured: boolean
  providerChain: string[]
  openai: boolean
  anthropic: boolean
}

export function getAiProviderHealth(): AiProviderHealth {
  return {
    configured: isAiProviderConfigured(),
    providerChain: getJudgeProviderChain(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  }
}
