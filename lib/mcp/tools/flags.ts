import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { RUBRIC_ORDER, type RubricName } from '../../audit/constants'
import { assertAuditAccess, assertMcpAccess } from '@/lib/mcp/access'
import {
  sanitizeFlagForRead,
  sanitizeRubricForRead,
} from '../../audit/sanitize-prompts'
import { buildMcpFlagPayload } from '@/lib/mcp/flag-payload'
import { loadCompletedTaskOutcome } from '../../audit/task-contracts'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import {
  PROMPT_TOOL_KEYS,
  resolveToolPrompt,
  type PromptToolKey,
} from '@/lib/mcp/builders'
import {
  mcpCoreError,
  mcpErrorOutputSchema,
  mcpStructuredResult,
} from '@/lib/mcp/contract'
import { IMPROVEMENT_REJECTION_REASONS } from '@/lib/improvements/rejection-reasons'

export function registerFlagTools(server: McpServer, user: User) {
  server.tool(
    MCP_TOOLS.getRubric.name,
    MCP_TOOLS.getRubric.desc,
    {
      reportId: z.string(),
      rubric: z.enum(RUBRIC_ORDER as unknown as [string, ...string[]]),
      tool: z.enum(PROMPT_TOOL_KEYS).optional(),
    },
    async ({ reportId, rubric, tool = 'universal' }) => {
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
      const outcome = await loadCompletedTaskOutcome(reportId, tool)
      const thisRubric = outcome.rubrics?.find((item) => item.name === rubric)
      const rubricFlags = (outcome.fixList?.items ?? []).filter(
        (flag) => flag.rubric === rubric
      )

      const promptMap: Record<PromptToolKey, string | null | undefined> = {
        universal: safeRubric.rubricPrompt,
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
              prompt: resolveToolPrompt(promptMap, tool, safeRubric.rubricPrompt),
              promptError: resolveToolPrompt(promptMap, tool, safeRubric.rubricPrompt)
                ? undefined
                : `No validated ${tool} prompt is available for this rubric.`,
              flagCount: rubricFlags.length,
              flags: rubricFlags.map((flag) => ({
                id: flag.flagId,
                severity: flag.severity,
                problem: flag.problem,
                evidence: flag.evidence,
                fix: flag.selectedPrompt,
              })),
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    MCP_TOOLS.getFlag.name,
    {
      description: MCP_TOOLS.getFlag.desc,
      inputSchema: {
        flagId: z.string(),
        tool: z.enum(PROMPT_TOOL_KEYS).optional(),
      },
      outputSchema: z.union([
        z.object({ id: z.string() }).passthrough(),
        mcpErrorOutputSchema,
      ]),
      annotations: {
        title: 'Get Flag evidence and fix prompt', readOnlyHint: true,
        destructiveHint: false, idempotentHint: true, openWorldHint: false,
      },
    },
    async ({ flagId, tool = 'universal' }) => {
      try {
      const flag = await prisma.flag.findUnique({
        where: { id: flagId },
        include: { audit: { select: { userId: true, isPublic: true } } },
      })
      if (!flag) throw new Error('Flag not found')
      await assertAuditAccess(flag.audit, user.id)

      const safeFlag = sanitizeFlagForRead(flag)

      return mcpStructuredResult(
        buildMcpFlagPayload(
          safeFlag as Parameters<typeof buildMcpFlagPayload>[0],
          tool
        ) as unknown as Record<string, unknown>
      )
      } catch (error) {
        return mcpCoreError(error)
      }
    }
  )

  server.tool(
    MCP_TOOLS.planModePrompt.name,
    MCP_TOOLS.planModePrompt.desc,
    { reportId: z.string(), tool: z.enum(PROMPT_TOOL_KEYS).optional() },
    async ({ reportId, tool = 'universal' }) => {
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
      const outcome = await loadCompletedTaskOutcome(reportId, tool)
      const items = outcome.fixList?.items ?? []
      const unavailable = items
        .filter((item) => !item.selectedPrompt)
        .map((item) => item.flagId)
      const selectedPrompts = items
        .map((item) => item.selectedPrompt)
        .filter((prompt): prompt is string => Boolean(prompt))
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId,
              url: audit.url,
              tool,
              prompt: unavailable.length === 0 ? selectedPrompts.join('\n\n') : null,
              promptError:
                unavailable.length > 0
                  ? `No validated ${tool} prompt is available for ${unavailable.length} Flags.`
                  : undefined,
              unavailableFlagIds: unavailable,
              flagCount: selectedPrompts.length,
              totalCount: items.length,
            }),
          },
        ],
      }
    }
  )

  server.tool(
    MCP_TOOLS.getAllFixes.name,
    MCP_TOOLS.getAllFixes.desc,
    { reportId: z.string(), tool: z.enum(PROMPT_TOOL_KEYS).optional() },
    async ({ reportId, tool }) => {
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
      const outcome = await loadCompletedTaskOutcome(reportId, tool)
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
    MCP_TOOLS.getProductContext.name,
    MCP_TOOLS.getProductContext.desc,
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
          project: {
            select: {
              productIntelligence: true,
              url: true,
              name: true,
              improvements: {
                orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
                include: {
                  attempts: { orderBy: { createdAt: 'desc' }, take: 3 },
                  occurrences: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { flag: { select: { evidence: true } } },
                  },
                },
              },
              signals: {
                where: {
                  occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                },
                orderBy: { occurredAt: 'desc' },
                take: 500,
                select: {
                  kind: true,
                  name: true,
                  route: true,
                  sessionHash: true,
                  numericValue: true,
                  release: { select: { externalId: true } },
                },
              },
            },
          },
        },
      })
      if (!audit) throw new Error('Report not found')
      await assertAuditAccess(audit, user.id)
      const { parseProductContract } = await import('../../audit/product-contract')
      const { parseProductIntelligence } = await import('../../audit/product-intelligence')
      const contract = parseProductContract(audit.productContract)
      const intelligence = parseProductIntelligence(audit.project?.productIntelligence)
      const { synthesizeProductSignals } = await import('@/lib/signals/judgment')
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
              attention:
                audit.project?.improvements
                  .filter(
                    (improvement) =>
                      !['VERIFIED', 'REJECTED', 'SUPERSEDED'].includes(improvement.status)
                  )
                  .slice(0, 3) ?? [],
              improvementHistory: audit.project?.improvements ?? [],
              signalContext: synthesizeProductSignals(audit.project?.signals ?? []),
            }),
          },
        ],
      }
    }
  )

  server.tool(
    MCP_TOOLS.getCurrentFinishPlan.name,
    MCP_TOOLS.getCurrentFinishPlan.desc,
    {
      reportId: z.string(),
      limit: z.number().int().min(1).max(3).optional(),
      tool: z.enum(PROMPT_TOOL_KEYS).optional(),
    },
    async ({ reportId, limit = 3, tool }) => {
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
      const outcome = await loadCompletedTaskOutcome(reportId, tool, {
        finishPlanLimit: limit,
      })
      const plan = outcome.finishPlan
      const items = plan?.items ?? []
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId,
              url: plan?.url ?? audit.url,
              items,
              planPrompt: plan?.planPrompt ?? '',
              selectedCount: items.length,
              totalCount: outcome.fixList?.totalCount ?? items.length,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    MCP_TOOLS.markFixAttempted.name,
    {
      description: MCP_TOOLS.markFixAttempted.desc,
      inputSchema: {
        flagId: z.string(),
        action: z.enum(['ACCEPT', 'READY_TO_VERIFY', 'REJECT']),
        changeSummary: z.string().trim().min(1).optional(),
        deploymentReference: z.string().trim().min(1).optional(),
        rejectionReason: z.enum(IMPROVEMENT_REJECTION_REASONS).optional(),
        rejectionNote: z.string().trim().min(1).optional(),
      },
      outputSchema: z.union([
        z.object({
          flagId: z.string(),
          action: z.enum(['ACCEPT', 'READY_TO_VERIFY', 'REJECT']),
          productId: z.string(),
          improvementId: z.string(),
          sourceReviewId: z.string(),
          nextAction: z.object({ type: z.string(), command: z.string().optional() }),
        }).passthrough(),
        mcpErrorOutputSchema,
      ]),
      annotations: {
        title: 'Record Improvement decision', readOnlyHint: false,
        destructiveHint: false, idempotentHint: true, openWorldHint: false,
      },
    },
    async ({
      flagId,
      action,
      changeSummary,
      deploymentReference,
      rejectionReason,
      rejectionNote,
    }) => {
      try {
        if (action === 'READY_TO_VERIFY' && !changeSummary) {
          throw Object.assign(
            new Error('changeSummary is required when a change is ready to verify'),
            { code: 'INVALID_INPUT', action: 'provide_change_summary' }
          )
        }
        if (action === 'REJECT' && !rejectionReason) {
          throw Object.assign(
            new Error('rejectionReason is required when rejecting a recommendation'),
            { code: 'INVALID_INPUT', action: 'choose_rejection_reason' }
          )
        }
        const { recordFlagImprovementAttempt } = await import('@/lib/improvements/service')
        const result = await recordFlagImprovementAttempt({
          flagId,
          userId: user.id,
          builder: 'MCP',
          action,
          changeSummary,
          deploymentReference,
          rejectionReason,
          rejectionNote,
        })
        return mcpStructuredResult(result)
      } catch (error) {
        return mcpCoreError(error, {
          code: 'IMPROVEMENT_ATTEMPT_FAILED',
          action: 'review_flag_and_retry',
        })
      }
    }
  )
}
