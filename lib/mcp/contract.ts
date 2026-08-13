import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  MCP_CONTRACT_VERSION,
  MCP_CORE_TOOL_DEFINITIONS,
  MCP_OPTIONAL_TOOL_DEFINITIONS,
  MCP_TOOLS,
} from '@/lib/mcp/tool-manifest'

export const MCP_WORKFLOW = [
  'Run ff_check_and_plan for a deployed Product URL.',
  'Inspect the selected Flag with ff_get_flag and validate its evidence.',
  'Implement and deploy the change outside FixFlags.',
  'Record the builder declaration with ff_mark_fix_attempted. This does not verify the change.',
  'Run ff_recheck_and_compare. Only the fresh child Product Review can verify the outcome.',
] as const

export type McpErrorEnvelope = {
  status: 'ERROR'
  error: {
    code: string
    message: string
    recoverable: boolean
    action: string
  }
}

export const mcpErrorOutputSchema = z.object({
  status: z.literal('ERROR'),
  error: z.object({
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
    action: z.string(),
  }),
})

export function mcpStructuredResult<T extends object>(payload: T) {
  return {
    structuredContent: payload as Record<string, unknown>,
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  }
}

export function mcpCoreError(error: unknown, defaults?: { code?: string; action?: string }) {
  const typed = error as Error & { code?: string; action?: string; status?: number }
  let code = typed.code ?? defaults?.code ?? 'MCP_TOOL_FAILED'
  let action = typed.action ?? defaults?.action ?? 'retry'

  if (/not found/i.test(typed.message ?? '')) {
    code = 'NOT_FOUND'
    action = 'check_identifier'
  } else if (/unauthorized|access/i.test(typed.message ?? '')) {
    code = 'UNAUTHORIZED'
    action = 'check_access'
  } else if (/upgrade|plan/i.test(typed.message ?? '')) {
    code = 'PLAN_GATED'
    action = 'upgrade'
  }

  const payload: McpErrorEnvelope = {
    status: 'ERROR',
    error: {
      code,
      message: typed.message || 'FixFlags could not complete this tool call.',
      recoverable: !['UNAUTHORIZED', 'PLAN_GATED'].includes(code),
      action,
    },
  }

  return { ...mcpStructuredResult(payload), isError: true }
}

function sanitizeClientInfo(server: McpServer) {
  const client = server.server.getClientVersion()
  if (!client) return null
  return {
    name: client.name.slice(0, 80),
    version: client.version.slice(0, 40),
  }
}

export function registerConnectionInfoTool(server: McpServer, authenticated: boolean) {
  server.registerTool(
    MCP_TOOLS.getConnectionInfo.name,
    {
      description: MCP_TOOLS.getConnectionInfo.desc,
      inputSchema: {},
      outputSchema: z.object({ contractVersion: z.string(), ready: z.boolean() }).passthrough(),
      annotations: {
        title: 'FixFlags connection information',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const payload = {
        contractVersion: MCP_CONTRACT_VERSION,
        serverVersion: process.env.npm_package_version ?? '0.1.0',
        authentication: { type: 'bearer', authenticated },
        ready: authenticated,
        core: MCP_CORE_TOOL_DEFINITIONS.map((tool) => tool.name),
        optional: MCP_OPTIONAL_TOOL_DEFINITIONS.map((tool) => tool.name),
        workflow: MCP_WORKFLOW,
        clientInfo: sanitizeClientInfo(server),
      }
      return mcpStructuredResult(payload)
    }
  )
}
