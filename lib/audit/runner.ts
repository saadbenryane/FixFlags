import { prisma } from '../db'
import { runWithContext } from '@/lib/logger/context'
import { AUDIT_PROGRESS } from './progress'
import { AUDIT_DEADLINE_MS } from './pipeline-config'
import { isNonRetryableAuditError } from './pipeline-errors'
import { JudgeContractError } from './validate-judge-output'
import { initPipelineLog, logPipelineEvent } from './pipeline-log'
import { discoverCriticalPathUrls } from './critical-path'
import { copyParentArtifacts } from './copy-parent-artifacts'
import { persistTriageResults } from './persist'
import {
  tryResolveEvidenceAnchorsForAudit,
  mergeFlowCtaEvidenceAnchors,
} from './persist-evidence-anchors'
import {
  finalizeTriageAudit,
  finalizeDeterministicOnly,
  persistFailedAuditCost,
} from './finalize'
import { enqueueAiReview } from './enqueue-ai-review'
import { runPage } from './pipeline/run-page'
import { averageScores, buildCombinedTriageOutput } from './pipeline/combine-pages'
import {
  sanitizeAuditErrorMessage,
  tryPartialFinalize,
} from './pipeline/context'
import { deriveAuditFailure } from './pipeline/failure'
import type { PipelineContext, PageRun } from './pipeline/types'

