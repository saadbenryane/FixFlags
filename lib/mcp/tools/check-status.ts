import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { assertAuditAccess } from '@/lib/mcp/access'
import { loadCompletedTaskOutcome } from '../../audit/task-contracts'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

export function registerCheckStatusTools(server: McpServer, user: User) {
  server.tool(
    MCP_TOOLS.getCheckStatus.name,
    MCP_TOOLS.getCheckStatus.desc,
    { reportId: z.string() },
    async ({ reportId }) => {
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, url: true, createdAt: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id, 'You do not have access to this report')
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(audit) }],
      }
    }
  )

  server.tool(
    MCP_TOOLS.getReport.name,
    MCP_TOOLS.getReport.desc,
    { reportId: z.string() },
    async ({ reportId }) => {
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      const outcome = await loadCompletedTaskOutcome(reportId)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(outcome),
          },
        ],
      }
    }
  )
}
