const OPENAI_KEY_ENV_VARS = ['OPENAI_API_KEY', 'OPEN_CODE_API_KEY', 'OPENCODE_API_KEY'] as const

/**
 * Some environments provide OpenAI-compatible keys under alternate names. Keep this
 * resolver in one place so provider checks stay aligned across audit + chat surfaces.
 */
export function getOpenAIProviderKey(): string | undefined {
  for (const key of OPENAI_KEY_ENV_VARS) {
    const value = process.env[key]
    if (value && value.trim()) return value
  }
  return undefined
}

export function hasOpenAIProviderKey(): boolean {
  return Boolean(getOpenAIProviderKey())
}

export function hasAnthropicProviderKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}
