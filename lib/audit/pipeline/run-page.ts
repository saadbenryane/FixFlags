import { prisma } from '../../db'
import { captureScreenshots } from '../screenshot'
import {
  fetchAndParseMetadata,
  mergeRuntimeHeadMetadata,
  parseMetadataFromHtml,
  trimMetadataForStorage,
} from '../metadata'
import {
  fetchPageSpeedData,
  toStoredPageSpeedResult,
} from '../pagespeed'
import { runAllChecks, computeRubricScores, suppressOverlappingFlags } from '../checks'
import { runFlowChecks } from '../checks/flow'
import { runNetworkEngagementChecks } from '../checks/network-engagement'
import type { FlowScanResult } from '../flow/run-flow-scan'
import { serializeFlowData } from '../flow/flow-url'
import { persistDeterministicFlags } from '../persist'
import { PIPELINE_PROGRESS, PIPELINE_PROGRESS_SUBSTEP } from '../progress'
import { logPipelineEvent } from '../pipeline-log'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../viewports'
import { assertDeadline, accumulateTriageUsage } from './context'
import { runTriageStep } from './triage-step'
import { isTriageProviderConfigured, type TriageResult } from '../judge-triage'
import { parseTriageFailure } from './triage-failure'
import { MIN_JUDGE_BUDGET_MS } from '../pipeline-config'
import { AuditDeadlineError } from '../pipeline-errors'
import { detectTechnologies, inferIndustry } from '../tech-detect'
import { inferProductContract } from '../product-contract'
import {
  mergeHeuristicIntoProjectPi,
  productIntelligenceFromContract,
  resolveContractForCapture,
} from '../product-intelligence'
import { loadProjectIntelligence, saveProjectIntelligence } from '../ensure-product-project'
import type { PipelineContext, PageRun } from './types'

interface RunPageInput {
  url: string
  position: number
  role: string
  primary: boolean
}

