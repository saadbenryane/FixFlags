import { prisma } from '../../db'
import { captureScreenshots, getAuditBrowser } from '../screenshot'
import {
  fetchAndParseMetadata,
  mergeRuntimeHeadMetadata,
  parseMetadataFromHtml,
  trimMetadataForStorage,
  type PageMetadata,
} from '../metadata'
import {
  fetchPageSpeedData,
  toStoredPageSpeedResult,
  type PageSpeedResult,
} from '../pagespeed'
import { runAllChecks, computeRubricScores } from '../checks'
import { runFlowChecks } from '../checks/flow'
import { runFlowScanStandalone, type FlowScanResult } from '../flow/run-flow-scan'
import { serializeFlowData } from '../flow/flow-url'
import { persistDeterministicFlags } from '../persist'
import { AUDIT_PROGRESS, AUDIT_PROGRESS_SUBSTEP } from '../progress'
import { logPipelineEvent } from '../pipeline-log'
import { loadParentScreenshotBase64 } from '../copy-parent-artifacts'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../viewports'
import { assertDeadline, accumulateTriageUsage } from './context'
import { runTriageStep } from './triage-step'
import type { PipelineContext, PageRun } from './types'

interface RunPageInput {
  url: string
  position: number
  role: string
  primary: boolean
  skipCapture?: boolean
  parentId?: string
}

/** Capture, check, and (optionally) judge a single page within an audit run. */
export async function runPage(ctx: PipelineContext, input: RunPageInput): Promise<PageRun> {
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
  let capturedMetadata: PageMetadata | null = null
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

    const metadataFromHtml = mergeRuntimeHeadMetadata(
      screenshots.desktopHtml
        ? parseMetadataFromHtml(screenshots.desktopHtml, normalizedUrl)
        : await fetchAndParseMetadata(normalizedUrl),
      screenshots.runtimeHeadMetadata
    )
    capturedMetadata = metadataFromHtml
    const storedPerformance = {
      desktop: pagespeed.desktop ? toStoredPageSpeedResult(pagespeed.desktop) : null,
      mobile: pagespeed.mobile ? toStoredPageSpeedResult(pagespeed.mobile) : null,
      desktopError: pagespeed.desktopError ?? null,
      mobileError: pagespeed.mobileError ?? null,
      screenshots: screenshots.captureStatus,
      captureFailures: screenshots.captureFailures,
      loadExperience: screenshots.loadExperience ?? null,
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
                flowData: serializeFlowData(flowResult) as never,
              }
            : {}),
        },
      })
    }
  }

  const metadata =
    capturedMetadata ??
    (screenshots?.desktopHtml
      ? mergeRuntimeHeadMetadata(
          parseMetadataFromHtml(screenshots.desktopHtml, normalizedUrl),
          screenshots.runtimeHeadMetadata
        )
      : ((await prisma.auditPage.findUnique({
          where: { id: page.id },
          select: { htmlMetadata: true },
        }))?.htmlMetadata as PageMetadata | null) ??
        (await fetchAndParseMetadata(normalizedUrl)))

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
        flowData: serializeFlowData(flowResult) as never,
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

  // Nudge progress mid-CHECKING so the ring keeps moving through the (opaque)
  // gap between deterministic checks finishing and the AI judge starting.
  if (input.primary) {
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: { progress: AUDIT_PROGRESS_SUBSTEP.CHECKS_DONE },
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

  await prisma.auditPage.update({
    where: { id: page.id },
    data: { status: 'JUDGING' },
  })
  await prisma.audit.update({
    where: { id: ctx.auditId },
    data: { status: 'JUDGING', progress: AUDIT_PROGRESS.JUDGING },
  })

  const triage = await runTriageStep(ctx, {
    url: normalizedUrl,
    metadata,
    desktop: pagespeed?.desktop ?? null,
    mobile: pagespeed?.mobile ?? null,
    flags,
    desktopBase64,
    mobileBase64,
  })
  accumulateTriageUsage(ctx, triage)

  triage.output.newFlags = triage.output.newFlags.map((flag) => ({
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
    flowResult: input.primary && input.position === 0 ? flowResult : null,
    desktopBase64,
    mobileBase64,
    flags,
    triage,
  }
}
