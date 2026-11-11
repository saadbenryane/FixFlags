export const PROMPT_TOOL_KEYS = [
  'universal',
  'cursor',
  'claude',
  'windsurf',
  'lovable',
  'bolt',
] as const

export type PromptToolKey = (typeof PROMPT_TOOL_KEYS)[number]

export const API_KEY_CLIENTS = [
  'cli',
  ...EDITOR_INTEGRATION_KEYS,
  'vscode',
  'other',
] as const

export type ApiKeyClient = (typeof API_KEY_CLIENTS)[number]

export function isApiKeyClient(value: unknown): value is ApiKeyClient {
  return typeof value === 'string' && API_KEY_CLIENTS.includes(value as ApiKeyClient)
}

export function resolveToolPrompt(
  toolPrompts: Partial<Record<PromptToolKey, string | null | undefined>> | undefined,
  selectedTool: PromptToolKey,
  universalPrompt?: string | null
): string | null {
  if (selectedTool === 'universal') {
    const universal = toolPrompts?.universal?.trim() || universalPrompt?.trim()
    return universal || null
  }
  const prompt = toolPrompts?.[selectedTool]?.trim()
  return prompt || null
}
import {
  EDITOR_INTEGRATION_KEYS,
} from '@/lib/integrations/editor-catalog'
