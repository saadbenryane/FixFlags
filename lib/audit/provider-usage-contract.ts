import { z } from 'zod'

const tokens = z.number().int().nonnegative().safe()
export const llmUsageSchema = z.object({
  model: z.string().min(1).max(200), inputTokens: tokens, outputTokens: tokens,
  cacheReadTokens: tokens.optional(), cacheWriteTokens: tokens.optional(),
  cacheWrite5mTokens: tokens.optional(), cacheWrite1hTokens: tokens.optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  api: z.enum(['chat.completions', 'messages']).optional(),
  serviceTier: z.string().min(1).max(100).optional(),
  providerResponseId: z.string().min(1).max(200).optional(),
  reasoningTokens: tokens.optional(),
  inferenceGeo: z.string().min(1).max(100).optional(),
  speed: z.string().min(1).max(100).optional(),
}).strict()

export type LlmUsage = z.infer<typeof llmUsageSchema>

