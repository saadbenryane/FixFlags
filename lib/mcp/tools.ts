import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../db'
import { User } from '@prisma/client'
import { RUBRIC_ORDER, type RubricName } from '../audit/constants'
import {
  computeRubricsFromRows,
} from '../audit/rubric'
import { canUseApiKeys } from '../auth/permissions'
import {
  canAccessCompare,
  canScanRepositories,
} from '../auth/entitlements'
import { assertAuditAccess, assertMcpAccess } from '@/lib/mcp/access'
import { createAndEnqueueRepoScan, RepoScanRequestError } from '@/lib/repo-scan/create-repo-scan'
import { hashApiKey } from '@/lib/security/api-keys'
import { registerTaskTools } from '@/lib/mcp/task-tools'
import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'
import { classifyArbitraryReportFlagDiff } from '@/lib/audit/diff-flags'
import {
  sanitizeFlagForRead,
  sanitizeRubricForRead,
} from '@/lib/audit/sanitize-prompts'
import { buildMcpFlagPayload } from '@/lib/mcp/flag-payload'
import { buildRepoFindingPayload } from '@/lib/mcp/repo-finding-payload'
import { buildFinishPlan, buildFixList } from '@/lib/audit/finish-plan'
import { loadCompletedTaskOutcome } from '@/lib/audit/task-contracts'

function flagMatchKey(flag: { checkId: string | null; problem: string; rubric: string }): string {
  if (flag.checkId) return `check:${flag.checkId}`
  return buildAiFlagMatchKey(flag.problem, flag.rubric)
}

export { assertAuditAccess } from '@/lib/mcp/access'

