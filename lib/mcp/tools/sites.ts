import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { mcpCoreError, mcpStructuredResult } from '@/lib/mcp/contract'
import { mcpOutcomePayload } from '@/lib/mcp/outcome-payload'
import { listSiteOutcomes, loadSiteOutcomeDetail } from '@/lib/sites/outcomes'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail, loadSiteFlags } from '@/lib/sites/flags'
import { getOwnedRun, requestSiteRun } from '@/lib/sites/application/run-requests'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { loadSiteCheckResults } from '@/lib/sites/application/check-results'

async function ownedSite(userId: string, siteId: string) {
  const site = await loadSiteRecord(siteId)
  if (!site?.projectId || site.userId !== userId) throw new Error('Site not found')
  return site
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
          where: { userId: user.id, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            canonicalHost: true,
            watchInterval: true,
            siteOutcomes: { where: { enabled: true }, select: { id: true } },
          },
        })
        return mcpStructuredResult({
          sites: sites.map((site) => ({
            siteId: site.id,
            name: site.name,
            host: site.canonicalHost,
            outcomeCount: site.siteOutcomes.length,
            watching: site.watchInterval != null,
          })),
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
      inputSchema: z.object({ siteId: z.string().min(1) }),
      annotations: toolAnnotations(MCP_TOOLS.listOutcomes),
    },
    async ({ siteId }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const outcomes = await listSiteOutcomes(site)
        const details = await Promise.all(
          outcomes
            .filter((outcome) => outcome.kind !== 'GENERIC')
            .map((outcome) => loadSiteOutcomeDetail(site, outcome.id)),
        )
        const latestAudit = await prisma.audit.findFirst({ where: { projectId: site.projectId! }, orderBy: { createdAt: 'desc' }, select: { id: true } })
        return mcpStructuredResult({
          siteId: site.siteId,
          checkResults: await loadSiteCheckResults(site, latestAudit?.id ?? null),
          outcomes: details
            .filter((outcome) => outcome != null)
            .map((outcome) => mcpOutcomePayload(outcome)),
        })
      } catch (error) {
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
        idempotencyKey: z.string().min(8).max(160),
        commit: z.string().max(80).optional(),
        deployment: z.string().max(160).optional(),
        affectedArea: z.string().max(120).optional(),
      }),
      annotations: toolAnnotations(MCP_TOOLS.run),
    },
    async ({ siteId, outcomeIds, idempotencyKey, commit, deployment, affectedArea }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const selected = outcomeIds?.length ? outcomeIds : (await listSiteOutcomes(site))
          .filter((outcome) => outcome.enabled && outcome.criticality !== 'INFORMATIONAL' && outcome.bindings.some((binding) => binding.required))
          .map((outcome) => outcome.id)
        const run = await requestSiteRun({
          projectId: site.projectId!,
          outcomeIds: selected,
          userId: user.id,
          source: 'MCP',
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
      inputSchema: z.object({ siteId: z.string().min(1), flagId: z.string().min(1) }),
      annotations: toolAnnotations(MCP_TOOLS.getFlag),
    },
    async ({ siteId, flagId }) => {
      try {
        const site = await ownedSite(user.id, siteId)
        const flag = await loadSiteFlagDetail(site, flagId)
        if (!flag) throw new Error('Flag not found')
        return mcpStructuredResult({
          siteId: site.siteId,
          flag: {
            flagId: flag.id,
            outcomeId: flag.outcomeId,
            problem: flag.problem,
            evidence: flag.evidence,
            whyItMatters: flag.whyItMatters,
            fix: flag.fix,
            expectedBehavior: flag.expectedBehavior,
            sourceAuditId: flag.sourceAuditId,
            pageUrl: flag.pageUrl,
            attempts: flag.attempts,
            verifying: flag.verifying,
          },
        })
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
      }),
      annotations: toolAnnotations(MCP_TOOLS.recordFix),
    },
    async ({ siteId, flagId, idempotencyKey, changeSummary, commit, deployment }) => {
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
        })
        return mcpStructuredResult({
          status: 'RECORDED',
          ...attempt,
          next: {
            tool: MCP_TOOLS.verifyFlag.name,
            arguments: { siteId: site.siteId, flagId, attemptId: attempt.attemptId },
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
