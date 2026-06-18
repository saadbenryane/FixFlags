import { prisma } from '../db'
import { RUBRIC_ORDER, type RubricName } from './constants'
import {
  captureScreenshots,
  getAuditBrowser,
} from './screenshot'
import {
  fetchAndParseMetadata,
  parseMetadataFromHtml,
  trimMetadataForStorage,
  type PageMetadata,
} from './metadata'
import {
  fetchPageSpeedData,
  toStoredPageSpeedResult,
  type PageSpeedResult,
} from './pagespeed'
import {
  runAllChecks,
  computeRubricScores,
  type DeterministicFlag,
} from './checks'
import { runFlowChecks } from './checks/flow'
import { runFlowScanStandalone, type FlowScanResult } from './flow/run-flow-scan'
import {
  runJudge,
  isRetryableJudgeError,
  type JudgeResult,
} from './judge'
import {
  persistAuditResults,
  persistDeterministicFlags,
} from './persist'
import { AUDIT_PROGRESS } from './progress'
import { JudgeContractError, validateJudgeOutput } from './validate-judge-output'
import { discoverCriticalPathUrls } from './critical-path'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import {
  finalizeAudit,
  finalizePartialAudit,
  finalizeDeterministicOnly,
  persistFailedAuditCost,
} from './finalize'
import { AUDIT_DEADLINE_MS } from './pipeline-config'
import { AuditDeadlineError, isNonRetryableAuditError } from './pipeline-errors'
import { initPipelineLog, logPipelineEvent } from './pipeline-log'
import {
  copyParentArtifacts,
  loadParentScreenshotBase64,
} from './copy-parent-artifacts'

interface PageRun {
  pageId: string
  url: string
  metadata: PageMetadata
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  desktopError?: string
  mobileError?: string
  desktopScreenshot: boolean
  mobileScreenshot: boolean
  flowScan: boolean
  desktopBase64: string
  mobileBase64: string | null
  flags: DeterministicFlag[]
  judge?: JudgeResult
}

interface PipelineContext {
  auditId: string
  deadline: number
  startedAt: Date
  pagespeedCalls: number
  usage: { inputTokens: number; outputTokens: number; models: string[] }
  includeAi: boolean
}

function sanitizeAuditErrorMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500)
}

function assertDeadline(ctx: PipelineContext, stage: string): void {
  if (Date.now() > ctx.deadline) {
    throw new AuditDeadlineError(stage)
  }
}

function accumulateUsage(ctx: PipelineContext, judge: JudgeResult): void {
  ctx.usage.inputTokens += judge.usage.inputTokens
  ctx.usage.outputTokens += judge.usage.outputTokens
  if (!ctx.usage.models.includes(judge.usage.model)) {
    ctx.usage.models.push(judge.usage.model)
  }
}

async function runValidatedJudge(
  ctx: PipelineContext,
  input: {
    url: string
    metadata: PageMetadata
    desktop: PageSpeedResult | null
    mobile: PageSpeedResult | null
    flags: DeterministicFlag[]
    desktopBase64: string
    mobileBase64: string | null
  }
): Promise<JudgeResult> {
  assertDeadline(ctx, 'judging')
  const judgeStart = Date.now()
  await logPipelineEvent(ctx.auditId, { stage: 'judging', event: 'judge_started' })

  const execute = async () => {
    assertDeadline(ctx, 'judging')
    const result = await runJudge(
      input.url,
      input.metadata,
      input.desktop,
      input.mobile,
      input.flags,
      input.desktopBase64,
      input.mobileBase64
    )
    result.output = validateJudgeOutput(result.output, input.flags)
    return result
  }

  try {
    const result = await execute()
    await logPipelineEvent(ctx.auditId, {
      stage: 'judging',
      event: 'judge_completed',
      durationMs: Date.now() - judgeStart,
    })
    return result
  } catch (firstError) {
    const retryable =
      isRetryableJudgeError(firstError) ||
      firstError instanceof JudgeContractError ||
      (firstError instanceof Error &&
        firstError.message.startsWith('Invalid judge output:'))
    if (!retryable) throw firstError
    assertDeadline(ctx, 'judging')
    const result = await execute()
    await logPipelineEvent(ctx.auditId, {
      stage: 'judging',
      event: 'judge_completed_retry',
      durationMs: Date.now() - judgeStart,
    })
    return result
  }
}