export async function runAudit(auditId: string): Promise<void> {
  return runWithContext({ auditId }, async () => {
    const audit = await prisma.audit.findUnique({ where: { id: auditId } })
    if (!audit) throw new Error(`Audit ${auditId} not found`)
    if (audit.status === 'COMPLETED') return

    const startedAt = new Date()
    const ctx: PipelineContext = {
      auditId,
      deadline: Date.now() + AUDIT_DEADLINE_MS,
      startedAt,
      pagespeedCalls: 0,
      usage: { inputTokens: 0, outputTokens: 0, models: [] },
      includeAi: audit.includeAi,
    }

    const isSummaryOnly = audit.recheckMode === 'SUMMARY_ONLY'
    const summarySourceId = isSummaryOnly ? (audit.parentId ?? auditId) : null

    if (isSummaryOnly && summarySourceId) {
      if (summarySourceId !== auditId) {
        await prisma.$transaction([
          prisma.screenshot.deleteMany({ where: { auditId } }),
          prisma.auditPage.deleteMany({ where: { auditId } }),
        ])
        await copyParentArtifacts(auditId, summarySourceId)
      } else {
        await prisma.auditPage.deleteMany({ where: { auditId } })
      }
    } else {
      await prisma.$transaction([
        prisma.screenshot.deleteMany({ where: { auditId } }),
        prisma.auditPage.deleteMany({ where: { auditId } }),
      ])
    }

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: isSummaryOnly ? 'CHECKING' : 'CAPTURING',
        startedAt,
        completedAt: null,
        finalizedAt: null,
        errorMsg: null,
        failureCode: null,
        failureStage: null,
        failureMetadata: undefined,
        progress: isSummaryOnly ? AUDIT_PROGRESS.CHECKING : AUDIT_PROGRESS.CAPTURING,
      },
    })

    await initPipelineLog(auditId)

    const pageRuns: PageRun[] = []

    try {
      const primary = await runPage(ctx, {
        url: audit.url,
        position: 0,
        role: 'primary',
        primary: true,
        skipCapture: isSummaryOnly,
        parentId: summarySourceId ?? undefined,
      })
      pageRuns.push(primary)

      const urls =
        audit.auditMode === 'CRITICAL_PATH' && !isSummaryOnly
          ? discoverCriticalPathUrls(audit.url, primary.metadata)
          : [audit.url]

      for (const [index, pageUrl] of urls.slice(1).entries()) {
        pageRuns.push(
          await runPage(ctx, {
            url: pageUrl,
            position: index + 1,
            role: index === 0 ? 'pricing-or-plan' : 'primary-cta',
            primary: false,
          })
        )
      }

      if (!ctx.includeAi) {
        await logPipelineEvent(auditId, { stage: 'finalizing', event: 'triage_only' })
      }

      let triageSucceeded = false
      try {
        const combinedTriage = buildCombinedTriageOutput(pageRuns)
        const flags = pageRuns.flatMap((page) => page.flags)
        const rubricScores = averageScores(pageRuns)
        await logPipelineEvent(auditId, { stage: 'finalizing', event: 'persist_started' })
        await persistTriageResults(auditId, combinedTriage, flags, rubricScores)
        await tryResolveEvidenceAnchorsForAudit(
          auditId,
          audit.url,
          flags.map((flag) => flag.checkId)
        )
        const primaryFlow = pageRuns.find((page) => page.flowResult)?.flowResult
        if (primaryFlow) {
          await mergeFlowCtaEvidenceAnchors(auditId, primaryFlow)
        }

        await finalizeTriageAudit({
          auditId,
          durationMs: Date.now() - startedAt.getTime(),
          pagespeedCalls: ctx.pagespeedCalls,
          usage: {
            inputTokens: ctx.usage.inputTokens,
            outputTokens: ctx.usage.outputTokens,
            model: ctx.usage.models.join(','),
          },
          evidence: {
            desktopScreenshot: pageRuns.every((page) => page.desktopScreenshot),
            mobileScreenshot: pageRuns.every((page) => page.mobileScreenshot),
            metadata: pageRuns.every((page) => Boolean(page.metadata)),
            aiAssessment: pageRuns.every((page) => Boolean(page.triage)),
            desktopPageSpeed: pageRuns.every((page) => Boolean(page.desktop)),
            mobilePageSpeed: pageRuns.every((page) => Boolean(page.mobile)),
            flowScan: pageRuns.some((page) => page.flowScan),
          },
        })
        triageSucceeded = true

        if (ctx.includeAi) {
          await enqueueAiReview(auditId)
        }
      } catch (triageError) {
        if (triageSucceeded) throw triageError
        await logPipelineEvent(auditId, { stage: 'finalizing', event: 'triage_failed_fallback' })
        await tryResolveEvidenceAnchorsForAudit(
          auditId,
          audit.url,
          pageRuns.flatMap((page) => page.flags.map((flag) => flag.checkId))
        )
        const primaryFlow = pageRuns.find((page) => page.flowResult)?.flowResult
        if (primaryFlow) {
          await mergeFlowCtaEvidenceAnchors(auditId, primaryFlow)
        }
        await finalizeDeterministicOnly({
          auditId,
          durationMs: Date.now() - startedAt.getTime(),
          pagespeedCalls: ctx.pagespeedCalls,
          evidence: {
            desktopScreenshot: pageRuns.every((page) => page.desktopScreenshot),
            mobileScreenshot: pageRuns.every((page) => page.mobileScreenshot),
            metadata: pageRuns.every((page) => Boolean(page.metadata)),
            desktopPageSpeed: pageRuns.every((page) => Boolean(page.desktop)),
            mobilePageSpeed: pageRuns.every((page) => Boolean(page.mobile)),
            flowScan: pageRuns.some((page) => page.flowScan),
          },
        })
      }
    } catch (error) {
      const partialDone = await tryPartialFinalize(ctx, pageRuns, error)
      if (partialDone) return

      const current = await prisma.audit.findUnique({
        where: { id: auditId },
        select: { status: true },
      })

      if (current?.status !== 'FINALIZING' && current?.status !== 'COMPLETED') {
        const { failureCode, failureStage } = deriveAuditFailure(
          error,
          current?.status?.toLowerCase() ?? 'unknown'
        )
        const errorMsg = sanitizeAuditErrorMessage(
          error instanceof Error ? error.message : String(error)
        )

        await logPipelineEvent(auditId, {
          stage: failureStage,
          event: 'failed',
          error: errorMsg,
        })

        await persistFailedAuditCost(auditId, Date.now() - startedAt.getTime(), ctx.pagespeedCalls, {
          inputTokens: ctx.usage.inputTokens,
          outputTokens: ctx.usage.outputTokens,
          model: ctx.usage.models.join(','),
        })

        await prisma.audit.update({
          where: { id: auditId },
          data: {
            status: 'FAILED',
            errorMsg,
            failureCode,
            failureStage,
            failureMetadata: { jobId: auditId },
          },
        })
      }

      if (!isNonRetryableAuditError(error) && !(error instanceof JudgeContractError)) {
        throw error
      }
    }
  })
}
