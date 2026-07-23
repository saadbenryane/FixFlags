import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../db'
import { User } from '@prisma/client'
import { RUBRIC_ORDER, type RubricName } from '../../audit/constants'
import { computeRubricsFromRows } from '../../audit/rubric'
import { assertAuditAccess, assertMcpAccess } from '@/lib/mcp/access'
import {
  sanitizeFlagForRead,
  sanitizeRubricForRead,
} from '../../audit/sanitize-prompts'
import { buildMcpFlagPayload } from '@/lib/mcp/flag-payload'
import { buildUnifiedFinishPlan } from '../../audit/load-finish-plan-flags'

export function registerFlagTools(server: McpServer, user: User) {
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
    'Get a single plan-mode Finish Plan prompt for an audit (paste into Cursor/Claude plan mode)',
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
      const { parseProductContract } = await import('../../audit/product-contract')
      const contract = parseProductContract(audit.productContract)
      const plan = await buildUnifiedFinishPlan({
        userId: audit.userId,
        auditUrl: audit.url,
        flags: audit.flags,
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
      const { parseProductContract } = await import('../../audit/product-contract')
      const { parseProductIntelligence } = await import('../../audit/product-intelligence')
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
    'ff_get_current_finish_plan',
    'Get the current Finish Plan (top prioritized improvements) for a completed report',
    { reportId: z.string(), limit: z.number().int().min(1).max(3).optional() },
    async ({ reportId, limit }) => {
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
      const { parseProductContract } = await import('../../audit/product-contract')
      const contract = parseProductContract(audit.productContract)
      const plan = await buildUnifiedFinishPlan({
        userId: audit.userId,
        auditUrl: audit.url,
        flags: audit.flags,
        rubricRows: audit.rubrics,
        contract,
        promptAccess: 'all',
        limit,
      })
      const items = plan.items.slice(0, limit ?? plan.items.length)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              reportId,
              url: audit.url,
              items: items.map((item) => ({
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
}

