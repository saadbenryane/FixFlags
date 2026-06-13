import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { User } from '@prisma/client'
import { createAndEnqueueAudit } from '../audit/create-audit'
import { reserveUserAuditSlot } from '../audit/usage'
import { startRecheckAudit } from '../audit/recheck'
import { getFindingDiffSummary } from '../audit/diff-findings'
import { pollAuditUntilDone } from '../audit/poll-audit'
import { AREA_ORDER } from '../audit/constants'
import { canUseApiKeys } from '../auth/permissions'

async function assertMcpAccess(user: User): Promise<User> {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh || !canUseApiKeys(fresh)) {
    throw new Error('Upgrade to Builder to use MCP API access')
  }
  return fresh
}

async function assertUserCanAudit(user: User): Promise<void> {
  const check = await reserveUserAuditSlot(user.id)
  if (!check.allowed) throw new Error(check.error ?? 'Audit limit reached')
}

const areaEnum = z.enum([
  AREA_ORDER[0],
  AREA_ORDER[1],
  AREA_ORDER[2],
  AREA_ORDER[3],
  AREA_ORDER[4],
  AREA_ORDER[5],
  AREA_ORDER[6],
])

export function registerAllTools(server: McpServer, user: User) {
  // qos_audit_url
  server.tool(
    'qos_audit_url',
    'Start a quality audit for a URL. Returns auditId to poll for results.',
    {
      url: z.string().url(),
      waitForCompletion: z.boolean().optional().describe('Poll until complete (max 90s)'),
    },
    async ({ url, waitForCompletion }) => {
      const freshUser = await assertMcpAccess(user)
      await assertUserCanAudit(freshUser)

      const { auditId } = await createAndEnqueueAudit({ url, userId: freshUser.id })

      let status = 'QUEUED'
      if (waitForCompletion) {
        const result = await pollAuditUntilDone({ auditId })
        status = result.status
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qualityos.com'
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              auditId,
              status,
              reportUrl: `${appUrl}/audit/${auditId}`,
            }),
          },
        ],
      }
    }
  )

  // qos_get_audit_status
  server.tool(
    'qos_get_audit_status',
    'Get the current status of an audit',
    { auditId: z.string() },
    async ({ auditId }) => {
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        select: { id: true, status: true, url: true, createdAt: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Audit not found')
      const { canAccessAudit } = await import('@/lib/audit/access')
      if (!canAccessAudit(audit, { id: user.id })) {
        throw new Error('You do not have access to this audit')
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(audit) }],
      }
    }
  )

  // qos_get_report
  server.tool(
    'qos_get_report',
    'Get the full quality report for a completed audit',
    { auditId: z.string() },
    async ({ auditId }) => {
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        include: {
          areas: { orderBy: { name: 'asc' } },
          screenshots: true,
        },
      })
      if (!audit) throw new Error('Audit not found')
      if (audit.userId && audit.userId !== user.id && !audit.isPublic) {
        throw new Error('Unauthorized')
      }
      if (audit.status !== 'COMPLETED') {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ status: audit.status, message: 'Audit not yet complete' }),
            },
          ],
        }
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              auditId: audit.id,
              url: audit.url,
              pageJob: audit.pageJob,
              pageType: audit.pageType,
              verdict: audit.verdict,
              score: audit.score,
              areas: audit.areas.map((a) => ({
                name: a.name,
                grade: a.grade,
                score: a.score,
                status: a.status,
                summary: a.summary,
              })),
            }),
          },
        ],
      }
    }
  )

  // qos_get_area
  server.tool(
    'qos_get_area',
    'Get detailed findings and fix prompt for a specific quality area',
    {
      auditId: z.string(),
      area: areaEnum,
      tool: z.enum(['generic', 'cursor', 'claude', 'lovable', 'bolt']).optional(),
    },
    async ({ auditId, area, tool = 'generic' }) => {
      const ownerAudit = await prisma.audit.findUnique({ where: { id: auditId }, select: { userId: true, isPublic: true } })
      if (!ownerAudit) throw new Error('Audit not found')
      if (ownerAudit.userId && ownerAudit.userId !== user.id && !ownerAudit.isPublic) {
        throw new Error('Unauthorized')
      }
      const auditArea = await prisma.auditArea.findUnique({
        where: { auditId_name: { auditId, name: area } },
        include: { findings: { orderBy: { position: 'asc' } } },
      })
      if (!auditArea) throw new Error(`Area ${area} not found for audit ${auditId}`)

      const promptMap: Record<string, string | null | undefined> = {
        generic: auditArea.areaPrompt,
        cursor: auditArea.cursorPrompt,
        claude: auditArea.claudePrompt,
        lovable: auditArea.lovablePrompt,
        bolt: auditArea.boltPrompt,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              area: auditArea.name,
              grade: auditArea.grade,
              score: auditArea.score,
              status: auditArea.status,
              summary: auditArea.summary,
              prompt: promptMap[tool] ?? auditArea.areaPrompt,
              findings: auditArea.findings.map((f) => ({
                id: f.id,
                severity: f.severity,
                problem: f.problem,
                evidence: f.evidence,
                fix: f.fix,
              })),
            }),
          },
        ],
      }
    }
  )

  // qos_get_finding
  server.tool(
    'qos_get_finding',
    'Get detailed fix prompt for a specific finding',
    {
      findingId: z.string(),
      tool: z.enum(['generic', 'cursor', 'claude', 'lovable', 'bolt']).optional(),
    },
    async ({ findingId, tool = 'generic' }) => {
      const finding = await prisma.finding.findUnique({ where: { id: findingId }, include: { audit: { select: { userId: true, isPublic: true } } } })
      if (!finding) throw new Error('Finding not found')
      if (finding.audit.userId && finding.audit.userId !== user.id && !finding.audit.isPublic) {
        throw new Error('Unauthorized')
      }

      const promptMap: Record<string, string | null | undefined> = {
        generic: finding.agentPrompt,
        cursor: finding.cursorPrompt,
        claude: finding.claudePrompt,
        lovable: finding.lovablePrompt,
        bolt: finding.boltPrompt,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: finding.id,
              severity: finding.severity,
              problem: finding.problem,
              evidence: finding.evidence,
              whyItMatters: finding.whyItMatters,
              fix: finding.fix,
              prompt: promptMap[tool] ?? finding.agentPrompt ?? finding.fix,
              verificationRule: finding.verificationRule,
            }),
          },
        ],
      }
    }
  )

  // qos_recheck
  server.tool(
    'qos_recheck',
    'Run a new audit on the same URL to check if issues were fixed',
    {
      parentAuditId: z.string(),
      waitForCompletion: z.boolean().optional(),
    },
    async ({ parentAuditId, waitForCompletion }) => {
      await assertMcpAccess(user)

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!freshUser) throw new Error('User not found')

      const outcome = await startRecheckAudit(parentAuditId, freshUser)
      if (!outcome.ok) {
        throw new Error(outcome.error)
      }

      const { auditId } = outcome.result

      let status = 'QUEUED'
      if (waitForCompletion) {
        const result = await pollAuditUntilDone({ auditId })
        status = result.status
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ auditId, status }) }],
      }
    }
  )

  // qos_compare
  server.tool(
    'qos_compare',
    'Compare two audits to see what improved, stayed the same, or regressed',
    { beforeId: z.string(), afterId: z.string() },
    async ({ beforeId, afterId }) => {
      const [before, after] = await Promise.all([
        prisma.audit.findUnique({ where: { id: beforeId }, include: { areas: true } }),
        prisma.audit.findUnique({ where: { id: afterId }, include: { areas: true } }),
      ])
      if (!before || !after) throw new Error('One or both audits not found')
      if (before.userId && before.userId !== user.id && !before.isPublic) throw new Error('Unauthorized')
      if (after.userId && after.userId !== user.id && !after.isPublic) throw new Error('Unauthorized')

      const scoreDelta = (after.score ?? 0) - (before.score ?? 0)
      const areaDeltas = before.areas.map((ba) => {
        const aa = after.areas.find((a) => a.name === ba.name)
        return {
          area: ba.name,
          before: { grade: ba.grade, score: ba.score },
          after: { grade: aa?.grade ?? ba.grade, score: aa?.score ?? ba.score },
          improved: aa && aa.score !== null && ba.score !== null && aa.score > ba.score,
        }
      })

      const findingDiff = await getFindingDiffSummary(beforeId, afterId)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              scoreDelta,
              beforeScore: before.score,
              afterScore: after.score,
              areas: areaDeltas,
              findings: {
                fixed: findingDiff.fixed.length,
                unchanged: findingDiff.unchanged.length,
                regressed: findingDiff.regressed.length,
                newIssues: findingDiff.newIssues.length,
                details: {
                  fixed: findingDiff.fixed,
                  regressed: findingDiff.regressed,
                  newIssues: findingDiff.newIssues,
                },
              },
            }),
          },
        ],
      }
    }
  )
}

export async function validateApiKey(key: string | null): Promise<User | null> {
  if (!key) return null
  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
    include: { user: true },
  })
  if (!apiKey) return null
  if (!canUseApiKeys(apiKey.user)) return null
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } })
  return apiKey.user
}