async function runPage(
  ctx: PipelineContext,
  input: {
    url: string
    position: number
    role: string
    primary: boolean
    skipCapture?: boolean
    parentId?: string
  }
): Promise<PageRun> {
  const normalizedUrl = new URL(input.url).toString()
  assertDeadline(ctx, input.skipCapture ? 'checking' : 'capturing')

  const page = await prisma.auditPage.create({
    data: {
      auditId: ctx.auditId,
      url: normalizedUrl,
      normalizedUrl,
      position: input.position,
      role: input.role,
      status: input.skipCapture ? 'CHECKING' : 'CAPTURING',
    },
  })

  let screenshots: Awaited<ReturnType<typeof captureScreenshots>> | null = null
  let pagespeed: Awaited<ReturnType<typeof fetchPageSpeedData>> | null = null
  let flowResult: FlowScanResult | null = null
  let desktopBase64 = ''
  let mobileBase64: string | null = null

  if (input.skipCapture && input.parentId) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'capturing',
      event: 'skipped_reusing_parent',
    })
    const parentImages = await loadParentScreenshotBase64(input.parentId)
    desktopBase64 = parentImages.desktopBase64 ?? ''
    mobileBase64 = parentImages.mobileBase64
    const parentPerf = await prisma.audit.findUnique({
      where: { id: input.parentId },
      select: { performanceData: true, htmlMetadata: true },
    })
    const perf = parentPerf?.performanceData as {
      desktop?: PageSpeedResult
      mobile?: PageSpeedResult
    } | null
    pagespeed = {
      desktop: perf?.desktop ?? null,
      mobile: perf?.mobile ?? null,
      desktopError: undefined,
      mobileError: undefined,
    }
    const meta = parentPerf?.htmlMetadata as PageMetadata | null
    if (!desktopBase64) {
      throw new Error('Desktop screenshot capture failed, parent has no desktop image')
    }
    await prisma.auditPage.update({
      where: { id: page.id },
      data: {
        status: 'CHECKING',
        title: meta?.title,
        htmlMetadata: meta ? (trimMetadataForStorage(meta) as never) : undefined,
      },
    })
  } else {
    await logPipelineEvent(ctx.auditId, { stage: 'capturing', event: 'capture_started' })
    if (input.primary && input.position === 0) {
      await logPipelineEvent(ctx.auditId, { stage: 'capturing', event: 'flow_started' })
    }
    const captureStart = Date.now()

    const [captured, speed] = await Promise.all([
      captureScreenshots(normalizedUrl, ctx.auditId, `p${input.position}`, {
        runFlow: input.primary && input.position === 0,
      }),
      fetchPageSpeedData(normalizedUrl),
    ])
    screenshots = captured
    pagespeed = speed
    flowResult = captured.flowResult ?? null
    if (flowResult && input.primary) {
      await logPipelineEvent(ctx.auditId, {
        stage: 'capturing',
        event: 'flow_completed',
      })
    }
    ctx.pagespeedCalls += Number(Boolean(speed.desktop)) + Number(Boolean(speed.mobile))

    await logPipelineEvent(ctx.auditId, {
      stage: 'capturing',
      event: 'capture_completed',
      durationMs: Date.now() - captureStart,
    })

    if (!screenshots.desktopUrl || !screenshots.desktopBase64) {
      await prisma.auditPage.update({
        where: { id: page.id },
        data: {
          status: 'FAILED',
          failureCode: 'DESKTOP_CAPTURE_FAILED',
          failureMessage: 'Desktop screenshot capture is required',
        },
      })
      throw new Error(`Desktop screenshot capture failed for ${normalizedUrl}`)
    }

    desktopBase64 = screenshots.desktopBase64
    mobileBase64 = screenshots.mobileBase64

    const metadataFromHtml = screenshots.desktopHtml
      ? parseMetadataFromHtml(screenshots.desktopHtml, normalizedUrl)
      : await fetchAndParseMetadata(normalizedUrl)
    const storedPerformance = {
      desktop: pagespeed.desktop ? toStoredPageSpeedResult(pagespeed.desktop) : null,
      mobile: pagespeed.mobile ? toStoredPageSpeedResult(pagespeed.mobile) : null,
      desktopError: pagespeed.desktopError ?? null,
      mobileError: pagespeed.mobileError ?? null,
      screenshots: screenshots.captureStatus,
    }

    await prisma.$transaction([
      prisma.screenshot.create({
        data: {
          auditId: ctx.auditId,
          pageId: page.id,
          device: 'DESKTOP',
          url: screenshots.desktopUrl,
          width: DESKTOP_VIEWPORT.width,
          height: DESKTOP_VIEWPORT.height,
        },
      }),
      ...(screenshots.mobileUrl
        ? [
            prisma.screenshot.create({
              data: {
                auditId: ctx.auditId,
                pageId: page.id,
                device: 'MOBILE',
                url: screenshots.mobileUrl,
                width: MOBILE_VIEWPORT.width,
                height: MOBILE_VIEWPORT.height,
              },
            }),
          ]
        : []),
      prisma.auditPage.update({
        where: { id: page.id },
        data: {
          status: 'CHECKING',
          title: metadataFromHtml.title,
          htmlMetadata: trimMetadataForStorage(metadataFromHtml) as never,
          performanceData: storedPerformance as never,
          consoleErrors: screenshots.consoleErrors as never,
        },
      }),
    ])

    if (input.primary) {
      await prisma.audit.update({
        where: { id: ctx.auditId },
        data: {
          status: 'CHECKING',
          progress: AUDIT_PROGRESS.CHECKING,
          htmlMetadata: trimMetadataForStorage(metadataFromHtml) as never,
          performanceData: storedPerformance as never,
          consoleErrors: screenshots.consoleErrors as never,
          ...(flowResult
            ? {
                flowData: {
                  status: flowResult.status,
                  steps: flowResult.steps,
                  finalUrl: flowResult.finalUrl,
                  ctaText: flowResult.ctaText ?? null,
                } as never,
              }
            : {}),
        },
      })
    }
  }

  const metadata =
    screenshots?.desktopHtml
      ? parseMetadataFromHtml(screenshots.desktopHtml, normalizedUrl)
      : ((await prisma.auditPage.findUnique({
          where: { id: page.id },
          select: { htmlMetadata: true },
        }))?.htmlMetadata as PageMetadata | null) ??
        (await fetchAndParseMetadata(normalizedUrl))

  if (input.skipCapture && input.primary && input.position === 0) {
    await logPipelineEvent(ctx.auditId, { stage: 'checking', event: 'flow_started' })
    const browser = await getAuditBrowser()
    flowResult = await runFlowScanStandalone(browser, ctx.auditId, normalizedUrl)
    await logPipelineEvent(ctx.auditId, {
      stage: 'checking',
      event: 'flow_completed',
    })
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: {
        flowData: {
          status: flowResult.status,
          steps: flowResult.steps,
          finalUrl: flowResult.finalUrl,
          ctaText: flowResult.ctaText ?? null,
        } as never,
      },
    })
  }

  assertDeadline(ctx, 'checking')
  await logPipelineEvent(ctx.auditId, { stage: 'checking', event: 'checks_started' })
  const checksStart = Date.now()

  const { flags: detFlags, failedModules } = await runAllChecks(
    normalizedUrl,
    metadata,
    pagespeed?.desktop ?? null,
    pagespeed?.mobile ?? null,
    screenshots?.consoleErrors ?? [],
    input.primary
      ? (index) => {
          void logPipelineEvent(ctx.auditId, {
            stage: 'checking',
            event: `check_${index + 1}`,
          })
        }
      : undefined
  )

  for (const mod of failedModules) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'checking',
      event: `check_failed`,
      detail: mod,
    })
  }

  const flags = detFlags
    .concat(
      input.primary && input.position === 0 && flowResult ? runFlowChecks(flowResult) : []
    )
    .map((flag) => ({
    ...flag,
    checkId:
      input.position === 0
        ? flag.checkId
        : `${flag.checkId}::page:${input.position}`,
    pageUrl: normalizedUrl,
  }))

  await logPipelineEvent(ctx.auditId, {
    stage: 'checking',
    event: 'checks_completed',
    durationMs: Date.now() - checksStart,
  })

  const partialRubricScores = computeRubricScores(
    flags,
    pagespeed?.desktop ?? null,
    pagespeed?.mobile ?? null
  )
  if (input.primary) {
    await persistDeterministicFlags(ctx.auditId, flags, partialRubricScores)
  }

  const completeness =
    (screenshots?.mobileUrl || mobileBase64) &&
    pagespeed?.desktop &&
    pagespeed?.mobile
      ? 'FULL'
      : 'PARTIAL'

  if (!ctx.includeAi) {
    await prisma.auditPage.update({
      where: { id: page.id },
      data: {
        status: completeness === 'FULL' ? 'COMPLETED' : 'PARTIAL',
        completeness,
      },
    })
    return {
      pageId: page.id,
      url: normalizedUrl,
      metadata,
      desktop: pagespeed?.desktop ?? null,
      mobile: pagespeed?.mobile ?? null,
      desktopError: pagespeed?.desktopError,
      mobileError: pagespeed?.mobileError,
      desktopScreenshot: Boolean(desktopBase64),
      mobileScreenshot: Boolean(mobileBase64 || screenshots?.mobileUrl),
      flowScan: Boolean(input.primary && input.position === 0 && flowResult),
      desktopBase64,
      mobileBase64,
      flags,
      judge: undefined,
    }
  }

  await prisma.auditPage.update({
    where: { id: page.id },
    data: { status: 'JUDGING' },
  })
  await prisma.audit.update({
    where: { id: ctx.auditId },
    data: { status: 'JUDGING', progress: AUDIT_PROGRESS.JUDGING },
  })

  const judge = await runValidatedJudge(ctx, {
    url: normalizedUrl,
    metadata,
    desktop: pagespeed?.desktop ?? null,
    mobile: pagespeed?.mobile ?? null,
    flags,
    desktopBase64,
    mobileBase64,
  })
  accumulateUsage(ctx, judge)

  judge.output.newFlags = judge.output.newFlags.map((flag) => ({
    ...flag,
    pageUrl: normalizedUrl,
  }))

  await prisma.auditPage.update({
    where: { id: page.id },
    data: {
      status: completeness === 'FULL' ? 'COMPLETED' : 'PARTIAL',
      completeness,
    },
  })

  return {
    pageId: page.id,
    url: normalizedUrl,
    metadata,
    desktop: pagespeed?.desktop ?? null,
    mobile: pagespeed?.mobile ?? null,
    desktopError: pagespeed?.desktopError,
    mobileError: pagespeed?.mobileError,
    desktopScreenshot: Boolean(desktopBase64),
    mobileScreenshot: Boolean(mobileBase64 || screenshots?.mobileUrl),
    flowScan: Boolean(input.primary && input.position === 0 && flowResult),
    desktopBase64,
    mobileBase64,
    flags,
    judge,
  }
}

