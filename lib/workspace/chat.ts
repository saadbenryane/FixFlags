import { openai } from '@/lib/audit/judge-runner'
import { getTriageProviderConfig } from '@/lib/audit/judge-config'

const SYSTEM = `You are FixFlags workspace chat. Help the builder understand Flags on their product review report.
Stay concise. Do not invent findings. Suggest what to fix first when asked.
You are not running a new scan. Only explain and steer based on the report context provided.`

export async function runWorkspaceChat(input: {
  message: string
  url: string
  status: string
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
        content: `Report URL: ${input.url}\nStatus: ${input.status}\n\nUser: ${input.message}`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim()
  return text || 'I could not generate a reply. Try asking about a specific Flag.'
}