export function registerAllTools(
  server: McpServer,
  user: User,
  options?: { signal?: AbortSignal }
) {
  registerTaskTools(server, user, options)

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
        select: { id: true, userId: true, isPublic: true },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      const outcome = await loadCompletedTaskOutcome(reportId)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(outcome),
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
      tool: z.enum(['generic', 'cursor', 'claude', 'windsurf', 'lovable', 'bolt']).optional(),
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
        windsurf: safeRubric.windsurfPrompt,
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
      tool: z.enum(['generic', 'cursor', 'claude', 'windsurf', 'lovable', 'bolt']).optional(),
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
            text: JSON.stringify(buildMcpFlagPayload(safeFlag as Parameters<typeof buildMcpFlagPayload>[0], tool)),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_plan_mode_prompt',
    'Get one plan-mode prompt containing every ranked fix for an audit',
    { reportId: z.string() },
    async ({ reportId }) => {
      await assertMcpAccess(user)
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        include: { flags: { orderBy: { position: 'asc' } } },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      if (audit.status !== 'COMPLETED') {
        throw new Error(`Report is ${audit.status}, not COMPLETED`)
      }
      const { parseProductContract } = await import('../audit/product-contract')
      const contract = parseProductContract(audit.productContract)
      const flags = audit.flags.map((f) => ({
        id: f.id,
        checkId: f.checkId,
        rubric: f.rubric,
        severity: f.severity,
        impactTag: f.impactTag,
        problem: f.problem,
        evidence: f.evidence,
        whyItMatters: f.whyItMatters,
        fix: f.fix,
        agentPrompt: f.agentPrompt,
        cursorPrompt: f.cursorPrompt,
        claudePrompt: f.claudePrompt,
        windsurfPrompt: f.windsurfPrompt,
        lovablePrompt: f.lovablePrompt,
        boltPrompt: f.boltPrompt,
        verificationRule: f.verificationRule,
        pageUrl: f.pageUrl,
        confidence: f.confidence,
      }))
      const plan = buildFixList({
        flags,
        url: audit.url,
        contract,
        promptAccess: 'all',
      })
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId,
              url: audit.url,
              prompt: plan.copyPrompt ?? '',
              flagCount: plan.visiblePromptCount,
            }),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_get_product_context',
    'Get Product Intelligence / Product Contract for a report (what the product is, journeys, outcomes)',
    { reportId: z.string() },
    async ({ reportId }) => {
      await assertMcpAccess(user)
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          url: true,
          status: true,
          userId: true,
          isPublic: true,
          productContract: true,
          projectId: true,
          project: { select: { productIntelligence: true, url: true, name: true } },
        },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      const { parseProductContract } = await import('../audit/product-contract')
      const { parseProductIntelligence } = await import('../audit/product-intelligence')
      const contract = parseProductContract(audit.productContract)
      const intelligence = parseProductIntelligence(audit.project?.productIntelligence)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId: audit.id,
              url: audit.url,
              projectUrl: audit.project?.url ?? null,
              productContract: contract,
              productIntelligence: intelligence,
            }),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_get_all_fixes',
    'Get every unresolved Flag and fix prompt for a completed report, ranked by launch impact',
    { reportId: z.string() },
    async ({ reportId }) => {
      await assertMcpAccess(user)
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        select: { id: true, userId: true, isPublic: true, status: true },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      if (audit.status !== 'COMPLETED') {
        throw new Error(`Report is ${audit.status}, not COMPLETED`)
      }
      const outcome = await loadCompletedTaskOutcome(reportId)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(outcome.fixList ?? null),
          },
        ],
      }
    }
  )

  server.tool(
    'ff_get_current_finish_plan',
    'Deprecated compatibility tool: get the three-item Finish Plan for a completed report',
    { reportId: z.string(), limit: z.number().int().min(1).max(3).optional() },
    async ({ reportId }) => {
      await assertMcpAccess(user)
      const audit = await prisma.audit.findUnique({
        where: { id: reportId },
        include: {
          flags: { orderBy: { position: 'asc' } },
          rubrics: { select: { name: true, grade: true } },
        },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      if (audit.status !== 'COMPLETED') {
        throw new Error(`Report is ${audit.status}, not COMPLETED`)
      }
      const { parseProductContract } = await import('../audit/product-contract')
      const contract = parseProductContract(audit.productContract)
      const flags = audit.flags.map((f) => ({
        id: f.id,
        checkId: f.checkId,
        rubric: f.rubric,
        severity: f.severity,
        impactTag: f.impactTag,
        problem: f.problem,
        evidence: f.evidence,
        whyItMatters: f.whyItMatters,
        fix: f.fix,
        agentPrompt: f.agentPrompt,
        cursorPrompt: f.cursorPrompt,
        claudePrompt: f.claudePrompt,
        windsurfPrompt: f.windsurfPrompt,
        lovablePrompt: f.lovablePrompt,
        boltPrompt: f.boltPrompt,
        verificationRule: f.verificationRule,
        pageUrl: f.pageUrl,
        confidence: f.confidence,
        source: f.source,
      }))
      const plan = buildFinishPlan({
        flags,
        rubricRows: audit.rubrics,
        url: audit.url,
        contract,
        promptAccess: 'all',
      })
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId,
              url: audit.url,
              items: plan.items.map((item) => ({
                flagId: item.id,
                checkId: item.checkId,
                problem: item.problem,
                rubric: item.rubricName,
                severity: item.severity,
                impactTag: item.impactTag,
                fixPrompt: item.prompt,
              })),
              planPrompt: plan.copyPrompt ?? '',
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

  server.tool(
    'generate-fix-prompt',
    'Generate a custom fix prompt for any problem description. Useful for Bolt/Lovable users who cannot call ff_check_and_plan directly.',
    {
      problem: z.string().min(10).describe('Describe the issue you want fixed'),
      context: z.string().optional().describe('Page URL, technology stack, or any context'),
      tool: z
        .enum(['generic', 'cursor', 'claude', 'windsurf', 'lovable', 'bolt'])
        .optional()
        .describe('Format the prompt for a specific tool'),
    },
    async ({ problem, context, tool = 'generic' }) => {
      await assertMcpAccess(user)

      const lines: string[] = [problem]

      if (context) {
        lines.push('', `Evidence: ${context}`)
      }

      if (tool === 'cursor') {
        lines.push(
          '',
          'Fix:',
          `1. Fix this issue: ${problem}`,
          '2. Keep the change scoped to the affected file.',
          '3. Preserve existing working behavior outside this issue.',
          '',
          'In Cursor, reference files with @filename for context.',
        )
      } else if (tool === 'claude') {
        lines.push(
          '',
          'Fix:',
          `1. Fix this issue: ${problem}`,
          '2. Keep the change scoped to the affected file.',
          '3. Preserve existing working behavior outside this issue.',
          '',
          'Use terminal commands to find and edit files. Ask questions before assuming file contents.',
        )
      } else if (tool === 'windsurf') {
        lines.push(
          '',
          'Fix:',
          `1. Fix this issue: ${problem}`,
          '2. Keep the change scoped to the affected file.',
          '3. Preserve existing working behavior outside this issue.',
          '',
          'Apply changes one file at a time. Use inline diffs for review before applying.',
        )
      } else if (tool === 'lovable') {
        lines.push(
          '',
          'Fix:',
          `1. Fix this issue: ${problem}`,
          '2. Keep the change scoped to the affected component or page.',
          '3. Preserve existing working behavior outside this issue.',
          '',
          'Use Tailwind CSS classes for all styling.',
        )
      } else if (tool === 'bolt') {
        lines.push(
          '',
          'Fix:',
          `1. Fix this issue: ${problem}`,
          '2. Keep the change scoped to the affected file.',
          '3. Preserve existing working behavior outside this issue.',
          '',
          'Show diffs of every change. Do not rewrite unrelated files.',
        )
      } else {
        lines.push(
          '',
          'Fix:',
          `1. Fix this issue: ${problem}`,
          '2. Keep the change scoped to the affected page, component, or configuration.',
          '3. Preserve existing working behavior outside this issue.',
          '',
          'Verify: Re-check the page after applying the fix and confirm this issue no longer appears.',
        )
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              problem,
              context: context ?? null,
              prompt: lines.join('\n'),
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