/** Capture, check, and (optionally) judge a single page within an audit run. */
export async function runPage(ctx: PipelineContext, input: RunPageInput): Promise<PageRun> {
  const normalizedUrl = new URL(input.url).toString()
  assertDeadline(ctx, 'capturing')

  const page = await prisma.auditPage.create({
    data: {
      auditId: ctx.auditId,
      url: normalizedUrl,
      normalizedUrl,
      position: input.position,
      role: input.role,
      status: 'CAPTURING',
    },
  })

  let screenshots: Awaited<ReturnType<typeof captureScreenshots>> | null = null
  let pagespeed: Awaited<ReturnType<typeof fetchPageSpeedData>> | null = null
  let flowResult: FlowScanResult | null = null
  let desktopBase64 = ''
  let mobileBase64: string | null = null

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

  const metadataFromHtml = mergeRuntimeHeadMetadata(
    screenshots.desktopHtml
      ? parseMetadataFromHtml(screenshots.desktopHtml, normalizedUrl)
      : await fetchAndParseMetadata(normalizedUrl),
    screenshots.runtimeHeadMetadata
  )
  const storedPerformance = {
    desktop: pagespeed.desktop ? toStoredPageSpeedResult(pagespeed.desktop) : null,
    mobile: pagespeed.mobile ? toStoredPageSpeedResult(pagespeed.mobile) : null,
    desktopError: pagespeed.desktopError ?? null,
    mobileError: pagespeed.mobileError ?? null,
    screenshots: screenshots.captureStatus,
    captureFailures: screenshots.captureFailures,
    loadExperience: screenshots.loadExperience ?? null,
    networkFailures: screenshots.networkFailures ?? [],
    actionTimeline: screenshots.actionTimeline ?? [],
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
    const inferred = inferProductContract(normalizedUrl, metadataFromHtml)
    const auditRow = await prisma.audit.findUnique({
      where: { id: ctx.auditId },
      select: { projectId: true, userId: true },
    })
    const projectPi = auditRow?.projectId
      ? await loadProjectIntelligence(auditRow.projectId)
      : null
    const productContract = resolveContractForCapture(inferred, projectPi)

    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: {
        status: 'CHECKING',
        progress: PIPELINE_PROGRESS.CHECKING,
        htmlMetadata: trimMetadataForStorage(metadataFromHtml) as never,
        performanceData: storedPerformance as never,
        consoleErrors: screenshots.consoleErrors as never,
        productContract: productContract as object,
        ...(flowResult
          ? {
              flowData: serializeFlowData(flowResult) as never,
            }
          : {}),
      },
    })

    // Seed / refresh Project PI when heuristic (never overwrite user-owned PI fields)
    if (auditRow?.projectId && productContract.source !== 'user') {
      const nextPi = mergeHeuristicIntoProjectPi(projectPi, inferred)
      if (!projectPi || projectPi.source !== 'user') {
        await saveProjectIntelligence(auditRow.projectId, nextPi)
      }
    } else if (auditRow?.projectId && productContract.source === 'user' && !projectPi) {
      await saveProjectIntelligence(
        auditRow.projectId,
        productIntelligenceFromContract(productContract)
      )
    }
  }

  const metadata = metadataFromHtml

  // Technology detection from HTML + response headers (primary page only)
  const detectedTech = input.primary
    ? detectTechnologies(
        screenshots.desktopHtml ?? '',
        screenshots.responseHeaders ?? {},
      )
    : []
  const industryGuess = input.primary
    ? inferIndustry(new URL(normalizedUrl).hostname, metadata.pageText ?? '')
    : null

  // Persist tech data in performanceData so it survives to finalize
  if (input.primary && detectedTech.length > 0) {
    await prisma.auditPage.update({
      where: { id: page.id },
      data: {
        performanceData: {
          ...((await prisma.auditPage.findUnique({ where: { id: page.id }, select: { performanceData: true } }))?.performanceData as Record<string, unknown> ?? {}),
          detectedTech,
          industryGuess,
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
      : undefined,
    screenshots?.captureMetrics ?? null,
    screenshots?.responseHeaders ?? null
  )

  for (const mod of failedModules) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'checking',
      event: `check_failed`,
      detail: mod,
    })
  }

  const flags = suppressOverlappingFlags(
    detFlags
      .concat(
        input.primary && input.position === 0 && flowResult ? runFlowChecks(flowResult) : []
      )
      .concat(
        input.primary && input.position === 0
          ? runNetworkEngagementChecks(screenshots?.networkFailures ?? [])
          : []
      )
  ).map((flag) => ({
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

  // Nudge progress mid-CHECKING so the ring keeps moving through the (opaque)
  // gap between deterministic checks finishing and the AI judge starting.
  if (input.primary) {
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: { progress: PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE },
    })
  }

  const partialRubricScores = computeRubricScores(
    flags,
    pagespeed?.desktop ?? null,
    pagespeed?.mobile ?? null,
    {
      pageSpeedAvailable: {
        desktop: Boolean(pagespeed?.desktop),
        mobile: Boolean(pagespeed?.mobile),
      },
      failedModules,
    }
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
  }

  // Triage is the only per-page step that depends on an external LLM. Once a
  // page's screenshot has been captured we must never throw the whole report
  // away: a triage failure degrades to deterministic results and returns with
  // no triage, so the runner can finalize instead of marking the audit FAILED.
  const shouldRunTriage = input.primary && input.position === 0
  let triage: TriageResult | undefined
  let triageFailure: ReturnType<typeof parseTriageFailure> | undefined

  if (shouldRunTriage && !isTriageProviderConfigured()) {
    // No LLM key: don't transition to JUDGING or attempt a call that can only
    // fail. Matches lib/env.ts intent for keyless deploys.
    await logPipelineEvent(ctx.auditId, {
      stage: 'judging',
      event: 'triage_skipped_no_provider',
    })
  } else if (shouldRunTriage) {
    await prisma.auditPage.update({
      where: { id: page.id },
      data: { status: 'JUDGING' },
    })
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: { status: 'JUDGING', progress: PIPELINE_PROGRESS.JUDGING },
    })

    const remainingMs = ctx.deadline - Date.now()
    const triageBudgetMs = remainingMs - MIN_JUDGE_BUDGET_MS
    await logPipelineEvent(ctx.auditId, {
      stage: 'judging',
      event: 'triage_budget_ms',
      detail: String(Math.max(0, triageBudgetMs)),
    })

    if (remainingMs < MIN_JUDGE_BUDGET_MS) {
      triageFailure = parseTriageFailure(new AuditDeadlineError('judging'))
      await logPipelineEvent(ctx.auditId, {
        stage: 'judging',
        event: 'triage_skipped_deadline',
        error: triageFailure.message,
      })
    } else {
      try {
        const triageResult = await runTriageStep(ctx, {
          url: normalizedUrl,
          metadata,
          desktop: pagespeed?.desktop ?? null,
          mobile: pagespeed?.mobile ?? null,
          flags,
          desktopBase64,
          mobileBase64,
        })
        accumulateTriageUsage(ctx, triageResult)
        triageResult.output.newFlags = triageResult.output.newFlags.map((flag) => ({
          ...flag,
          pageUrl: normalizedUrl,
        }))
        triage = triageResult
      } catch (err) {
        triageFailure = parseTriageFailure(err)
        await logPipelineEvent(ctx.auditId, {
          stage: 'judging',
          event: 'triage_step_failed',
          error: triageFailure.message,
          detail: triageFailure.reason,
        })
      }
    }
  }

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
    flowResult: input.primary && input.position === 0 ? flowResult : null,
    desktopBase64,
    mobileBase64,
    flags,
    failedModules,
    triage,
    triageFailure,
    runTriage: shouldRunTriage,
    detectedTech,
    industryGuess,
  }
}