function averageScores(pageRuns: PageRun[]): Partial<Record<RubricName, number | null>> {
  const output: Partial<Record<RubricName, number | null>> = {}
  for (const rubricName of RUBRIC_ORDER) {
    const values = pageRuns
      .map((page) => {
        const deterministic = computeRubricScores(
          page.flags,
          page.desktop,
          page.mobile
        )[rubricName]
        return (
          deterministic ??
          page.judge?.output.rubrics.find((item) => item.name === rubricName)?.score ??
          null
        )
      })
      .filter((score): score is number => score !== null)
    output[rubricName] =
      values.length === pageRuns.length
        ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null
  }
  return output
}

async function tryPartialFinalize(
  ctx: PipelineContext,
  pageRuns: PageRun[],
  error: unknown
): Promise<boolean> {
  if (pageRuns.length === 0) return false
  const hasEvidence = pageRuns.every((p) => p.desktopScreenshot && p.flags.length >= 0)
  if (!hasEvidence) return false

  const errorMsg = sanitizeAuditErrorMessage(
    error instanceof Error ? error.message : String(error)
  )
  const failureCode =
    error instanceof AuditDeadlineError
      ? 'AUDIT_TIMEOUT'
      : error instanceof JudgeContractError
        ? 'AI_CONTRACT_INVALID'
        : 'AUDIT_PIPELINE_FAILED'
  const failureStage =
    error instanceof AuditDeadlineError
      ? error.stage
      : pageRuns.some((p) => p.judge)
        ? 'judging'
        : 'checking'

  await finalizePartialAudit({
    auditId: ctx.auditId,
    durationMs: Date.now() - ctx.startedAt.getTime(),
    pagespeedCalls: ctx.pagespeedCalls,
    usage: {
      inputTokens: ctx.usage.inputTokens,
      outputTokens: ctx.usage.outputTokens,
      model: ctx.usage.models.join(',') || 'none',
    },
    evidence: {
      desktopScreenshot: pageRuns.every((p) => p.desktopScreenshot),
      mobileScreenshot: pageRuns.every((p) => p.mobileScreenshot),
      metadata: pageRuns.every((p) => Boolean(p.metadata)),
      desktopPageSpeed: pageRuns.every((p) => Boolean(p.desktop)),
      mobilePageSpeed: pageRuns.every((p) => Boolean(p.mobile)),
    },
    failureCode,
    failureStage,
    errorMsg,
  })
  return true
}

