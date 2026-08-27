import { prisma } from '../../db'
import { captureScreenshots, getAuditBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import type { PageCaptureFailure } from '../browser/page-capture'
import { SiteOutageError } from '../pipeline-errors'
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
import { runAllChecks, suppressOverlappingFlags } from '../checks'
import { suppressFlagsForPageRole } from '../suppression'
import { runFlowChecks } from '../checks/flow'
import { runSlowReplayChecks } from '../checks/slow-replay'
import { runNetworkEngagementChecks } from '../checks/network-engagement'
import type { FlowScanResult } from '../flow/run-flow-scan'
import { runFlowScan } from '../flow/run-flow-scan'
import { runSlowReplay, type SlowReplayResult } from '../flow/slow-replay-probe'
import { serializeFlowData } from '../flow/flow-url'
import { PIPELINE_PROGRESS, PIPELINE_PROGRESS_SUBSTEP } from '../progress'
import { logPipelineEvent } from '../pipeline-log'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../viewports'
import { assertDeadline, accumulateTriageUsage } from './context'
import { runTriageStep } from './triage-step'
import { isTriageProviderConfigured, type TriageResult } from '../judge-triage'
import { parseTriageFailure } from './triage-failure'
import { MIN_JUDGE_BUDGET_MS, SLOW_REPLAY_MIN_BUDGET_MS } from '../pipeline-config'
import { resolveAuditPipelineMode, type AuditPipelineMode } from './mode'
import { AuditDeadlineError } from '../pipeline-errors'
import { detectTechnologies, inferIndustry } from '../tech-detect'
import { persistTechnologyObservations } from '../technology-profile'
import { inferProductContract } from '../product-contract'
import { scanAccessToFetchHeaders } from '../scan-access'
import {
  mergeHeuristicIntoProjectPi,
  productIntelligenceFromContract,
  resolveContractForCapture,
} from '../product-intelligence'
import { loadProjectIntelligence, mutateProjectIntelligence } from '../ensure-product-project'
import type { PipelineContext, PageRun } from './types'
import { recordTargetedPageVerifierExecutions } from '@/lib/improvements/verifier-provenance'
import {
  attachEvidenceTargets,
  flowExtraFromAnchor,
} from '@/lib/audit/evidence-targets'
import { flowCheckIdForStatus } from '@/lib/audit/flow/flow-evidence'

interface CaptureOutage {
  failureCode: string
  failureMessage: string
  throwMessage: string
}

/**
 * Translate a structured capture failure into a clear, user-facing message.
 * When the destination site is unreachable or refuses the audit, the user
 * should understand WHY (and that it is not a FixFlags bug) rather than seeing
 * a generic "Desktop screenshot capture failed".
 */
function buildCaptureOutageMessage(
  failure: PageCaptureFailure | undefined,
  normalizedUrl: string
): CaptureOutage {
  const status = failure?.httpStatus
  switch (failure?.code) {
    case 'HTTP_FORBIDDEN':
      return {
        failureCode: 'SITE_FORBIDDEN',
        failureMessage:
          'This site returned HTTP 403 (Forbidden). It may be blocking automated audits, so FixFlags cannot scan it.',
        throwMessage: `Site returned HTTP 403 for ${normalizedUrl}`,
      }
    case 'HTTP_RATE_LIMIT':
      return {
        failureCode: 'SITE_RATE_LIMITED',
        failureMessage:
          'This site returned HTTP 429 (Too Many Requests). Wait a few minutes and re-check.',
        throwMessage: `Site returned HTTP 429 for ${normalizedUrl}`,
      }
    case 'NON_HTML_RESPONSE':
      return {
        failureCode: 'SITE_NOT_HTML',
        failureMessage:
          'This URL did not return an HTML page, so FixFlags cannot analyze its content.',
        throwMessage: `Destination did not return HTML for ${normalizedUrl}`,
      }
    case 'HTTP_ERROR':
      return {
        failureCode: 'SITE_UNREACHABLE',
        failureMessage: status
          ? `This site returned HTTP ${status}. FixFlags can only audit sites that respond successfully, so check that the URL is live and try again.`
          : 'This site did not respond successfully, so FixFlags could not capture it. Confirm the URL is live and reachable, then re-check.',
        throwMessage: `Site returned HTTP ${status ?? 'error'} for ${normalizedUrl}`,
      }
    default:
      return {
        failureCode: 'DESKTOP_CAPTURE_FAILED',
        failureMessage: 'Desktop screenshot capture is required to analyze the page.',
        throwMessage: `Desktop screenshot capture failed for ${normalizedUrl}`,
      }
  }
}

/** Create an AbortSignal that fires when the deadline is approaching (≤15s remaining). */
function createDeadlineSignal(deadline: number): AbortSignal {
  const controller = new AbortController()
  const remaining = deadline - Date.now()
  const triggerMs = Math.max(0, remaining - 15_000)
  if (triggerMs <= 0) {
    controller.abort()
  } else {
    setTimeout(() => controller.abort(), triggerMs).unref?.()
  }
  return controller.signal
}

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

  // Anonymous teaser scans run the reduced pipeline: no flow walk and no
  // slow-3G replay, so first value lands in ~60-90s. Re-checks (parentId),
  // claimed audits, and signed-in checks keep the full pipeline. The mode is
  // resolved once from the audit row at the primary page; secondary pages
  // never run flow or slow replay regardless of mode.
  const pipelineMode: AuditPipelineMode =
    input.primary && input.position === 0
      ? await resolveAuditPipelineMode(ctx.auditId)
      : 'FULL'
  const isTeaserScan = pipelineMode === 'TEASER'

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
  let slowReplayResult: SlowReplayResult | null = null
  let desktopBase64 = ''
  let mobileBase64: string | null = null

  await logPipelineEvent(ctx.auditId, { stage: 'capturing', event: 'capture_started' })
  if (input.primary && input.position === 0) {
    if (isTeaserScan) {
      await logPipelineEvent(ctx.auditId, { stage: 'capturing', event: 'flow_skipped_teaser' })
    } else {
      await logPipelineEvent(ctx.auditId, { stage: 'capturing', event: 'flow_deferred' })
    }
  }
  const captureStart = Date.now()

  const shouldRunFlow = input.primary && input.position === 0 && !isTeaserScan
  const hasDeadlineBudgetForFlow =
    input.primary && input.position === 0 && ctx.deadline - Date.now() > 60_000

  let initialScreenshotPersisted = false
  const onInitialScreenshot = input.primary
    ? async (url: string) => {
        if (initialScreenshotPersisted) return
        initialScreenshotPersisted = true
        try {
          await prisma.screenshot.create({
            data: {
              auditId: ctx.auditId,
              pageId: page.id,
              device: 'DESKTOP',
              url,
              width: DESKTOP_VIEWPORT.width,
              height: DESKTOP_VIEWPORT.height,
            },
          })
          await prisma.audit.update({
            where: { id: ctx.auditId },
            data: { progress: PIPELINE_PROGRESS_SUBSTEP.CAPTURE_DONE },
          })
          await logPipelineEvent(ctx.auditId, {
            stage: 'capturing',
            event: 'initial_screenshot_persisted',
          })
        } catch {
          // Non-fatal: screenshot will still be persisted in the main flow
        }
      }
    : undefined

  const [captured, speed] = await Promise.all([
    captureScreenshots(normalizedUrl, ctx.auditId, `p${input.position}`, {
      runFlow: false,
      scanAccess: ctx.scanAccess,
      deadline: ctx.deadline,
      onInitialScreenshot,
    }),
    fetchPageSpeedData(normalizedUrl, createDeadlineSignal(ctx.deadline)),
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

  if (input.primary && input.position === 0 && isTeaserScan) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'capturing',
      event: 'slow_replay_skipped_teaser',
    })
  } else if (
    input.primary &&
    input.position === 0 &&
    ctx.deadline - Date.now() > SLOW_REPLAY_MIN_BUDGET_MS
  ) {
    await logPipelineEvent(ctx.auditId, { stage: 'capturing', event: 'slow_replay_started' })
    const slowReplayStart = Date.now()
    try {
      const browser = await getAuditBrowser()
      slowReplayResult = await runSlowReplay(browser, ctx.auditId, normalizedUrl)
      await logPipelineEvent(ctx.auditId, {
        stage: 'capturing',
        event: 'slow_replay_completed',
        durationMs: Date.now() - slowReplayStart,
      })
    } catch (err) {
      await logPipelineEvent(ctx.auditId, {
        stage: 'capturing',
        event: 'slow_replay_failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  } else if (input.primary && input.position === 0) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'capturing',
      event: 'slow_replay_skipped_deadline',
    })
  }

  ctx.pagespeedCalls += Number(Boolean(speed.desktop)) + Number(Boolean(speed.mobile))

  await logPipelineEvent(ctx.auditId, {
    stage: 'capturing',
    event: 'capture_completed',
    durationMs: Date.now() - captureStart,
  })

  if (!screenshots.desktopUrl || !screenshots.desktopBase64) {
    const desktopFailure = (screenshots.captureFailures ?? []).find(
      (f: PageCaptureFailure) => f.code && f.code !== 'CAPTURE_FAILED'
    )
    const outage = buildCaptureOutageMessage(desktopFailure, normalizedUrl)
    await prisma.auditPage.update({
      where: { id: page.id },
      data: {
        status: 'FAILED',
        failureCode: outage.failureCode,
        failureMessage: outage.failureMessage,
      },
    })
    throw new SiteOutageError(outage.failureCode, outage.failureMessage, outage.throwMessage)
  }

  desktopBase64 = screenshots.desktopBase64
  mobileBase64 = screenshots.mobileBase64

  const metadataFromHtml = mergeRuntimeHeadMetadata(
    screenshots.desktopHtml
      ? parseMetadataFromHtml(screenshots.desktopHtml, normalizedUrl)
      : await fetchAndParseMetadata(normalizedUrl, {
          headers: scanAccessToFetchHeaders(ctx.scanAccess),
        }),
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
    slowReplay: slowReplayResult,
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

    // Honest mid-capture anchor before status flips to CHECKING.
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: { progress: PIPELINE_PROGRESS_SUBSTEP.CAPTURE_DONE },
    })

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
      if (!projectPi || projectPi.source !== 'user') {
        await mutateProjectIntelligence(auditRow.projectId, (current) =>
          mergeHeuristicIntoProjectPi(current, inferred)
        )
      }
    } else if (auditRow?.projectId && productContract.source === 'user' && !projectPi) {
      await mutateProjectIntelligence(
        auditRow.projectId,
        (current) => current ?? productIntelligenceFromContract(productContract)
      )
    }
  }

  const metadata = metadataFromHtml

  // Technology detection is deterministic and uses only evidence already
  // collected by this capture. It never performs another request.
  let detectedTech: ReturnType<typeof detectTechnologies> = []
  if (input.primary) {
    try {
      detectedTech = detectTechnologies(
        screenshots.desktopHtml ?? '',
        screenshots.responseHeaders ?? {},
        screenshots.technologyResources ?? [],
        screenshots.technologyRuntimeMarkers ?? []
      )
      const technologyStatus = screenshots.technologyResourcesTruncated
        ? 'PARTIAL'
        : 'COMPLETE'
      await persistTechnologyObservations(ctx.auditId, detectedTech, technologyStatus)
      const categoryCounts = detectedTech.reduce<Record<string, number>>((counts, tech) => {
        counts[tech.kind] = (counts[tech.kind] ?? 0) + 1
        return counts
      }, {})
      await logPipelineEvent(ctx.auditId, {
        stage: 'checking',
        event: 'technology_detection_completed',
        detail: JSON.stringify({
          count: detectedTech.length,
          categories: categoryCounts,
          status: technologyStatus,
        }),
      })
    } catch (error) {
      await persistTechnologyObservations(ctx.auditId, [], 'UNAVAILABLE')
      await logPipelineEvent(ctx.auditId, {
        stage: 'checking',
        event: 'technology_detection_failed',
        error: error instanceof Error ? error.message : 'Technology detection failed',
      })
    }
  }
  const industryGuess = input.primary
    ? inferIndustry(new URL(normalizedUrl).hostname, metadata.pageText ?? '')
    : null

  // Industry remains part of the page snapshot; technology observations have
  // their own normalized audit-level records.
  if (input.primary) {
    await prisma.auditPage.update({
      where: { id: page.id },
      data: {
        performanceData: {
          ...storedPerformance,
          industryGuess,
        } as never,
      },
    })
  }

  assertDeadline(ctx, 'checking')
  await logPipelineEvent(ctx.auditId, { stage: 'checking', event: 'checks_started' })
  if (input.primary) {
    // Streaming anchor: from here the progressive report may show live
    // findings as deterministic check modules complete (flags persist at
    // CHECKS_DONE). Keeps the ring moving through the opaque CHECKING gap.
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: { progress: PIPELINE_PROGRESS_SUBSTEP.CHECKS_STARTED },
    })
  }
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
    screenshots?.responseHeaders ?? null,
    screenshots?.axeViolations ?? [],
  )

  for (const mod of failedModules) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'checking',
      event: `check_failed`,
      detail: mod,
    })
  }

  const flags = suppressFlagsForPageRole(suppressOverlappingFlags(
    detFlags
      .concat(
        input.primary && input.position === 0 && flowResult ? runFlowChecks(flowResult) : []
      )
      .concat(
        input.primary && input.position === 0
          ? runNetworkEngagementChecks(
              screenshots?.networkFailures ?? [],
              screenshots?.formProbe ?? null
            )
          : []
      )
      .concat(
        input.primary && input.position === 0 && slowReplayResult
          ? runSlowReplayChecks(slowReplayResult)
          : []
      )
  ), input.role).map((flag) => ({
      ...flag,
      checkId:
        input.position === 0
          ? flag.checkId
          : `${flag.checkId}::page:${input.position}`,
      pageUrl: normalizedUrl,
    }))

  await recordTargetedPageVerifierExecutions({
    auditId: ctx.auditId,
    pageUrl: normalizedUrl,
    primary: input.primary && input.position === 0,
    failedModules,
    flowCompleted: Boolean(flowResult),
    availableTools: [
      'html-parse',
      'browser-capture',
      ...(pagespeed?.desktop && pagespeed?.mobile ? ['pagespeed' as const] : []),
      ...(flowResult ? ['flow-navigation' as const] : []),
    ],
  })

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

  // Deferred flow scan: run after checks complete if deadline budget allows.
  // This moves ~20s of flow scanning out of the critical path so checks and
  // triage start sooner. Flow flags merge into the flag array for triage.
  if (shouldRunFlow && hasDeadlineBudgetForFlow && !captured.flowResult) {
    await logPipelineEvent(ctx.auditId, { stage: 'checking', event: 'flow_started_deferred' })
    if (input.primary) {
      await prisma.audit.update({
        where: { id: ctx.auditId },
        data: { progress: PIPELINE_PROGRESS_SUBSTEP.FLOW_RUNNING },
      })
    }
    const flowStart = Date.now()
    try {
      const browser = await getAuditBrowser()
      const flowSession = await createAuditPage(browser, normalizedUrl, {
        profile: DESKTOP_CAPTURE_PROFILE,
        scanAccess: ctx.scanAccess,
        journeySafe: true,
        settle: false,
        deadline: ctx.deadline,
      })
      const landingStep = {
        label: 'Landing',
        screenshotUrl: captured.desktopUrl ?? '',
        url: normalizedUrl,
      }
      flowResult = await runFlowScan(flowSession.page, ctx.auditId, normalizedUrl, {
        landingStep,
        fetchHeaders: scanAccessToFetchHeaders(ctx.scanAccess),
        deadlineMs: Math.max(1, Math.min(20_000, ctx.deadline - Date.now() - 15_000)),
      })
      flowSession.disposeNetwork()
      await flowSession.page.close().catch(() => {})
      await flowSession.page.context().close().catch(() => {})
      await logPipelineEvent(ctx.auditId, {
        stage: 'checking',
        event: 'flow_completed_deferred',
        durationMs: Date.now() - flowStart,
      })
      const flowFlags = runFlowChecks(flowResult).map((flag) => ({
        ...flag,
        pageUrl: normalizedUrl,
      }))
      if (flowFlags.length > 0) {
        flags.push(...flowFlags)
      }
    } catch (err) {
      await logPipelineEvent(ctx.auditId, {
        stage: 'checking',
        event: 'flow_failed_deferred',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  } else if (shouldRunFlow && !hasDeadlineBudgetForFlow) {
    await logPipelineEvent(ctx.auditId, {
      stage: 'checking',
      event: 'flow_skipped_deadline_deferred',
    })
  }

  const harvests = screenshots?.evidenceHarvest ?? []
  const flowCheckId = flowResult ? flowCheckIdForStatus(flowResult.status) : null
  const flowExtra = flowExtraFromAnchor(
    flowCheckId,
    'desktop',
    flowResult?.ctaAnchor ?? null
  )
  const flagsWithTargets = attachEvidenceTargets(
    flags,
    harvests,
    flowExtra ? [flowExtra] : []
  )
  flags.splice(0, flags.length, ...flagsWithTargets)

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
  let triage: TriageResult | undefined
  let triageFailure: ReturnType<typeof parseTriageFailure> | undefined

  if (!isTriageProviderConfigured()) {
    // No LLM key: don't transition to JUDGING or attempt a call that can only
    // fail. Matches lib/env.ts intent for keyless deploys.
    triageFailure = {
      reason: 'no_provider_keys',
      message: 'No AI provider keys configured for triage',
      retryable: false,
    }
    await logPipelineEvent(ctx.auditId, {
      stage: 'judging',
      event: 'triage_skipped_no_provider',
    })
  } else {
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
    runTriage: true,
    detectedTech,
    industryGuess,
  }
}
