import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { assertAuditAccess } from '@/lib/mcp/access'
import { loadCompletedTaskOutcome } from '../../audit/task-contracts'

export function registerCheckStatusTools(server: McpServer, user: User) {
  server.tool(
    'ff_get_check_status',
    'Get the current status of a check report',
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
    'ff_get_report',
    'Get the full FixFlags report for a completed check',
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
