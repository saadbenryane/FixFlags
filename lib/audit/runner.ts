import { prisma } from '../db'
import { Prisma } from '@prisma/client'
import { runWithContext } from '@/lib/logger/context'
import { AUDIT_PROGRESS } from './progress'
import { AUDIT_DEADLINE_MS } from './pipeline-config'
import { isNonRetryableAuditError } from './pipeline-errors'
import { JudgeContractError } from './validate-judge-output'
import { initPipelineLog, logPipelineEvent } from './pipeline-log'
import { discoverCriticalPathUrls } from './critical-path'
import { persistFailedAuditCost } from './finalize'
import { runPage } from './pipeline/run-page'
import {
  sanitizeAuditErrorMessage,
  tryPartialFinalize,
} from './pipeline/context'
import { deriveAuditFailure } from './pipeline/failure'
import {
  finalizeFromOutcome,
  retryPrimaryTriage,
} from './pipeline/finalize-from-outcome'
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

    // Always fresh capture, including parented re-checks.
    await prisma.$transaction([
      prisma.screenshot.deleteMany({ where: { auditId } }),
      prisma.auditPage.deleteMany({ where: { auditId } }),
    ])

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'CAPTURING',
        startedAt,
        completedAt: null,
        finalizedAt: null,
        errorMsg: null,
        failureCode: null,
        failureStage: null,
        failureMetadata: Prisma.JsonNull,
        progress: AUDIT_PROGRESS.CAPTURING,
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
      })
      pageRuns.push(primary)

      const discovered =
        audit.auditMode === 'CRITICAL_PATH'
          ? discoverCriticalPathUrls(audit.url, primary.metadata)
          : [{ url: audit.url, category: 'primary' as const }]

      for (const [index, page] of discovered.slice(1).entries()) {
        pageRuns.push(
          await runPage(ctx, {
            url: page.url,
            position: index + 1,
            role: page.category,
            primary: false,
          })
        )
      }

      const retriedPageRuns = await retryPrimaryTriage(ctx, pageRuns)
      await finalizeFromOutcome({
        ctx,
        auditId,
        auditUrl: audit.url,
        pageRuns: retriedPageRuns,
        startedAt,
      })
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
