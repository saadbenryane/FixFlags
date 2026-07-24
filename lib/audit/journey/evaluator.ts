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
  journeyEvaluationSchema,
  JOURNEY_EVALUATION_TOOL_OPENAI,
  type JourneyEvaluation,
} from './evaluator-schema'

export type EvaluatorUsage = LlmUsage

export interface EvaluatorResult {
  evaluation: JourneyEvaluation
  usage: EvaluatorUsage
}

export function isEvaluatorProviderConfigured(): boolean {
  return isProviderConfigured()
}

function parseEvaluationOutput(raw: unknown): JourneyEvaluation {
  const parsed = journeyEvaluationSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid evaluator output: ${parsed.error.message}`)
  }
  return parsed.data
}

async function runOpenAIEvaluator(
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number
): Promise<EvaluatorResult> {
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
          { role: 'system', content: buildEvaluatorSystemPrompt() },
          { role: 'user', content: buildEvaluatorUserPrompt(input) },
        ],
        tools: [JOURNEY_EVALUATION_TOOL_OPENAI],
        tool_choice: { type: 'function', function: { name: 'evaluate_journey' } },
      },
      { signal: controller.signal }
    )

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in evaluator response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      evaluation: parseEvaluationOutput(raw),
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

async function runAnthropicEvaluator(
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number
): Promise<EvaluatorResult> {
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
            text: buildEvaluatorSystemPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [
          {
            name: 'evaluate_journey',
            description: 'Evaluate a completed user journey for UX issues',
            input_schema: {
              type: 'object',
              properties: {
                frictionPoints: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stepNumber: { type: 'number' },
                      type: { type: 'string', enum: ['hesitation', 'confusion', 'too-many-steps', 'unclear-progress', 'missing-feedback'] },
                      description: { type: 'string' },
                      evidence: { type: 'string' },
                      severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'POLISH'] },
                      rubric: { type: 'string', enum: ['MESSAGE', 'EXPERIENCE', 'REACH'] },
                      impactTag: { type: 'string', enum: ['CONVERSION', 'REVENUE', 'TRUST', 'MEASUREMENT', 'SHARING', 'SEO', 'ACCESSIBILITY', 'CLARITY', 'AUTHORITY', 'FRICTION', 'EMOTION'] },
                    },
                    required: ['stepNumber', 'type', 'description', 'evidence', 'severity', 'rubric', 'impactTag'],
                  },
                },
                brokenPromises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stepNumber: { type: 'number' },
                      expected: { type: 'string' },
                      actual: { type: 'string' },
                      evidence: { type: 'string' },
                      severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT'] },
                    },
                    required: ['stepNumber', 'expected', 'actual', 'evidence', 'severity'],
                  },
                },
                accessibilityBarriers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stepNumber: { type: 'number' },
                      barrier: { type: 'string' },
                      element: { type: 'string' },
                      evidence: { type: 'string' },
                    },
                    required: ['stepNumber', 'barrier', 'element', 'evidence'],
                  },
                },
                confidence: { type: 'number' },
                summary: { type: 'string' },
              },
              required: ['frictionPoints', 'brokenPromises', 'accessibilityBarriers', 'confidence', 'summary'],
            },
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
    )

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in evaluator response')
    }

    return {
      evaluation: parseEvaluationOutput(toolUse.input),
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

async function runEvaluatorWithProvider(
  provider: string,
  input: EvaluatorUserPromptInput,
  maxTimeoutMs?: number
): Promise<EvaluatorResult> {
  switch (provider) {
    case 'openai':
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAIEvaluator(input, maxTimeoutMs)
    case 'anthropic':
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicEvaluator(input, maxTimeoutMs)
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
  maxTimeoutMs?: number
): Promise<EvaluatorResult> {
  return runLlmWithRetry({
    label: 'journey-evaluator',
    input: { input, maxTimeoutMs },
    attemptFn: (provider, { input, maxTimeoutMs }) =>
      runEvaluatorWithProvider(provider, input, maxTimeoutMs),
    isRetryable: (err) => {
      if (err instanceof Error && err.message.startsWith('Invalid evaluator output:')) return true
      return false
    },
  })
}
