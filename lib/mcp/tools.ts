import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { User } from '@prisma/client'
import { createAndEnqueueAudit } from '../audit/create-audit'
import { startRecheckAudit } from '../audit/recheck'
import { getFindingDiffSummary } from '../audit/diff-findings'
import { pollAuditUntilDone } from '../audit/poll-audit'
import { AREA_ORDER } from '../audit/constants'
import { canUseApiKeys } from '../auth/permissions'
import { canAccessCompare, canAccessPaidFeatures } from '../auth/entitlements'
import { hashApiKey } from '@/lib/security/api-keys'
import { recordRateLimit } from '@/lib/security/rate-limit'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import {
  sanitizeAreaForRead,
  sanitizeFindingForRead,
} from '@/lib/audit/sanitize-prompts'

async function assertMcpAccess(user: User): Promise<User> {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh || !canUseApiKeys(fresh)) {
    throw new Error('Upgrade to Pro to use MCP API access')
  }
  return fresh
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
      mode: z
        .enum(['single', 'critical_path'])
        .optional()
        .describe('critical_path audits up to 3 same-origin URLs (Pro+)'),
    },
    async ({ url, waitForCompletion, mode }) => {
      const freshUser = await assertMcpAccess(user)
      const normalizedUrl = (await assertPublicAuditUrl(url)).toString()

      const [userLimit, hostLimit, workerEstimate] = await Promise.all([
        recordRateLimit({
          scope: 'mcp-user',
          identifier: freshUser.id,
          limit: 60,
          windowSeconds: 3600,
        }),
        recordRateLimit({
          scope: 'audit-host',
          identifier: new URL(normalizedUrl).hostname,
          limit: 20,
          windowSeconds: 3600,
        }),
        getWorkerQueueEstimate(),
      ])

      const rateLimitRetryAfter = Math.max(
        userLimit.exceeded ? userLimit.retryAfterSeconds : 0,
        hostLimit.exceeded ? hostLimit.retryAfterSeconds : 0
      )
      const { delayMs, estimatedWaitSeconds, queuePosition, scheduledStartAt } =
        computeEnqueueDelay(rateLimitRetryAfter, workerEstimate)

      const criticalPath = mode === 'critical_path'
      if (criticalPath && !canAccessPaidFeatures(freshUser)) {
        throw new Error('Critical path audits require the Pro plan or above')
      }

      const { auditId } = await createAndEnqueueAudit({
        url: normalizedUrl,
        userId: freshUser.id,
        auditMode: criticalPath ? 'CRITICAL_PATH' : 'SINGLE',
        delayMs,
      })

      let status = 'QUEUED'
      if (waitForCompletion) {
        const result = await pollAuditUntilDone({ auditId })
        status = result.status
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualityos.com'
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              auditId,
              status,
              reportUrl: `${appUrl}/audit/${auditId}`,
              estimatedWaitSeconds,
              queuePosition,
              scheduledStartAt,
              queued: delayMs > 0 || workerEstimate.waitingJobs > 0,
              queueReason:
                delayMs > 0
                  ? 'rate_limit'
                  : workerEstimate.waitingJobs > 0
                    ? 'backlog'
                    : undefined,
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

      const safeArea = sanitizeAreaForRead(auditArea)
      const safeFindings = auditArea.findings.map((f) =>
        sanitizeFindingForRead({ ...f, fix: f.fix, evidence: f.evidence })
      )

      const promptMap: Record<string, string | null | undefined> = {
        generic: safeArea.areaPrompt,
        cursor: safeArea.cursorPrompt,
        claude: safeArea.claudePrompt,
        lovable: safeArea.lovablePrompt,
        bolt: safeArea.boltPrompt,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              area: safeArea.name,
              grade: safeArea.grade,
              score: safeArea.score,
              status: safeArea.status,
              summary: safeArea.summary,
              prompt: promptMap[tool] ?? safeArea.areaPrompt,
              findings: safeFindings.map((f) => ({
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

      const safeFinding = sanitizeFindingForRead({
        ...finding,
        fix: finding.fix,
        evidence: finding.evidence,
      })

      const promptMap: Record<string, string | null | undefined> = {
        generic: safeFinding.agentPrompt,
        cursor: safeFinding.cursorPrompt,
        claude: safeFinding.claudePrompt,
        lovable: safeFinding.lovablePrompt,
        bolt: safeFinding.boltPrompt,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: safeFinding.id,
              severity: safeFinding.severity,
              problem: safeFinding.problem,
              evidence: safeFinding.evidence,
              whyItMatters: safeFinding.whyItMatters,
              fix: safeFinding.fix,
              prompt: promptMap[tool] ?? safeFinding.agentPrompt ?? safeFinding.fix,
              verificationRule: safeFinding.verificationRule,
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

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!freshUser) throw new Error('User not found')
      if (!canAccessCompare(freshUser, after)) {
        throw new Error('Upgrade to Pro or complete your free re-check to compare audits')
      }

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
                  unchanged: findingDiff.unchanged,
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
    where: { keyHash: hashApiKey(key) },
    include: { user: true },
  })
  if (!apiKey || apiKey.revokedAt) return null
  if (!canUseApiKeys(apiKey.user)) return null
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } })
  return apiKey.user
}
