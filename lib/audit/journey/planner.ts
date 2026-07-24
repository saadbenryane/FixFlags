import { getTriageProviderConfig } from '@/lib/audit/judge-config'
import {
  anthropic,
  openai,
  isProviderConfigured,
  runLlmWithRetry,
  type LlmUsage,
} from '@/lib/audit/judge-runner'
import { buildPlannerSystemPrompt, buildPlannerUserPrompt, type PlannerUserPromptInput } from './planner-prompt'
import { journeyPlanSchema, JOURNEY_PLAN_TOOL_OPENAI, type JourneyPlan } from './planner-schema'

export type PlannerUsage = LlmUsage

export interface PlannerResult {
  plan: JourneyPlan
  usage: PlannerUsage
}

export function isPlannerProviderConfigured(): boolean {
  return isProviderConfigured()
}

function parsePlanOutput(raw: unknown): JourneyPlan {
  const parsed = journeyPlanSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid planner output: ${parsed.error.message}`)
  }
  return parsed.data
}

async function runOpenAIPlanner(
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number
): Promise<PlannerResult> {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured')

  const cfg = getTriageProviderConfig('openai', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const response = await openai.chat.completions.create(
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
    )

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in planner response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      plan: parsePlanOutput(raw),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: cfg.model,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runAnthropicPlanner(
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number
): Promise<PlannerResult> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')

  const cfg = getTriageProviderConfig('anthropic', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const response = await anthropic.messages.create(
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
            input_schema: {
              type: 'object',
              properties: {
                goal: { type: 'string', description: 'The goal of this journey' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stepNumber: { type: 'number', description: 'Step number starting from 1' },
                      action: { type: 'string', enum: ['navigate', 'click', 'fill', 'submit', 'evaluate', 'scroll'], description: 'The action to perform' },
                      target: { type: 'string', description: 'Natural language description of the target element' },
                      expectedResult: { type: 'string', description: 'What the page should show after this step' },
                      evidence: { type: 'array', items: { type: 'string' }, description: 'What to capture at this step' },
                    },
                    required: ['stepNumber', 'action', 'target', 'expectedResult', 'evidence'],
                  },
                },
                confidence: { type: 'number', description: 'Confidence in the plan (0-1)' },
                estimatedDurationMs: { type: 'number', description: 'Estimated duration in milliseconds' },
              },
              required: ['goal', 'steps', 'confidence', 'estimatedDurationMs'],
            },
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
    )

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in planner response')
    }

    return {
      plan: parsePlanOutput(toolUse.input),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: cfg.model,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runPlannerWithProvider(
  provider: string,
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number
): Promise<PlannerResult> {
  switch (provider) {
    case 'openai':
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAIPlanner(input, maxTimeoutMs)
    case 'anthropic':
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicPlanner(input, maxTimeoutMs)
    default:
      throw new Error(`Unknown planner provider: ${provider}`)
  }
}

export async function planJourney(
  input: PlannerUserPromptInput,
  maxTimeoutMs?: number
): Promise<PlannerResult> {
  return runLlmWithRetry({
    label: 'journey-planner',
    input: { input, maxTimeoutMs },
    attemptFn: (provider, { input, maxTimeoutMs }) =>
      runPlannerWithProvider(provider, input, maxTimeoutMs),
    isRetryable: (err) => {
      if (err instanceof Error && err.message.startsWith('Invalid planner output:')) return true
      return false
    },
  })
}
