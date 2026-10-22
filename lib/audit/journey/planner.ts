import { measuredProviderRequest, openAIResponseUsage, anthropicResponseUsage } from '../provider-request'
import type { ProviderUsageAdmission } from '../provider-usage'
import { getTriageProviderConfig } from '@/lib/audit/judge-config'
import {
  anthropic,
  openai,
  isProviderConfigured,
  runLlmWithRetry,
  type LlmUsage,
} from '@/lib/audit/judge-runner'
import { buildPlannerSystemPrompt, buildPlannerUserPrompt, type PlannerUserPromptInput } from './planner-prompt'
import { journeyPlanProviderSchema, JOURNEY_PLAN_PARAMETERS, JOURNEY_PLAN_TOOL_OPENAI, type JourneyPlan } from './planner-schema'

export type PlannerUsage = LlmUsage

export interface PlannerResult {
  plan: JourneyPlan
  usage: PlannerUsage | null
}

export function isPlannerProviderConfigured(): boolean {
  return isProviderConfigured()
}

function parsePlanOutput(raw: unknown): JourneyPlan {
  const parsed = journeyPlanProviderSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid planner output: ${parsed.error.message}`)
  }
  return parsed.data
}

async function runOpenAIPlanner(
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<PlannerResult> {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured')
  const client = openai

  const cfg = getTriageProviderConfig('openai', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const { response, usage } = await measuredProviderRequest({
      model: cfg.model, onAttempt,
      request: () => client.chat.completions.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        messages: [
          { role: 'system', content: buildPlannerSystemPrompt() },
          { role: 'user', content: buildPlannerUserPrompt(input) },
        ],
        tools: [JOURNEY_PLAN_TOOL_OPENAI],
        tool_choice: { type: 'function', function: { name: 'plan_journey' } },
      },
      { signal: controller.signal }
      ),
      usage: response => openAIResponseUsage(response, cfg.model),
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in planner response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      plan: parsePlanOutput(raw),
      usage,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runAnthropicPlanner(
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<PlannerResult> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
  const client = anthropic

  const cfg = getTriageProviderConfig('anthropic', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const { response, usage } = await measuredProviderRequest({
      model: cfg.model, onAttempt,
      request: () => client.messages.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        system: [
          {
            type: 'text',
            text: buildPlannerSystemPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [
          {
            name: 'plan_journey',
            description: 'Plan a multi-step user journey to evaluate a website experience',
            input_schema: JOURNEY_PLAN_PARAMETERS as import('@anthropic-ai/sdk/resources/messages').Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'plan_journey' },
        messages: [
          {
            role: 'user',
            content: buildPlannerUserPrompt(input),
          },
        ],
      },
      { signal: controller.signal }
      ),
      usage: response => anthropicResponseUsage(response, cfg.model),
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in planner response')
    }

    return {
      plan: parsePlanOutput(toolUse.input),
      usage,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runPlannerWithProvider(
  provider: string,
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<PlannerResult> {
  switch (provider) {
    case 'openai':
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAIPlanner(input, maxTimeoutMs, onAttempt)
    case 'anthropic':
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicPlanner(input, maxTimeoutMs, onAttempt)
    default:
      throw new Error(`Unknown planner provider: ${provider}`)
  }
}

export async function planJourney(
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<PlannerResult> {
  return runLlmWithRetry({
    label: 'journey-planner',
    input: { input, maxTimeoutMs },
    attemptFn: (provider, { input, maxTimeoutMs }) =>
      runPlannerWithProvider(provider, input, maxTimeoutMs, onAttempt),
    isRetryable: (err) => {
      if (err instanceof Error && err.message.startsWith('Invalid planner output:')) return true
      return false
    },
  })
}
