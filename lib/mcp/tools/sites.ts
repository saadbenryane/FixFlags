import { SiteNotFound } from '@/lib/sites/domain/site-errors'
import { ownedSiteContext } from '@/lib/sites/domain/site-context'
import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { mcpCoreError, mcpStructuredResult } from '@/lib/mcp/contract'
import { mcpOutcomePayload } from '@/lib/mcp/outcome-payload'
import { listSiteOutcomes, loadSiteOutcomeDetails } from '@/lib/sites/outcomes'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteRepairContextPage, loadSiteFlags } from '@/lib/sites/flags'
import { getOwnedRun, requestSiteRun } from '@/lib/sites/application/run-requests'
import { categoryAreaSchema } from '@/lib/sites/domain/execution-spec'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { CheckResultSelectionChanged, RESULT_SELECTION_CHANGED } from '@/lib/sites/check-result-contract'
import { resolveLatestAudit } from '@/lib/sites/application/site-execution'
import { projectUptimeStatus, uptimeStatusProjectSelect } from '@/lib/uptime/status'
import { InvalidUptimeCursorError, loadUptimeHistory, loadUptimeSummary } from '@/lib/uptime/queries'
import { uptimeCursorSchema, uptimeWindowSchema } from '@/lib/uptime/contracts'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { getAppUrl } from '@/lib/get-app-url'
import { repairBriefSchema, repairBriefDeliverySchema, repairContextHashSchema, repairObservationOffsetSchema, repairDocumentOffsetSchema } from '@/lib/sites/repair-brief-contract'
import { deliverSiteRepairBrief } from '@/lib/sites/repair-delivery'
import { MAX_REPAIR_BRIEF_BYTES } from '@/lib/sites/repair-budgets'
import { loadSiteRepairEvidence } from '@/lib/sites/application/repair-evidence'

async function ownedSite(userId: string, siteId: string) {
  const site = await loadSiteRecord(siteId)
  if (!site) throw new SiteNotFound()
  return ownedSiteContext(site, userId).site
}

function toolAnnotations(tool: { title: string; readOnly: boolean }) {
  return {
    title: tool.title,
    readOnlyHint: tool.readOnly,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: !tool.readOnly,
  }
}

