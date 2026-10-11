import { z } from 'zod'

export const agentCitationSchema = z.object({
  type: z.enum(['flag', 'attempt', 'watch']), id: z.string().min(1), label: z.string().min(1).max(500),
  href: z.string().startsWith('/sites/'),
}).strict()
export type AgentCitation = z.infer<typeof agentCitationSchema>
export const agentReplySchema = z.object({ reply: z.string().trim().min(1).max(10000), citations: z.array(agentCitationSchema).max(20),
  messageId: z.string().min(1), createdAt: z.string().datetime(), threadId: z.string().min(1) }).strict()
export const agentHistorySchema = z.object({ threadId: z.string().nullable(),
  messages: z.array(z.object({ id: z.string(), role: z.enum(['user', 'assistant']), content: z.string(),
    citations: z.array(agentCitationSchema), createdAt: z.string().datetime(), flagId: z.string().nullable().optional() })),
})
export class SiteAgentError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message); this.name = 'SiteAgentError'
  }
}
