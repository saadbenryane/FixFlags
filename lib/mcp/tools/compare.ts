import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { RUBRIC_ORDER } from '../../audit/constants'
import { computeRubricsFromRows } from '../../audit/rubric'
import { canAccessCompare } from '../../auth/entitlements'
import { assertAuditAccess, assertMcpAccess } from '@/lib/mcp/access'
import { buildAiFlagMatchKey } from '../../audit/validate-judge-output'
import { classifyArbitraryReportFlagDiff } from '../../audit/diff-flags'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

function flagMatchKey(flag: { checkId: string | null; problem: string; rubric: string }): string {
  if (flag.checkId) return `check:${flag.checkId}`
  return buildAiFlagMatchKey(flag.problem, flag.rubric)
}

export function registerCompareTools(server: McpServer, user: User) {
  server.tool(
    MCP_TOOLS.compare.name,
    MCP_TOOLS.compare.desc,
    { beforeId: z.string(), afterId: z.string() },
    async ({ beforeId, afterId }) => {
      const [before, after] = await Promise.all([
        prisma.audit.findUnique({
          where: { id: beforeId },
          include: {
            rubrics: { include: { flags: { select: { severity: true } } } },
            flags: { select: { severity: true, rubric: true } },
          },
        }),
        prisma.audit.findUnique({
          where: { id: afterId },
          include: {
            rubrics: { include: { flags: { select: { severity: true } } } },
            flags: { select: { severity: true, rubric: true } },
          },
        }),
      ])
      if (!before || !after) throw new Error('One or both reports not found')
      await assertAuditAccess(before, user.id)
      await assertAuditAccess(after, user.id)

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!freshUser) throw new Error('User not found')
      if (!canAccessCompare(freshUser)) {
        throw new Error('Upgrade to Pro for before/after compare')
      }

      const scoreDelta = (after.score ?? 0) - (before.score ?? 0)

      const mapRubrics = (audit: typeof before) =>
        audit.rubrics.map((r) => ({
          name: r.name,
          grade: r.grade,
          score: r.score,
          flags: r.flags.map((f) => ({ severity: f.severity })),
        }))

      const beforeRubrics = computeRubricsFromRows(mapRubrics(before), before.flags)
      const afterRubrics = computeRubricsFromRows(mapRubrics(after), after.flags)
      const rubricDeltas = RUBRIC_ORDER.map((name) => {
        const br = beforeRubrics.find((r) => r.name === name)
        const ar = afterRubrics.find((r) => r.name === name)
        return {
          rubric: name,
          before: br?.status ?? 'unknown',
          after: ar?.status ?? 'unknown',
        }
      })

      const [beforeFlags, afterFlags] = await Promise.all([
        prisma.flag.findMany({ where: { auditId: beforeId } }),
        prisma.flag.findMany({ where: { auditId: afterId } }),
      ])

      const afterByKey = new Map(afterFlags.map((f) => [flagMatchKey(f), f]))
      const beforeKeys = new Set(beforeFlags.map((f) => flagMatchKey(f)))

      const fixed: Array<{ checkId: string | null; problem: string; rubric: string; severity: string }> = []
      const unchanged: typeof fixed = []
      const regressed: typeof fixed = []
      const newFlags: typeof fixed = []

      for (const bf of beforeFlags) {
        const key = flagMatchKey(bf)
        const af = afterByKey.get(key)
        const item = {
          checkId: bf.checkId,
          problem: bf.problem,
          rubric: bf.rubric,
          severity: bf.severity,
        }

        if (!af) {
          fixed.push(item)
          continue
        }

        const bucket = classifyArbitraryReportFlagDiff({
          beforeSeverity: bf.severity,
          afterSeverity: af.severity,
        })

        if (bucket === 'regressed') {
          regressed.push({
            checkId: af.checkId,
            problem: af.problem,
            rubric: af.rubric,
            severity: af.severity,
          })
        } else {
          unchanged.push({
            checkId: af.checkId,
            problem: af.problem,
            rubric: af.rubric,
            severity: af.severity,
          })
        }
      }

      for (const af of afterFlags) {
        if (!beforeKeys.has(flagMatchKey(af))) {
          newFlags.push({
            checkId: af.checkId,
            problem: af.problem,
            rubric: af.rubric,
            severity: af.severity,
          })
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              scoreDelta,
              beforeScore: before.score,
              afterScore: after.score,
              rubrics: rubricDeltas,
              flags: {
                fixed: fixed.length,
                unchanged: unchanged.length,
                regressed: regressed.length,
                newFlags: newFlags.length,
                details: { fixed, unchanged, regressed, newFlags },
              },
            }),
          },
        ],
      }
    }
  )

  server.tool(
    MCP_TOOLS.listRecentAudits.name,
    MCP_TOOLS.listRecentAudits.desc,
    {
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Number of audits to return (1-50, default 10)'),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe('Number of audits to skip (default 0)'),
      status: z
        .enum(['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING', 'COMPLETED', 'FAILED'])
        .optional()
        .describe('Filter by audit status'),
      url: z.string().optional().describe('Filter by URL (substring match)'),
    },
    async ({ limit = 10, offset = 0, status, url }) => {
      const freshUser = await assertMcpAccess(user)

      const where: Record<string, unknown> = { userId: freshUser.id }
      if (status) where.status = status
      if (url) where.url = { contains: url }

      const [audits, total] = await Promise.all([
        prisma.audit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            url: true,
            status: true,
            score: true,
            verdict: true,
            createdAt: true,
            completedAt: true,
          },
        }),
        prisma.audit.count({ where }),
      ])

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ audits, total, limit, offset }),
          },
        ],
      }
    }
  )
}
