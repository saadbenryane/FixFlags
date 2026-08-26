import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { runWithContext } from '@/lib/logger/context'
import { PIPELINE_PROGRESS } from './progress'
import {
  FINALIZE_RESERVE_MS,
  MIN_JUDGE_BUDGET_MS,
} from './pipeline-config'
import { isNonRetryableAuditError } from './pipeline-errors'
import { JudgeContractError } from './validate-judge-output'
import { initPipelineLog, logPipelineEvent } from './pipeline-log'
import { persistFailedAuditCost, persistImprovementCycle } from './finalize'
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
import { runJourneyReviewsForAudit } from './journey/run-journey-reviews'
import { runCorridorConsistencyChecks } from './checks/corridor-consistency'
import { resolveAuditScanAccess } from '@/lib/audit/scan-access-store'
import { pullGscDataForAudit } from './gsc-integration'
import { runSearchPerformanceChecks } from './checks/search-performance'
import {
  asReviewDepth,
  auditDeadlineMsForDepth,
  buildReviewCoverage,
  openCheckCeilingForDepth,
  planReviewTargets,
  progressReviewingDetail,
} from './review-depth'
import {
  deadDestinationFlags,
  openCheckDestinations,
  type OpenCheckResult,
} from './open-check'
import { canonicalizeDestination } from './url-identity'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

