import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { RateLimitError } from '@/lib/security/rate-limit'
import {
  MCP_CONTRACT_VERSION,
  MCP_CORE_TOOL_DEFINITIONS,
  MCP_OPTIONAL_TOOL_DEFINITIONS,
  MCP_TOOLS,
} from '@/lib/mcp/tool-manifest'

export const MCP_WORKFLOW = [
  'Use ff_list_sites and ff_list_outcomes to select an owned Outcome.',
  'Call ff_verify_outcome and poll ff_get_run until independent verification finishes.',
  'If FixFlags returns Flag, inspect it with ff_get_flag and change the software outside FixFlags.',
  'Call ff_verify_flag after deployment and poll the returned run.',
  'Only fresh FixFlags evidence can return the Outcome to Clear.',
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
  const typed = error instanceof Error
    ? error
    : new Error('MCP tool failed')
  let code = defaults?.code ?? 'MCP_TOOL_FAILED'
  let action = defaults?.action ?? 'retry'
  let message = 'FixFlags could not complete this request. Please retry.'

  if (error instanceof RateLimitError) {
    code = 'RATE_LIMITED'
    action = 'wait_and_retry'
    message = error.message
  } else if (/not found/i.test(typed.message ?? '')) {
    code = 'NOT_FOUND'
    action = 'check_identifier'
    message = 'The requested Site, Outcome, run, or Flag was not found.'
  } else if (/unauthorized|access/i.test(typed.message ?? '')) {
    code = 'UNAUTHORIZED'
    action = 'check_access'
    message = 'This account cannot access the requested Site.'
  } else if (/upgrade|plan/i.test(typed.message ?? '')) {
    code = 'PLAN_GATED'
    action = 'upgrade'
    message = 'This action is not available on the current plan.'
  } else if (/no active execution binding/i.test(typed.message ?? '')) {
    code = 'OUTCOME_NOT_READY'
    action = 'check_configuration'
    message = 'This Outcome does not have an active execution method yet.'
  }

  const payload: McpErrorEnvelope = {
    status: 'ERROR',
    error: {
      code,
      message,
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
