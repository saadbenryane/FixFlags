import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { User } from '@prisma/client'
import { createAndEnqueueAudit } from '../audit/create-audit'
import { startRecheckAudit } from '../audit/recheck'
import { pollAuditUntilDone } from '../audit/poll-audit'
import { RUBRIC_ORDER, type RubricName } from '../audit/constants'
import {
  computeRubricsFromRows,
  computeShareStatusFromRubrics,
} from '../audit/rubric'
import { canUseApiKeys } from '../auth/permissions'
import { canAccessCompare, canAccessPaidFeatures } from '../auth/entitlements'
import { hashApiKey } from '@/lib/security/api-keys'
import { recordRateLimit } from '@/lib/security/rate-limit'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { buildAttribution } from '@/lib/leads/attribution'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'
import {
  sanitizeFlagForRead,
  sanitizeRubricForRead,
} from '@/lib/audit/sanitize-prompts'

async function assertMcpAccess(user: User): Promise<User> {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh || !canUseApiKeys(fresh)) {
    throw new Error('Upgrade to Pro to use MCP API access')
  }
  return fresh
}

function flagMatchKey(flag: { checkId: string | null; problem: string; rubric: string }): string {
  if (flag.checkId) return `check:${flag.checkId}`
  return buildAiFlagMatchKey(flag.problem, flag.rubric)
}