export async function runAudit(auditId: string): Promise<void> {
  return runWithContext({ auditId }, async () => {
    const audit = await prisma.audit.findUnique({ where: { id: auditId } })
    if (!audit) throw new Error(`Audit ${auditId} not found`)
    if (audit.status === 'COMPLETED') {
      // A worker may have exited after the Review reached COMPLETED but before
      // its durable Improvement projection finished. Resume that idempotent
      // boundary before declaring the job complete.
      await persistImprovementCycle(auditId, audit.parentId)
      return
    }

    const reviewDepth = asReviewDepth(audit.reviewDepth)
    const startedAt = new Date()
    const scanAccess = await resolveAuditScanAccess(auditId)
    const ctx: PipelineContext = {
      auditId,
      deadline: Date.now() + auditDeadlineMsForDepth(reviewDepth),
      startedAt,
      pagespeedCalls: 0,
      usage: { inputTokens: 0, outputTokens: 0, models: [] },
      includeAi: audit.includeAi,
      scanAccess,
      openCheckCount: 0,
    }

    // Always fresh capture, including parented re-checks.
    await prisma.$transaction([
      prisma.screenshot.deleteMany({ where: { auditId } }),
      prisma.auditPage.deleteMany({ where: { auditId } }),
      prisma.journeyReview.deleteMany({ where: { auditId } }),
      prisma.flag.deleteMany({ where: { auditId, source: 'JOURNEY' } }),
    ])

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'CAPTURING',
        startedAt,
        completedAt: null,
        finalizedAt: null,
        journeyReviewAt: null,
        errorMsg: null,
        failureCode: null,
        failureStage: null,
        failureMetadata: Prisma.JsonNull,
        progress: PIPELINE_PROGRESS.CAPTURING,
      },
    })

    await initPipelineLog(auditId)

    const pageRuns: PageRun[] = []
    let openCheckResults: OpenCheckResult[] = []

    try {
      await prisma.audit.update({
        where: { id: auditId },
        data: { progressDetail: AUDIT_PROGRESS.reviewProgress.openingLinks },
      })

      const primary = await runPage(ctx, {
        url: audit.url,
        position: 0,
        role: 'primary',
        primary: true,
      })
      pageRuns.push(primary)

      const hop1Plan = planReviewTargets({
        pastedUrl: audit.url,
        depth: reviewDepth,
        pastedLinks: primary.metadata.links ?? [],
      })

      const { results, truncated: openCheckTruncated } = await openCheckDestinations(
        hop1Plan.openCheckUrls,
        {
          origin: canonicalizeDestination(audit.url)?.url ?? audit.url,
          ceiling: openCheckCeilingForDepth(reviewDepth),
        }
      )
      openCheckResults = results
      ctx.openCheckCount = results.length
      if (openCheckTruncated) ctx.supplementalPagesSkipped = true

      const deadFlags = deadDestinationFlags(results, primary.url)
      if (deadFlags.length > 0) primary.flags.push(...deadFlags)

      const reviewedKeys = new Set(
        pageRuns
          .map((page) => canonicalizeDestination(page.url)?.key)
          .filter((key): key is string => Boolean(key))
      )

      const secondaryPageBudgetMs = reviewDepth >= 3 ? 40_000 : 30_000
      const secondaryStartReserveMs =
        secondaryPageBudgetMs + MIN_JUDGE_BUDGET_MS + FINALIZE_RESERVE_MS

      const reviewQueue = hop1Plan.reviewUrls.filter((url) => {
        const key = canonicalizeDestination(url)?.key
        return key ? !reviewedKeys.has(key) : true
      })

      for (const url of reviewQueue) {
        if (ctx.deadline - Date.now() < secondaryStartReserveMs) {
          ctx.supplementalPagesSkipped = true
          await logPipelineEvent(auditId, {
            stage: 'capturing',
            event: 'review_depth_skipped_deadline',
            detail: String(reviewQueue.length - pageRuns.length + 1),
          })
          break
        }
        await prisma.audit.update({
          where: { id: auditId },
          data: { progressDetail: progressReviewingDetail(url) },
        })
        const secondaryCtx: PipelineContext = {
          ...ctx,
          deadline: Math.min(ctx.deadline, Date.now() + secondaryPageBudgetMs),
        }
        const pageRun = await runPage(secondaryCtx, {
          url,
          position: pageRuns.length,
          role: 'linked',
          primary: false,
        })
        pageRuns.push(pageRun)
        const key = canonicalizeDestination(pageRun.url)?.key
        if (key) reviewedKeys.add(key)
      }

      if (reviewDepth >= 3) {
        const hop2Plan = planReviewTargets({
          pastedUrl: audit.url,
          depth: 3,
          pastedLinks: primary.metadata.links ?? [],
          linkedPageLinks: pageRuns.slice(1).map((page) => ({
            pageUrl: page.url,
            links: page.metadata.links ?? [],
          })),
        })
        const extraOpenCheck = hop2Plan.openCheckUrls.filter((url) => {
          const key = canonicalizeDestination(url)?.key
          return key ? !openCheckResults.some((result) => canonicalizeDestination(result.canonicalUrl)?.key === key) : true
        })
        if (extraOpenCheck.length > 0) {
          const extra = await openCheckDestinations(extraOpenCheck, {
            origin: canonicalizeDestination(audit.url)?.url ?? audit.url,
            ceiling: Math.max(0, openCheckCeilingForDepth(3) - openCheckResults.length),
          })
          openCheckResults.push(...extra.results)
          ctx.openCheckCount = openCheckResults.length
          if (extra.truncated) ctx.supplementalPagesSkipped = true
          const extraDead = deadDestinationFlags(extra.results, primary.url)
          if (extraDead.length > 0) primary.flags.push(...extraDead)
        }
        for (const url of hop2Plan.reviewUrls) {
          const key = canonicalizeDestination(url)?.key
          if (key && reviewedKeys.has(key)) continue
          if (ctx.deadline - Date.now() < secondaryStartReserveMs) {
            ctx.supplementalPagesSkipped = true
            await logPipelineEvent(auditId, {
              stage: 'capturing',
              event: 'review_depth_skipped_deadline',
              detail: 'hop2',
            })
            break
          }
          await prisma.audit.update({
            where: { id: auditId },
            data: { progressDetail: progressReviewingDetail(url) },
          })
          const secondaryCtx: PipelineContext = {
            ...ctx,
            deadline: Math.min(ctx.deadline, Date.now() + secondaryPageBudgetMs),
          }
          const pageRun = await runPage(secondaryCtx, {
            url,
            position: pageRuns.length,
            role: 'beyond',
            primary: false,
          })
          pageRuns.push(pageRun)
          if (key) reviewedKeys.add(key)
        }
      }

      if (hop1Plan.truncated) ctx.supplementalPagesSkipped = true

      await prisma.audit.update({
        where: { id: auditId },
        data: {
          openCheckResults: openCheckResults as unknown as Prisma.InputJsonValue,
          reviewCoverage: buildReviewCoverage({
            reviewedPageCount: pageRuns.length,
            openCheckCount: openCheckResults.length,
            partial: Boolean(ctx.supplementalPagesSkipped),
          }) as unknown as Prisma.InputJsonValue,
          progressDetail: AUDIT_PROGRESS.reviewProgress.prioritizingFlags,
        },
      })

      if (pageRuns.length > 1) {
        const corridorFlags = runCorridorConsistencyChecks(
          pageRuns.map((page, index) => ({
            url: page.url,
            role: index === 0 ? 'primary' : 'other',
            ogTitle: page.metadata.ogTitle ?? null,
            ogDescription: page.metadata.ogDescription ?? null,
            title: page.metadata.title ?? null,
          }))
        )
        if (corridorFlags.length > 0) {
          pageRuns[0].flags.push(...corridorFlags)
        }
      }

      await runJourneyReviewsForAudit(auditId, audit.url, {
        included: audit.journeyReviewIncluded,
        deadline: ctx.deadline,
        scanAccess: ctx.scanAccess,
      })

      // Pull GSC data and run search-performance checks before finalize.
      // This runs after all pages are captured so we have the full URL list.
      if (audit.userId) {
        const urls = pageRuns.map((p) => p.url)
        await pullGscDataForAudit(auditId, audit.userId, urls)
        for (const pageRun of pageRuns) {
          const gscFlags = await runSearchPerformanceChecks(auditId, pageRun.url)
          if (gscFlags.length > 0) {
            pageRun.flags.push(...gscFlags)
          }
        }
      }

      const retriedPageRuns = await retryPrimaryTriage(ctx, pageRuns)
      await finalizeFromOutcome({
        ctx,
        auditId,
        auditUrl: audit.url,
        pageRuns: retriedPageRuns,
        startedAt,
      })
      if (ctx.supplementalPagesSkipped) {
        await prisma.audit.updateMany({
          where: { id: auditId, status: 'COMPLETED' },
          data: { reportCompleteness: 'PARTIAL' },
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
