import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { User } from '@prisma/client'
import { createAndEnqueueAudit } from '../audit/create-audit'
import { startMonitoringAudit } from '../audit/monitoring'
import { pollAuditUntilDone } from '../audit/poll-audit'
import { RUBRIC_ORDER, type RubricName } from '../audit/constants'
import {
  computeRubricsFromRows,
  computeShareStatusFromRubrics,
} from '../audit/rubric'
import { canUseApiKeys } from '../auth/permissions'
import {
  canAccessCompare,
  canAccessPaidFeatures,
  canScanRepositories,
  canSharePublicly,
} from '../auth/entitlements'
import { canAccessAudit } from '../audit/access'
import { createAndEnqueueRepoScan, RepoScanRequestError } from '@/lib/repo-scan/create-repo-scan'
import { hashApiKey } from '@/lib/security/api-keys'
import { recordRateLimit } from '@/lib/security/rate-limit'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { buildAttribution } from '@/lib/leads/attribution'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'
import { classifyArbitraryReportFlagDiff } from '@/lib/audit/diff-flags'
import {
  sanitizeFlagForRead,
  sanitizeRubricForRead,
} from '@/lib/audit/sanitize-prompts'
import { buildMcpFlagPayload } from '@/lib/mcp/flag-payload'
import { buildRepoFindingPayload } from '@/lib/mcp/repo-finding-payload'

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

export async function assertAuditAccess(
  audit: { userId: string | null; isPublic: boolean },
  userId: string,
  message = 'Unauthorized'
): Promise<void> {
  if (!canAccessAudit(audit, { id: userId })) {
    throw new Error(message)
  }
  // canAccessAudit only checks the audit's own isPublic bit, which can go stale:
  // if the owner's plan/subscription later lapses, canSharePublicly(owner) turns
  // false but nothing un-publishes already-public audits. Re-check the owner's
  // LIVE entitlement here so a downgraded owner's fix-prompt content doesn't stay
  // exposed to non-owners via MCP indefinitely - matches the live re-check the
  // web report UI already does for the same content (canViewAiViaAgencyPublicShare
  // in lib/audit/report-access.ts).
  const isOwner = audit.userId === userId
  if (isOwner || !audit.userId) return
  const owner = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, role: true, plan: true, subscriptionStatus: true },
  })
  if (!owner || !canSharePublicly(owner)) {
    throw new Error(message)
  }
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
      await assertAuditAccess(audit, user.id)
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
      await assertAuditAccess(ownerAudit, user.id)

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
      await assertAuditAccess(flag.audit, user.id)

      const safeFlag = sanitizeFlagForRead(flag)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(buildMcpFlagPayload(safeFlag, tool)),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_monitoring',
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

      const outcome = await startMonitoringAudit(parentReportId, freshUser, { delayMs })
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
    'ff_start_repo_scan',
    'Start a GitHub repository code scan for an allow-listed repo. Returns repoScanId.',
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
    'ff_list_repo_scans',
    'List recent GitHub repository scans and finding counts.',
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
    'ff_get_repo_scan',
    'Get a completed GitHub repository scan with code findings for branch-ready fixes.',
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
    'ff_get_repo_finding',
    'Get a branch-ready fix task for one GitHub repository scan finding.',
    {
      findingId: z.string(),
      tool: z.enum(['generic', 'cursor', 'claude']).optional(),
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
        problem,
      ]

      if (context) {
        promptParts.push('', `Evidence: ${context}`)
      }

      promptParts.push(
        '',
        'Fix:',
        `1. Fix this issue: ${problem}`,
        '2. Keep the change scoped to the affected page, component, or configuration.',
        '3. Preserve existing working behavior outside this issue.',
        '',
        'Verify: Re-check the page after applying the fix and confirm this issue no longer appears.',
        '',
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