export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!audit) throw new Error(`Audit ${auditId} not found`)
  if (audit.status === 'COMPLETED') return

  const startedAt = audit.startedAt ?? new Date()
  const ctx: PipelineContext = {
    auditId,
    deadline: Date.now() + AUDIT_DEADLINE_MS,
    startedAt,
    pagespeedCalls: 0,
    usage: { inputTokens: 0, outputTokens: 0, models: [] },
    includeAi: audit.includeAi,
  }

  const isSummaryOnly = audit.recheckMode === 'SUMMARY_ONLY'
  const summarySourceId =
    isSummaryOnly ? (audit.parentId ?? auditId) : null

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
      await logPipelineEvent(auditId, { stage: 'finalizing', event: 'deterministic_only' })
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
      return
    }

    const combined = primary.judge!
    combined.output.newFlags = pageRuns.flatMap(
      (page) => page.judge?.output.newFlags ?? []
    )
    combined.output.enrichments = pageRuns.flatMap(
      (page) => page.judge?.output.enrichments ?? []
    )
    combined.output.rubrics = combined.output.rubrics.map((rubric) => {
      const pageRubrics = pageRuns
        .map((page) => page.judge?.output.rubrics.find((item) => item.name === rubric.name))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
      const scores = pageRubrics
        .map((item) => item.score)
        .filter((score): score is number => score !== null)
      return {
        ...rubric,
        score:
          scores.length === pageRuns.length
            ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
            : null,
        assessmentState:
          scores.length === pageRuns.length ? ('ASSESSED' as const) : ('PARTIAL' as const),
        confidence:
          pageRubrics.reduce((sum, item) => sum + item.confidence, 0) / pageRubrics.length,
      }
    })

    const flags = pageRuns.flatMap((page) => page.flags)
    const rubricScores = averageScores(pageRuns)
    await logPipelineEvent(auditId, { stage: 'finalizing', event: 'persist_started' })
    await persistAuditResults(auditId, combined.output, flags, rubricScores)

    await finalizeAudit({
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
        aiAssessment: pageRuns.every((page) => Boolean(page.judge)),
        desktopPageSpeed: pageRuns.every((page) => Boolean(page.desktop)),
        mobilePageSpeed: pageRuns.every((page) => Boolean(page.mobile)),
        flowScan: pageRuns.some((page) => page.flowScan),
      },
    })
  } catch (error) {
    const partialDone = await tryPartialFinalize(ctx, pageRuns, error)
    if (partialDone) return

    const current = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true },
    })

    if (current?.status !== 'FINALIZING' && current?.status !== 'COMPLETED') {
      const failureCode =
        error instanceof AuditDeadlineError
          ? 'AUDIT_TIMEOUT'
          : error instanceof JudgeContractError
            ? 'AI_CONTRACT_INVALID'
            : 'AUDIT_PIPELINE_FAILED'
      const failureStage =
        error instanceof AuditDeadlineError
          ? error.stage
          : (current?.status?.toLowerCase() ?? 'unknown')

      await logPipelineEvent(auditId, {
        stage: failureStage,
        event: 'failed',
        error: sanitizeAuditErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
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
          errorMsg: sanitizeAuditErrorMessage(
            error instanceof Error ? error.message : String(error)
          ),
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
}