export function registerSiteOutcomeTools(server: McpServer, user: User) {
  server.registerTool(
    MCP_TOOLS.listSites.name,
    {
      description: MCP_TOOLS.listSites.desc,
        inputSchema: z.object({}),
        annotations: toolAnnotations(MCP_TOOLS.listSites),
    },
    async () => {
      try {
        const sites = await prisma.project.findMany({
          where: { userId: user.id, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
          orderBy: { updatedAt: 'desc' },
          select: {
            ...uptimeStatusProjectSelect,
            name: true,
            canonicalHost: true,
            siteOutcomes: { where: { enabled: true }, select: { id: true } },
          },
        })
        const now = new Date()
        return mcpStructuredResult({
          sites: sites.map((site) => {
            const uptime = projectUptimeStatus(site, site.uptimeMonitor, now)
            return {
              siteId: site.id,
              name: site.name,
              host: site.canonicalHost,
              outcomeCount: site.siteOutcomes.length,
              watching: uptime.enabled,
              uptime,
            }
          }),
        })
      } catch (error) {
        return mcpCoreError(error)
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.listOutcomes.name,
    {
      description: MCP_TOOLS.listOutcomes.desc,
      inputSchema: z.object({ siteId: z.string().min(1), resultCursor: z.string().max(1024).optional(),
        uptimeWindow: uptimeWindowSchema.optional().describe('Include bounded recorded probe and incident history for this window.'),
        uptimeCursor: uptimeCursorSchema.optional().describe('Continue uptime history using its nextCursor and the same uptimeWindow.'),
      }).refine(input => !input.uptimeCursor || input.uptimeWindow, { message: 'uptimeCursor requires uptimeWindow', path: ['uptimeWindow'] }),
      annotations: toolAnnotations(MCP_TOOLS.listOutcomes),
    },
    async ({ siteId, resultCursor, uptimeWindow, uptimeCursor }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const details = await loadSiteOutcomeDetails(site, { excludeGeneric: true })
        const latestAudit = await resolveLatestAudit(site)
        const resultPage = await loadSiteCheckResultPage(site, latestAudit, resultCursor)
        const uptime = uptimeWindow ? await loadUptimeHistory(site, uptimeWindow, uptimeCursor ?? null)
          : await loadUptimeSummary(site)
        return mcpStructuredResult({
          siteId: site.siteId,
          uptime: uptime ? { ...uptime, scope: UPTIME_COPY.scope, limitation: UPTIME_COPY.limitation } : null,
          checkResults: resultPage.results,
          checkResultsNextCursor: resultPage.nextCursor,
          outcomes: details.map((outcome) => mcpOutcomePayload(outcome)),
        })
      } catch (error) {
        if (error instanceof CheckResultSelectionChanged) {
          const failure = mcpCoreError(error, { code: RESULT_SELECTION_CHANGED, action: 'restart_check_history', message: error.message })
          return { ...failure, ...mcpStructuredResult({ ...failure.structuredContent,
            next: { tool: MCP_TOOLS.listOutcomes.name, arguments: { siteId, uptimeWindow, uptimeCursor } },
          }) }
        }
        if (error instanceof InvalidUptimeCursorError) {
          const failure = mcpCoreError(error, { code: 'INVALID_UPTIME_CURSOR', action: 'restart_uptime_history' })
          return { ...failure, ...mcpStructuredResult({ ...failure.structuredContent,
            next: { tool: MCP_TOOLS.listOutcomes.name, arguments: { siteId, uptimeWindow: uptimeWindow ?? '24h', ...(resultCursor ? { resultCursor } : {}) } },
          }) }
        }
        return mcpCoreError(error)
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.run.name,
    {
      description: MCP_TOOLS.run.desc,
      inputSchema: z.object({
        siteId: z.string().min(1),
        outcomeIds: z.array(z.string().min(1)).max(20).optional(),
        scope: z.enum(['outcomes', 'site', 'category']).default('outcomes'),
        area: categoryAreaSchema.optional(),
        idempotencyKey: z.string().min(8).max(160),
        commit: z.string().max(80).optional(),
        deployment: z.string().max(160).optional(),
        affectedArea: z.string().max(120).optional(),
      }).superRefine((input, context) => {
        if ((input.scope === 'category') !== Boolean(input.area) || input.scope !== 'outcomes' && input.outcomeIds?.length)
          context.addIssue({ code: 'custom', message: 'Select one category, the Site, or Outcomes.' })
      }),
      annotations: toolAnnotations(MCP_TOOLS.run),
    },
    async ({ siteId, scope, area, outcomeIds, idempotencyKey, commit, deployment, affectedArea }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const selected = scope !== 'outcomes' ? [] : outcomeIds?.length ? outcomeIds : (await listSiteOutcomes(site))
          .filter((outcome) => outcome.enabled && outcome.criticality !== 'INFORMATIONAL' && outcome.bindings.some((binding) => binding.required))
          .map((outcome) => outcome.id)
        const run = await requestSiteRun({
          projectId: site.projectId!,
          outcomeIds: selected,
          userId: user.id,
          source: 'MCP',
          scope: scope === 'site' ? 'SITE' : scope === 'category' ? 'CATEGORY' : 'OUTCOMES', categoryArea: area,
          idempotencyKey,
          context: { commit, deployment, affectedArea },
        })
        return mcpStructuredResult({
          status: 'ACCEPTED',
          siteId: site.siteId,
          outcomeIds: run.outcomeIds,
          runId: run.runId,
          reused: run.reused,
          next: { tool: MCP_TOOLS.getRun.name, arguments: { runId: run.runId } },
        })
      } catch (error) {
        return mcpCoreError(error, { action: 'retry' })
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.getRun.name,
    {
      description: MCP_TOOLS.getRun.desc,
      inputSchema: z.object({ runId: z.string().min(1) }),
      annotations: toolAnnotations(MCP_TOOLS.getRun),
    },
    async ({ runId }) => {
      try {
        const run = await getOwnedRun(user.id, runId)
        if (!run) throw new Error('Run not found')
        return mcpStructuredResult(run)
      } catch (error) {
        return mcpCoreError(error)
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.listFlags.name,
    {
      description: MCP_TOOLS.listFlags.desc,
      inputSchema: z.object({ siteId: z.string().min(1) }),
      annotations: toolAnnotations(MCP_TOOLS.listFlags),
    },
    async ({ siteId }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const flags = await loadSiteFlags(site)
        return mcpStructuredResult({
          siteId: site.siteId,
          flags: flags.map((flag) => ({
            flagId: flag.id,
            problem: flag.problem,
            whyItMatters: flag.whyItMatters,
            area: flag.area,
            severity: flag.severity,
          })),
        })
      } catch (error) {
        return mcpCoreError(error)
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.getFlag.name,
    {
      description: MCP_TOOLS.getFlag.desc,
      inputSchema: z.object({ siteId: z.string().min(1), flagId: z.string().min(1),
        expectedContextHash: repairContextHashSchema.optional().describe('Context revision from a copied repair brief. Refuse changed evidence instead of silently switching tasks.'),
        observationOffset: repairObservationOffsetSchema.optional().describe('Continue supporting observations using observationPage.nextOffset and the same expectedContextHash.'),
        documentOffset: repairDocumentOffsetSchema.optional().describe('Continue an oversized brief using the returned retrieval.next request.'),
        expectedDocumentHash: repairContextHashSchema.optional().describe('Exact document revision returned with documentOffset.'),
        includeEvidence: z.boolean().optional().describe('Read recorded performance conditions and the exact source capture, when available. Images are bounded and returned as native image content.'),
      }).refine(input => !input.observationOffset || Boolean(input.expectedContextHash), {
        message: 'Continuing observations requires expectedContextHash', path: ['expectedContextHash'],
      }).refine(input => !input.documentOffset || Boolean(input.expectedContextHash && input.expectedDocumentHash), {
        message: 'Continuing a document requires both revisions', path: ['expectedDocumentHash'],
      }),
      outputSchema: z.object({ siteId: z.string(), repairBrief: repairBriefDeliverySchema, flag: z.object({}).passthrough().nullable() }).strict(),
      annotations: toolAnnotations(MCP_TOOLS.getFlag),
    },
    async ({ siteId, flagId, expectedContextHash, observationOffset, includeEvidence, documentOffset, expectedDocumentHash }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const context = await loadSiteRepairContextPage(site, flagId, getAppUrl(), observationOffset, expectedContextHash)
        if (!context) throw new Error('Flag not found')
        const repairBrief = context.brief
        const attached = includeEvidence ? await loadSiteRepairEvidence(site, repairBrief.flag, `${repairBrief.links.json}&view=capture`) : null
        const complete = attached ? repairBriefSchema.parse({ ...repairBrief, evidence: attached.evidence }) : repairBrief
        const wrapperBytes = Buffer.byteLength(JSON.stringify({ siteId: site.siteId, repairBrief: null, flag: null })) - 4
        const payload = {
          siteId: site.siteId,
          repairBrief: deliverSiteRepairBrief(complete, { documentOffset, expectedDocumentHash }, MAX_REPAIR_BRIEF_BYTES - wrapperBytes),
          flag: {
            flagId: repairBrief.flag.flagId,
            sourceFlagId: repairBrief.flag.sourceFlagId,
            checkId: repairBrief.flag.checkId,
            status: repairBrief.flag.status,
            verificationState: repairBrief.flag.verificationState,
            outcomeId: repairBrief.flag.outcomeId,
            problem: repairBrief.flag.problem,
            evidence: repairBrief.flag.evidence,
            whyItMatters: repairBrief.flag.whyItMatters,
            fix: repairBrief.repair.guidance,
            expectedBehavior: repairBrief.verification.expectedBehavior,
            sourceAuditId: repairBrief.flag.sourceAuditId,
            pageUrl: repairBrief.flag.pageUrl,
            affectedPaths: repairBrief.flag.affectedPaths,
            verificationRule: repairBrief.verification.rule,
            attempts: context.attempts,
            verifying: context.verifying,
          },
        }
        // Compatibility alias only. The canonical brief owns evidence and its
        // continuation; an unbounded duplicate must not bypass that budget.
        const result = mcpStructuredResult(Buffer.byteLength(JSON.stringify(payload)) <= MAX_REPAIR_BRIEF_BYTES
          ? payload : { ...payload, flag: null })
        return !documentOffset && attached?.image && attached.evidence.capture.state === 'available' && attached.evidence.capture.nativeImage ? { ...result, content: [...result.content,
          { type: 'image' as const, mimeType: 'image/png' as const, data: attached.image.toString('base64') }] } : result
      } catch (error) {
        return mcpCoreError(error)
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.recordFix.name,
    {
      description: MCP_TOOLS.recordFix.desc,
      inputSchema: z.object({
        siteId: z.string().min(1),
        flagId: z.string().min(1),
        idempotencyKey: z.string().min(8).max(160),
        changeSummary: z.string().min(3).max(2000),
        commit: z.string().max(120).optional(),
        deployment: z.string().max(300).optional(),
        expectedContextHash: repairContextHashSchema.optional().describe('Context revision from a copied repair brief. Refuse changed evidence instead of silently switching tasks.'),
      }),
      annotations: toolAnnotations(MCP_TOOLS.recordFix),
    },
    async ({ siteId, flagId, idempotencyKey, changeSummary, commit, deployment, expectedContextHash }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const attempt = await recordSiteFlagFix({
          siteId: site.siteId,
          flagId,
          userId: user.id,
          idempotencyKey,
          changeSummary,
          commitReference: commit,
          deploymentReference: deployment,
          client: 'mcp',
          expectedContextHash,
        })
        const admitted = attempt.verificationAuditId ? await prisma.runRequest.findFirst({
          where: { auditId: attempt.verificationAuditId, projectId: site.projectId! }, select: { id: true },
        }) : null
        return mcpStructuredResult({
          status: 'RECORDED',
          ...attempt,
          next: admitted ? { tool: MCP_TOOLS.getRun.name, arguments: { runId: admitted.id } }
            : attempt.outcome ? { tool: MCP_TOOLS.getFlag.name, arguments: { siteId: site.siteId, flagId } } : {
            tool: MCP_TOOLS.verifyFlag.name,
            arguments: { siteId: site.siteId, flagId, attemptId: attempt.attemptId, idempotencyKey: `flag-verify:${attempt.attemptId}` },
          },
        })
      } catch (error) {
        return mcpCoreError(error, { action: 'check_change_context' })
      }
    },
  )

  server.registerTool(
    MCP_TOOLS.verifyFlag.name,
    {
      description: MCP_TOOLS.verifyFlag.desc,
      inputSchema: z.object({
        siteId: z.string().min(1),
        flagId: z.string().min(1),
        attemptId: z.string().min(1),
        idempotencyKey: z.string().min(8).max(160),
      }),
      annotations: toolAnnotations(MCP_TOOLS.verifyFlag),
    },
    async ({ siteId, flagId, attemptId, idempotencyKey }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const result = await executeSiteCommand({
          type: 'VERIFY_FLAG',
          siteId: site.siteId,
          userId: user.id,
          flagId,
          attemptId,
          idempotencyKey,
          source: 'MCP',
        })
        if (!result.ok) throw new Error(result.error)
        return mcpStructuredResult({
          status: 'ACCEPTED',
          siteId: site.siteId,
          flagId,
          runId: 'runId' in result ? result.runId : null,
          auditId: 'verificationAuditId' in result ? result.verificationAuditId : null,
          next:
            'runId' in result && result.runId
              ? {
                  tool: MCP_TOOLS.getRun.name,
                  arguments: { runId: result.runId },
                }
              : null,
        })
      } catch (error) {
        return mcpCoreError(error, { action: 'retry' })
      }
    },
  )
}
