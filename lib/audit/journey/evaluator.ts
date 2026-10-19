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
import {
  buildEvaluatorSystemPrompt,
  buildEvaluatorUserPrompt,
  type EvaluatorUserPromptInput,
} from './evaluator-prompt'
import {
  journeyEvaluationProviderSchema,
  JOURNEY_EVALUATION_PARAMETERS,
  JOURNEY_EVALUATION_TOOL_OPENAI,
  type JourneyEvaluation,
} from './evaluator-schema'

export type EvaluatorUsage = LlmUsage

export interface EvaluatorResult {
  evaluation: JourneyEvaluation
  usage: EvaluatorUsage | null
}

export function isEvaluatorProviderConfigured(): boolean {
  return isProviderConfigured()
}

function parseEvaluationOutput(raw: unknown): JourneyEvaluation {
  const parsed = journeyEvaluationProviderSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid evaluator output: ${parsed.error.message}`)
  }
  return parsed.data
}

async function runOpenAIEvaluator(
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<EvaluatorResult> {
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
          { role: 'system', content: buildEvaluatorSystemPrompt() },
          { role: 'user', content: buildEvaluatorUserPrompt(input) },
        ],
        tools: [JOURNEY_EVALUATION_TOOL_OPENAI],
        tool_choice: { type: 'function', function: { name: 'evaluate_journey' } },
      },
      { signal: controller.signal }
      ),
      usage: response => openAIResponseUsage(response, cfg.model),
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in evaluator response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      evaluation: parseEvaluationOutput(raw),
      usage,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runAnthropicEvaluator(
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<EvaluatorResult> {
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
            text: buildEvaluatorSystemPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [
          {
            name: 'evaluate_journey',
            description: 'Evaluate a completed user journey for UX issues',
            input_schema: JOURNEY_EVALUATION_PARAMETERS as import('@anthropic-ai/sdk/resources/messages').Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'evaluate_journey' },
        messages: [
          {
            role: 'user',
            content: buildEvaluatorUserPrompt(input),
          },
        ],
      },
      { signal: controller.signal }
      ),
      usage: response => anthropicResponseUsage(response, cfg.model),
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in evaluator response')
    }

    return {
      evaluation: parseEvaluationOutput(toolUse.input),
      usage,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runEvaluatorWithProvider(
  provider: string,
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<EvaluatorResult> {
  switch (provider) {
    case 'openai':
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAIEvaluator(input, maxTimeoutMs, onAttempt)
    case 'anthropic':
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicEvaluator(input, maxTimeoutMs, onAttempt)
    default:
      throw new Error(`Unknown evaluator provider: ${provider}`)
  }
}

/**
 * Evaluate a completed journey for UX issues.
 * Runs as a single LLM call with structured output.
 */
export async function evaluateJourney(
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<EvaluatorResult> {
  return runLlmWithRetry({
    label: 'journey-evaluator',
    input: { input, maxTimeoutMs },
    attemptFn: (provider, { input, maxTimeoutMs }) =>
      runEvaluatorWithProvider(provider, input, maxTimeoutMs, onAttempt),
    isRetryable: (err) => {
      if (err instanceof Error && err.message.startsWith('Invalid evaluator output:')) return true
      return false
    },
  })
}
