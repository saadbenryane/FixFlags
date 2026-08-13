import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { assertAuditAccess } from '@/lib/mcp/access'
import { loadCompletedTaskOutcome } from '../../audit/task-contracts'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { PROMPT_TOOL_KEYS } from '@/lib/mcp/builders'
import {
  mcpCoreError,
  mcpErrorOutputSchema,
  mcpStructuredResult,
} from '@/lib/mcp/contract'

export function registerCheckStatusTools(server: McpServer, user: User) {
  server.registerTool(
    MCP_TOOLS.getCheckStatus.name,
    {
      description: MCP_TOOLS.getCheckStatus.desc,
      inputSchema: { reportId: z.string() },
      outputSchema: z.union([
        z.object({ status: z.string() }).passthrough(),
        mcpErrorOutputSchema,
      ]),
      annotations: {
        title: 'Get Product Review status', readOnlyHint: true,
        destructiveHint: false, idempotentHint: true, openWorldHint: false,
      },
    },
    async ({ reportId }) => {
      try {
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, url: true, createdAt: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id, 'You do not have access to this report')
      return mcpStructuredResult(audit)
      } catch (error) {
        return mcpCoreError(error)
      }
    }
  )

  server.registerTool(
    MCP_TOOLS.getReport.name,
    {
      description: MCP_TOOLS.getReport.desc,
      inputSchema: { reportId: z.string(), tool: z.enum(PROMPT_TOOL_KEYS).optional() },
      outputSchema: z.union([
        z.object({ status: z.string().optional() }).passthrough(),
        mcpErrorOutputSchema,
      ]),
      annotations: {
        title: 'Get Product Review', readOnlyHint: true,
        destructiveHint: false, idempotentHint: true, openWorldHint: false,
      },
    },
    async ({ reportId, tool }) => {
      try {
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      const outcome = await loadCompletedTaskOutcome(reportId, tool)

      return mcpStructuredResult(outcome)
      } catch (error) {
        return mcpCoreError(error)
      }
    }
  )
}