export function registerAllTools(
  server: McpServer,
  user: User,
  options?: { signal?: AbortSignal }
) {
  const abortSignal = options?.signal

  server.tool(
    'ff_check_url',
    'Start a FixFlags check for a URL. Returns reportId to poll for results.',
    {
      url: z.string().url(),
      waitForCompletion: z.boolean().optional().describe('Poll until complete (max 90s)'),
      mode: z
        .enum(['single', 'critical_path'])
        .optional()
        .describe('critical_path checks up to 3 same-origin URLs (Pro+)'),
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
        throw new Error('Critical path checks require the Pro plan or above')
      }

      const { auditId } = await createAndEnqueueAudit({
        url: normalizedUrl,
        userId: freshUser.id,
        auditMode: criticalPath ? 'CRITICAL_PATH' : 'SINGLE',
        delayMs,
        attribution: buildAttribution({
          url: normalizedUrl,
          source: 'MCP',
        }),
      })

      let status = 'QUEUED'
      if (waitForCompletion) {
        const result = await pollAuditUntilDone({ auditId, signal: abortSignal })
        status = result.status
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com'
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId: auditId,
              status,
              reportUrl: `${appUrl}/report/${auditId}`,
              estimatedWaitSeconds,
              rateLimitRetryAfter,
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
      const { canAccessAudit } = await import('@/lib/audit/access')
      if (!canAccessAudit(audit, { id: user.id })) {
        throw new Error('You do not have access to this report')
      }
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
        include: {
          rubrics: {
            orderBy: { name: 'asc' },
            include: { flags: { select: { severity: true } } },
          },
          flags: { select: { severity: true, rubric: true } },
          screenshots: true,
        },
      })
      if (!audit) throw new Error('Report not found')
      if (audit.userId && audit.userId !== user.id && !audit.isPublic) {
        throw new Error('Unauthorized')
      }
      if (audit.status !== 'COMPLETED') {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ status: audit.status, message: 'Check not yet complete' }),
            },
          ],
        }
      }

      const rubricSources = audit.rubrics.map((r) => ({
        name: r.name,
        grade: r.grade,
        score: r.score,
        flags: r.flags.map((f) => ({ severity: f.severity })),
      }))
      const flatFlags = audit.flags.map((f) => ({ severity: f.severity, rubric: f.rubric }))
      const rubrics = computeRubricsFromRows(rubricSources, flatFlags)
      const shareStatus = computeShareStatusFromRubrics(rubricSources, flatFlags)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId: audit.id,
              url: audit.url,
              pageJob: audit.pageJob,
              pageType: audit.pageType,
              verdict: audit.verdict,
              score: audit.score,
              shareStatus,
              rubrics: rubrics.map((r) => ({
                name: r.name,
                status: r.status,
                flagCount: r.flagCount,
                criticalCount: r.criticalCount,
                importantCount: r.importantCount,
              })),
              rubricDetails: audit.rubrics.map((r) => ({
                name: r.name,
                grade: r.grade,
                score: r.score,
                status: r.status,
                summary: r.summary,
              })),
            }),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_get_rubric',
    'Get rubric status and all flags for a rubric',
    {
      reportId: z.string(),
      rubric: z.enum(RUBRIC_ORDER as unknown as [string, ...string[]]),
      tool: z.enum(['generic', 'cursor', 'claude', 'lovable', 'bolt']).optional(),
    },
    async ({ reportId, rubric, tool = 'generic' }) => {
      const ownerAudit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { userId: true, isPublic: true },
      })
      if (!ownerAudit) throw new Error('Report not found')
      if (ownerAudit.userId && ownerAudit.userId !== user.id && !ownerAudit.isPublic) {
        throw new Error('Unauthorized')
      }

      const rubricRow = await prisma.reportRubric.findUnique({
        where: { auditId_name: { auditId: reportId, name: rubric as RubricName } },
        include: { flags: { orderBy: { position: 'asc' } } },
      })
      if (!rubricRow) throw new Error(`Rubric ${rubric} not found for report ${reportId}`)

      const safeRubric = sanitizeRubricForRead(rubricRow)
      const rubricSources = [
        {
          name: rubricRow.name,
          grade: rubricRow.grade,
          score: rubricRow.score,
          flags: rubricRow.flags.map((f) => ({ severity: f.severity })),
        },
      ]
      const computed = computeRubricsFromRows(rubricSources)
      const thisRubric = computed.find((r) => r.name === rubric)

      const promptMap: Record<string, string | null | undefined> = {
        generic: safeRubric.rubricPrompt,
        cursor: safeRubric.cursorPrompt,
        claude: safeRubric.claudePrompt,
        lovable: safeRubric.lovablePrompt,
        bolt: safeRubric.boltPrompt,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              rubric,
              status: thisRubric?.status ?? 'unknown',
              grade: rubricRow.grade,
              score: rubricRow.score,
              summary: safeRubric.summary,
              prompt: promptMap[tool] ?? safeRubric.rubricPrompt,
              flagCount: rubricRow.flags.length,
              flags: rubricRow.flags.map((f) => {
                const safe = sanitizeFlagForRead(f)
                return {
                  id: safe.id,
                  severity: safe.severity,
                  problem: safe.problem,
                  evidence: safe.evidence,
                  fix: safe.fix,
                }
              }),
            }),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_get_flag',
    'Get detailed fix prompt for a specific flag',
    {
      flagId: z.string(),
      tool: z.enum(['generic', 'cursor', 'claude', 'lovable', 'bolt']).optional(),
    },
    async ({ flagId, tool = 'generic' }) => {
      const flag = await prisma.flag.findUnique({
        where: { id: flagId },
        include: { audit: { select: { userId: true, isPublic: true } } },
      })
      if (!flag) throw new Error('Flag not found')
      if (flag.audit.userId && flag.audit.userId !== user.id && !flag.audit.isPublic) {
        throw new Error('Unauthorized')
      }

      const safeFlag = sanitizeFlagForRead(flag)

      const promptMap: Record<string, string | null | undefined> = {
        generic: safeFlag.agentPrompt,
        cursor: safeFlag.cursorPrompt,
        claude: safeFlag.claudePrompt,
        lovable: safeFlag.lovablePrompt,
        bolt: safeFlag.boltPrompt,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: safeFlag.id,
              rubric: safeFlag.rubric,
              severity: safeFlag.severity,
              problem: safeFlag.problem,
              evidence: safeFlag.evidence,
              whyItMatters: safeFlag.whyItMatters,
              fix: safeFlag.fix,
              prompt: promptMap[tool] ?? safeFlag.agentPrompt ?? safeFlag.fix,
              verificationRule: safeFlag.verificationRule,
            }),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_recheck',
    'Run a new check on the same URL to verify fixes',
    {
      parentReportId: z.string(),
      waitForCompletion: z.boolean().optional(),
    },
    async ({ parentReportId, waitForCompletion }) => {
      await assertMcpAccess(user)

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!freshUser) throw new Error('User not found')

      const [userLimit, workerEstimate] = await Promise.all([
        recordRateLimit({
          scope: 'mcp-user',
          identifier: freshUser.id,
          limit: 60,
          windowSeconds: 3600,
        }),
        getWorkerQueueEstimate(),
      ])

      const rateLimitRetryAfter = userLimit.exceeded ? userLimit.retryAfterSeconds : 0
      const { delayMs, estimatedWaitSeconds, queuePosition, scheduledStartAt } =
        computeEnqueueDelay(rateLimitRetryAfter, workerEstimate)

      const outcome = await startRecheckAudit(parentReportId, freshUser)
      if (!outcome.ok) {
        throw new Error(outcome.error)
      }

      const { auditId } = outcome.result

      let status = 'QUEUED'
      if (waitForCompletion) {
        const result = await pollAuditUntilDone({ auditId, signal: abortSignal })
        status = result.status
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId: auditId,
              status,
              rateLimitRetryAfter,
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

  server.tool(
    'ff_compare',
    'Compare two reports to see what improved, stayed the same, or regressed',
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
      if (before.userId && before.userId !== user.id && !before.isPublic) throw new Error('Unauthorized')
      if (after.userId && after.userId !== user.id && !after.isPublic) throw new Error('Unauthorized')

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!freshUser) throw new Error('User not found')
      if (!canAccessCompare(freshUser, after)) {
        throw new Error('Upgrade to Pro or complete your free re-check to compare reports')
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

        if (bf.status === 'FIXED' || af.status === 'FIXED') {
          fixed.push(item)
        } else if (bf.status === 'REGRESSED' || af.status === 'REGRESSED') {
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
    'ff_list_recent_audits',
    'List recent audits with status, score, and key metadata. Supports pagination and filtering.',
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

  server.tool(
    'generate-fix-prompt',
    'Generate a custom fix prompt for any problem description. Useful for Bolt/Lovable users who cannot call ff_check_url directly.',
    {
      problem: z.string().min(10).describe('Describe the issue you want fixed'),
      context: z.string().optional().describe('Page URL, technology stack, or any context'),
      tool: z
        .enum(['generic', 'cursor', 'claude', 'lovable', 'bolt'])
        .optional()
        .describe('Format the prompt for a specific tool'),
    },
    async ({ problem, context, tool = 'generic' }) => {
      await assertMcpAccess(user)

      const promptParts: string[] = [
        '## Fix this issue',
        '',
        `**Problem:** ${problem}`,
      ]

      if (context) {
        promptParts.push('', `**Context:** ${context}`)
      }

      promptParts.push(
        '',
        '**Required changes:**',
        `1. ${problem}`,
        '',
        '**Evidence:** See the referenced page section.',
        '',
        '**Verification:** Re-check the page after applying to confirm the fix landed.',
        '',
        '---',
        `Generated by FixFlags MCP | Format: ${tool}`
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              problem,
              context: context ?? null,
              prompt: promptParts.join('\n'),
              tool,
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
