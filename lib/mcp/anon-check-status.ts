import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

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
}
