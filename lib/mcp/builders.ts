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
export type McpBuilderKey = Exclude<PromptToolKey, 'universal'>

export interface BuilderDefinition {
  key: PromptToolKey
  label: string
  apiKeyClient: ApiKeyClient | null
  supportsMcp: boolean
  setupKind: 'prompt-only' | 'config' | 'connector'
}

export const BUILDERS: readonly BuilderDefinition[] = [
  {
    key: 'universal',
    label: 'Universal',
    apiKeyClient: null,
    supportsMcp: false,
    setupKind: 'prompt-only',
  },
  {
    key: 'cursor',
    label: getEditorIntegration('cursor').label,
    apiKeyClient: getEditorIntegration('cursor').apiKeyClient,
    supportsMcp: true,
    setupKind: 'config',
  },
  {
    key: 'claude',
    label: getEditorIntegration('claudeCode').label,
    apiKeyClient: getEditorIntegration('claudeCode').apiKeyClient,
    supportsMcp: true,
    setupKind: 'config',
  },
  {
    key: 'windsurf',
    label: getEditorIntegration('windsurf').label,
    apiKeyClient: getEditorIntegration('windsurf').apiKeyClient,
    supportsMcp: true,
    setupKind: 'config',
  },
  {
    key: 'lovable',
    label: getEditorIntegration('lovable').label,
    apiKeyClient: getEditorIntegration('lovable').apiKeyClient,
    supportsMcp: true,
    setupKind: 'connector',
  },
  {
    key: 'bolt',
    label: getEditorIntegration('bolt').label,
    apiKeyClient: getEditorIntegration('bolt').apiKeyClient,
    supportsMcp: true,
    setupKind: 'connector',
  },
] as const

export function isPromptToolKey(value: unknown): value is PromptToolKey {
  return typeof value === 'string' && PROMPT_TOOL_KEYS.includes(value as PromptToolKey)
}

export function isApiKeyClient(value: unknown): value is ApiKeyClient {
  return typeof value === 'string' && API_KEY_CLIENTS.includes(value as ApiKeyClient)
}

export function getBuilder(key: PromptToolKey): BuilderDefinition {
  const builder = BUILDERS.find((candidate) => candidate.key === key)
  if (!builder) throw new Error(`Unsupported builder: ${key}`)
  return builder
}

export function apiKeyClientForTool(tool: PromptToolKey): ApiKeyClient | undefined {
  return getBuilder(tool).apiKeyClient ?? undefined
}

export function editorKeyForApiKeyClient(
  client: ApiKeyClient
): EditorIntegrationKey | undefined {
  return (EDITOR_INTEGRATION_KEYS as readonly string[]).includes(client)
    ? (client as EditorIntegrationKey)
    : undefined
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
  getEditorIntegration,
  type EditorIntegrationKey,
} from '@/lib/integrations/editor-catalog'
