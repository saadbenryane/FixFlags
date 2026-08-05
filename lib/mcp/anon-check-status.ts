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

  // Anonymous-safe read of ff_get_report. Serves the same teaser payload the
  // web report route serves: every flag with evidence, at most one demonstrated
  // fix prompt, and never the plan-mode prompt. Public marketing samples keep
  // their full (already-public) sample content.
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
        // 'one' derives the demonstrated flag and gates the plan-mode prompt;
        // marketing samples are fully public and keep their complete content.
        promptAccess: isPublicMarketingSample(audit) ? 'all' : 'one',
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(outcome) }],
      }
    }
  )
}
