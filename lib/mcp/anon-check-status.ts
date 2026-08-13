import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { PROMPT_TOOL_KEYS } from '@/lib/mcp/builders'
import { loadCompletedTaskOutcome } from '../audit/task-contracts'
import { isPublicMarketingSample } from '@/lib/audit/report-access'

export function registerAnonCheckStatusTools(server: McpServer) {
  server.tool(
    MCP_TOOLS.getCheckStatus.name,
    MCP_TOOLS.getCheckStatus.desc,
    { reportId: z.string() },
    async ({ reportId }) => {
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, url: true, isPublic: true, userId: true },
      })
      if (!audit) throw new Error('Report not found')
      if (audit.userId !== null && !audit.isPublic) {
        throw new Error('This report is not publicly available')
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: audit.id, status: audit.status, url: audit.url }) }],
      }
    }
  )

  // Anonymous-safe read of ff_get_report. Live reports expose every Flag and
  // its public evidence with no prompt or private plan payload. The curated
  // marketing sample alone exposes one explicitly demonstrated prompt.
  server.tool(
    MCP_TOOLS.getReport.name,
    MCP_TOOLS.getReport.desc,
    { reportId: z.string(), tool: z.enum(PROMPT_TOOL_KEYS).optional() },
    async ({ reportId, tool }) => {
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, userId: true, isPublic: true, aiReviewAt: true },
      })
      if (!audit) throw new Error('Report not found')
      if (audit.userId !== null && !audit.isPublic) {
        throw new Error('This report is not publicly available')
      }

      const outcome = await loadCompletedTaskOutcome(reportId, tool, {
        promptAccess: isPublicMarketingSample(audit) ? 'one' : 'none',
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(outcome) }],
      }
    }
  )
}
