import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { canScanRepositories } from '../../auth/entitlements'
import { assertMcpAccess } from '@/lib/mcp/access'
import { createAndEnqueueRepoScan, RepoScanRequestError } from '@/lib/repo-scan/create-repo-scan'
import { buildRepoFindingPayload } from '@/lib/mcp/repo-finding-payload'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

export function registerRepoScanTools(server: McpServer, user: User) {
  server.tool(
    MCP_TOOLS.startRepoScan.name,
    MCP_TOOLS.startRepoScan.desc,
    {
      repoFullName: z.string().min(3).describe('Repository full name, e.g. owner/repo'),
    },
    async ({ repoFullName }) => {
      const freshUser = await assertMcpAccess(user)
      if (!canScanRepositories(freshUser)) {
        throw new Error('Repository scanning requires the Agency plan')
      }

      try {
        const { repoScanId } = await createAndEnqueueRepoScan(freshUser.id, repoFullName)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                repoScanId,
                repoFullName,
                status: 'QUEUED',
                reportUrl: `${appUrl}/report/repo/${repoScanId}`,
              }),
            },
          ],
        }
      } catch (err) {
        if (err instanceof RepoScanRequestError) {
          throw new Error(err.message)
        }
        throw err
      }
    }
  )

  server.tool(
    MCP_TOOLS.listRepoScans.name,
    MCP_TOOLS.listRepoScans.desc,
    {
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Number of repo scans to return (1-50, default 10)'),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe('Number of repo scans to skip (default 0)'),
      repoFullName: z.string().optional().describe('Filter by repository full name'),
    },
    async ({ limit = 10, offset = 0, repoFullName }) => {
      const freshUser = await assertMcpAccess(user)
      if (!canScanRepositories(freshUser)) {
        throw new Error('Repository scanning requires the Agency plan')
      }

      const where = {
        userId: freshUser.id,
        ...(repoFullName ? { repoFullName } : {}),
      }

      const [scans, total] = await Promise.all([
        prisma.repoScan.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            repoFullName: true,
            commitSha: true,
            status: true,
            errorMsg: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            _count: { select: { findings: true } },
          },
        }),
        prisma.repoScan.count({ where }),
      ])
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              scans: scans.map((scan) => ({
                repoScanId: scan.id,
                repoFullName: scan.repoFullName,
                reportUrl: `${appUrl}/report/repo/${scan.id}`,
                commitSha: scan.commitSha,
                status: scan.status,
                errorMsg: scan.errorMsg,
                findingCount: scan._count.findings,
                createdAt: scan.createdAt,
                startedAt: scan.startedAt,
                completedAt: scan.completedAt,
              })),
              total,
              limit,
              offset,
            }),
          },
        ],
      }
    }
  )

  server.tool(
    MCP_TOOLS.getRepoScan.name,
    MCP_TOOLS.getRepoScan.desc,
    { repoScanId: z.string() },
    async ({ repoScanId }) => {
      await assertMcpAccess(user)

      const scan = await prisma.repoScan.findUnique({
        where: { id: repoScanId },
        include: { findings: { orderBy: [{ severity: 'asc' }, { filePath: 'asc' }] } },
      })
      if (!scan || scan.userId !== user.id) throw new Error('Repo scan not found')

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'
      const counts = scan.findings.reduce(
        (acc, finding) => {
          if (finding.severity === 'CRITICAL') acc.critical += 1
          else if (finding.severity === 'IMPORTANT') acc.important += 1
          else acc.polish += 1
          return acc
        },
        { critical: 0, important: 0, polish: 0 }
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              repoScanId: scan.id,
              repoFullName: scan.repoFullName,
              reportUrl: `${appUrl}/report/repo/${scan.id}`,
              commitSha: scan.commitSha,
              status: scan.status,
              errorMsg: scan.errorMsg,
              findingCount: scan.findings.length,
              counts,
              findings: scan.findings.map((finding) => ({
                id: finding.id,
                severity: finding.severity,
                category: finding.category,
                filePath: finding.filePath,
                lineStart: finding.lineStart,
                lineEnd: finding.lineEnd,
                problem: finding.problem,
              })),
            }),
          },
        ],
      }
    }
  )

  server.tool(
    MCP_TOOLS.getRepoFinding.name,
    MCP_TOOLS.getRepoFinding.desc,
    {
      findingId: z.string(),
      tool: z.enum(['generic', 'cursor', 'claude', 'windsurf']).optional(),
    },
    async ({ findingId, tool = 'generic' }) => {
      await assertMcpAccess(user)

      const finding = await prisma.repoScanFinding.findUnique({
        where: { id: findingId },
        include: {
          repoScan: {
            select: { userId: true, repoFullName: true, commitSha: true },
          },
        },
      })
      if (!finding || finding.repoScan.userId !== user.id) {
        throw new Error('Repo finding not found')
      }

      const payload = buildRepoFindingPayload(
        {
          id: finding.id,
          repoFullName: finding.repoScan.repoFullName,
          commitSha: finding.repoScan.commitSha,
          severity: finding.severity,
          category: finding.category,
          filePath: finding.filePath,
          lineStart: finding.lineStart,
          lineEnd: finding.lineEnd,
          problem: finding.problem,
          evidence: finding.evidence,
          fix: finding.fix,
          agentPrompt: finding.agentPrompt,
          cursorPrompt: finding.cursorPrompt,
          claudePrompt: finding.claudePrompt,
          windsurfPrompt: finding.windsurfPrompt,
        },
        tool
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(payload),
          },
        ],
      }
    }
  )
}
