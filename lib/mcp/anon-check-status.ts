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
        select: { id: true, status: true, url: true, createdAt: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Report not found')
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(audit) }],
      }
    }
  )
}
