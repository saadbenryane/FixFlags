import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { User } from '@prisma/client'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'

export type ToolContext = {
  server: McpServer
  user: User
  signal?: AbortSignal
}

export function flagMatchKey(flag: { checkId: string | null; problem: string; rubric: string }): string {
  if (flag.checkId) return `check:${flag.checkId}`
  return buildAiFlagMatchKey(flag.problem, flag.rubric)
}

export function jsonMcpResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  }
}
