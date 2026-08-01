import { openai } from '@/lib/audit/judge-runner'
import { getTriageProviderConfig } from '@/lib/audit/judge-config'

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

export async function runWorkspaceChat(input: {
  message: string
  url: string
  status: string
  flags: ChatFlagContext[]
}): Promise<string> {
  if (!openai) {
    return 'AI chat is not configured on this environment. Open a Flag in the report for evidence and fix prompts.'
  }

  const cfg = getTriageProviderConfig('openai', 15_000)
  const response = await openai.chat.completions.create({
    model: cfg.model,
    max_tokens: Math.min(cfg.maxTokens, 600),
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Report URL: ${input.url}\nStatus: ${input.status}\n\nFlags on this report:\n${formatFlagContext(input.flags)}\n\nUser: ${input.message}`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim()
  return text || 'I could not generate a reply. Try asking about a specific Flag.'
}
