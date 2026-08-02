import OpenAI from 'openai'
import { openai } from '@/lib/audit/judge-runner'
import { getChatProviderConfig } from '@/lib/audit/judge-config'
import { getOpenAIProviderKey } from '@/lib/audit/llm-keys'
import { getEnv } from '@/lib/env'

type OpenAIClient = NonNullable<typeof openai>

/**
 * Chat uses its own OpenAI-compatible client when CHAT_BASE_URL routes chat
 * through a gateway (for example the opencode gateway). Otherwise it shares
 * the configured OpenAI client. Kept in one place so chat never couples to
 * judge or triage provider configuration.
 */
function getChatOpenAIClient(): OpenAIClient | null {
  const baseURL = getEnv().CHAT_BASE_URL
  if (baseURL) {
    const key = getOpenAIProviderKey()
    return key ? new OpenAI({ apiKey: key, baseURL }) : null
  }
  return openai ?? null
}

export function isWorkspaceChatConfigured(): boolean {
  return Boolean(getChatOpenAIClient())
}

const MAX_CHAT_TOKENS = 600

function buildPrompt(input: {
  message: string
  url: string
  status: string
  flags: ChatFlagContext[]
}) {
  return `Report URL: ${input.url}\nStatus: ${input.status}\n\nFlags on this report:\n${formatFlagContext(input.flags)}\n\nUser: ${input.message}`
}

async function runOpenAIChat(
  client: OpenAIClient,
  input: {
    message: string
    url: string
    status: string
    flags: ChatFlagContext[]
  }
): Promise<string> {
  const cfg = getChatProviderConfig('openai', 15_000)
  const response = await client.chat.completions.create({
    model: cfg.model,
    max_tokens: Math.min(cfg.maxTokens, MAX_CHAT_TOKENS),
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim()
  return text || ''
}

export interface ChatFlagContext {
  id: string
  rubric: string
  severity: string
  problem: string
  evidence: string
  fix: string
}

const SYSTEM = `You are FixFlags workspace chat. Help the builder understand Flags on their product review report.
Stay concise. Do not invent findings. Suggest what to fix first when asked.
You are not running a new scan. Only explain and steer based on the report context provided.
When the user asks about a Flag, ground your answer in the report context: rank by severity, reference the evidence, and offer the matching fix prompt.`

function formatFlagContext(flags: ChatFlagContext[]): string {
  if (flags.length === 0) return 'No Flags on this report yet.'
  return flags
    .map(
      (flag, index) =>
        `${index + 1}. [${flag.rubric}] ${flag.problem}\n   Severity: ${flag.severity}\n   Evidence: ${flag.evidence.slice(0, 400)}\n   Fix: ${flag.fix.slice(0, 400)}`
    )
    .join('\n')
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

/**
 * Deterministic canned reply built from the report's own Flags. Used when no
 * chat provider is configured or the model call fails, so chat degrades to
 * useful canned actions instead of a dead end.
 */
export function buildCannedChatReply(input: { flags: ChatFlagContext[] }): string {
  const flags = input.flags
  if (flags.length === 0) {
    return 'No Flags on this report yet. Open a Flag in the report for evidence and fix prompts.'
  }
  const top = [...flags].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )[0]
  return [
    `Start with the most important Flag: ${top.problem}`,
    `Evidence: ${top.evidence}`,
    `Fix: ${top.fix}`,
  ].join('\n\n')
}

export async function runWorkspaceChat(input: {
  message: string
  url: string
  status: string
  flags: ChatFlagContext[]
}): Promise<{ reply: string; mode: 'llm' | 'canned' }> {
  const client = getChatOpenAIClient()
  if (!client) {
    return { reply: buildCannedChatReply(input), mode: 'canned' }
  }

  try {
    const openAIText = await runOpenAIChat(client, input)
    if (openAIText) return { reply: openAIText, mode: 'llm' }
  } catch {
    return { reply: buildCannedChatReply(input), mode: 'canned' }
  }

  return { reply: buildCannedChatReply(input), mode: 'canned' }
}
