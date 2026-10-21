import { captureScreenshot } from './browser/capture-screenshot'
import { collectRenderedHtml } from './browser/rendered-html'
import { observeRenderedCopy, type RenderedCopy } from './browser/rendered-copy'
import { collectRenderedSearchSnapshot, type RenderedSearchSnapshot } from './search/rendered-snapshot'
import { chromium, type Browser, type Page } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import fs from 'fs'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { currentExecutionOwnership } from './execution-ownership'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import type { ScreenshotCaptureStatus } from './screenshot-types'
import { assertPublicAuditUrl } from './url'
import { logger } from '@/lib/logger'
import { runFlowScan, type FlowScanResult, type FlowScanStep } from './flow/run-flow-scan'
import { createAuditPage, settleAuditPage } from './browser/page-session'
import { readLoadingUi, loadingUiInDocument, type LoadingUiSnapshot } from './browser/loading-ui'
import { observeViewport } from './browser/viewport-observation'
import { observeMotionWindow, collectReducedMotionWindow, type MotionWindow } from './browser/motion-observation'
import { applyMotionObservation } from './checks/motion-evidence'
import { sharedBrowser } from './browser/shared-browser'
import { bindPublicBrowserProxy, startPublicBrowserProxy } from './browser/public-proxy'
import { actionableConsoleErrors, type ConsoleCoverage } from './console-evidence'
import { captureProfileKey, captureAccessKey, type CaptureObservationScope } from './browser/observation-scope'
import { recordedAxeViolations, summarizeAccessibility, type AccessibilityEvidence } from './browser/accessibility-evidence'
import { ACCESSIBILITY_RUN_OPTIONS } from './checks/accessibility-rules'
import type { ConsoleMessage } from './console-evidence'
import { randomUUID } from 'node:crypto'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from './browser/capture-profile'
import type { ScanAccessConfig } from './scan-access'
import {
  measureMobileLayout,
  type CaptureMetrics,
  type PageLoadExperience,
} from './capture-metrics'
import type { RuntimeHeadMetadata } from './metadata'
import { NATIVE_HEAD_TEXT_LIMIT } from './checks/head-metadata'
import {
  pageCaptureFailureFromError,
  type PageCaptureFailure,
} from './browser/page-capture'
import { BrowserLaunchError, isInfrastructureAuditError } from './pipeline-errors'
import type { NetworkFailureRecord } from './browser/network-monitor'
import type { TechnologyResourceRecord } from './browser/network-monitor'
import type { FormProbeResult } from './browser/journey-safety'
import { createActionTimeline, type ActionTimelineEvent } from './action-timeline'
import {
  axeTargetsFromViolations,
  harvestEvidenceOnPage,
  type HarvestedEvidence,
} from './evidence-targets'

const browserRuntime = sharedBrowser(async () => {
  try { return await launchBrowser() }
  catch (error) {
    if (error instanceof BrowserLaunchError && error.cause !== undefined) return launchBrowser()
    throw error
  }
})

const BROWSER_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-quic',
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
]

export function getChromePath(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }
  return undefined
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = getChromePath()
  // Production images ship system Chromium; fail loudly if missing
  // instead of Playwright's cryptic browser-download error.
  if (!executablePath && process.env.NODE_ENV === 'production') {
    throw new BrowserLaunchError(
      'No Chromium executable found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a valid binary ' +
        `(looked at: ${process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium (unset)'}).`
    )
  }
  try {
    const proxy = await startPublicBrowserProxy()
    try {
      const launched = await chromium.launch({
        args: BROWSER_LAUNCH_ARGS,
        headless: true,
        executablePath,
        proxy: { server: proxy.url, bypass: '<-loopback>' },
      })
      bindPublicBrowserProxy(launched, proxy.url)
      launched.once('disconnected', () => { void proxy.close().catch(error => logger.error('Browser proxy cleanup failed', error)) })
      return launched
    } catch (error) { await proxy.close(); throw error }
  } catch (err) {
    throw new BrowserLaunchError(
      `Failed to launch Chromium${executablePath ? ` (${executablePath})` : ''}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    )
  }
}

export async function getBrowser(): Promise<Browser> {
  return browserRuntime.get()
}

export function getBrowserDiagnostics(): {
  connected: boolean
  activeContexts: number
} {
  const browser = browserRuntime.peek()
  return {
    connected: Boolean(browser?.isConnected()),
    activeContexts: browser?.isConnected() ? browser.contexts().length : 0,
  }
}

/**
 * Desktop and mobile captures each navigate their own page but push console
 * errors into one shared array, so any error that fires on every page load (the
 * common case) lands twice. Dedupe by type+text so the count reflects distinct
 * issues, not an artifact of running the same page through two viewports.
 */
export function dedupeConsoleErrors(
  errors: ConsoleMessage[]
): ConsoleMessage[] {
  return [...new Map(errors.map((e) => [e.identity ?? `${e.type}:${e.text}`, e])).values()]
}

export interface ScreenshotResult {
  renderedCopy?: RenderedCopy | null
  renderedSearchSnapshot?: RenderedSearchSnapshot
  originalDocument?: import('./search/contracts').PublicDocument
  desktopFinalUrl?: string
  desktopHttpStatus?: number | null
  desktopUrl: string | null
  mobileUrl: string | null
  desktopBase64: string | null
  mobileBase64: string | null
  desktopHtml: string | null
  desktopHtmlTruncated?: boolean
  desktopHtmlCompacted?: boolean
  consoleErrors: Array<{ type: string; text: string }>
  consoleCoverage?: ConsoleCoverage
  captureStatus: ScreenshotCaptureStatus
  captureFailures: PageCaptureFailure[]
  flowResult?: FlowScanResult | null
  captureMetrics?: CaptureMetrics | null
  motionWindow?: MotionWindow
  loadExperience?: PageLoadExperience | null
  runtimeHeadMetadata?: RuntimeHeadMetadata | null
  runtimeHeadScope?: CaptureObservationScope
  responseHeaders?: Record<string, string> | null
  tracking?: import('./tracking/contracts').TrackingEvidence
  networkFailures?: NetworkFailureRecord[]
  technologyResources?: TechnologyResourceRecord[]
  technologyResourcesTruncated?: boolean
  technologyRuntimeMarkers?: string[]
  actionTimeline?: ActionTimelineEvent[]
  formProbe?: FormProbeResult | null
  axeViolations?: import('./checks/accessibility').AxeViolation[]
  accessibilityEvidence?: AccessibilityEvidence
  renderedScope?: CaptureObservationScope
  collectionRestrictions?: string[]
  evidenceHarvest?: HarvestedEvidence[]
}

interface ViewportCapture {
  renderedCopy?: RenderedCopy | null
  renderedSearchSnapshot?: RenderedSearchSnapshot
  motionWindow?: MotionWindow
  consoleComplete?: boolean
  consoleObservedMs?: number
  consoleMinimumMs?: number
  consoleMessagesTruncated?: boolean
  consoleFinalUrl?: string
  originalDocument?: import('./search/contracts').PublicDocument
  finalUrl?: string
  httpStatus?: number | null
  base64: string | null
  url: string | null
  initialUrl: string | null
  html: string | null
  htmlTruncated?: boolean
  htmlCompacted?: boolean
  captureMetrics?: CaptureMetrics | null
  loadExperience?: PageLoadExperience | null
  runtimeHeadMetadata?: RuntimeHeadMetadata | null
  runtimeHeadScope?: CaptureObservationScope
  responseHeaders?: Record<string, string> | null
  tracking?: import('./tracking/contracts').TrackingEvidence
  networkFailures?: NetworkFailureRecord[]
  technologyResources?: TechnologyResourceRecord[]
  technologyResourcesTruncated?: boolean
  technologyRuntimeMarkers?: string[]
  axeViolations?: import('./checks/accessibility').AxeViolation[]
  accessibilityEvidence?: AccessibilityEvidence
  renderedScope?: CaptureObservationScope
  collectionRestrictions?: string[]
  evidenceHarvest?: HarvestedEvidence
}

const TECHNOLOGY_RUNTIME_MARKERS = [
  '__NEXT_DATA__',
  '__NUXT__',
  '__remixContext',
  'Shopify',
  'Sentry',
  'Intercom',
] as const

async function readTechnologyRuntimeMarkers(page: Page): Promise<string[]> {
  return page.evaluate((markers) =>
    markers.filter((marker) => Object.prototype.hasOwnProperty.call(window, marker))
  , TECHNOLOGY_RUNTIME_MARKERS)
}

async function readRuntimeHeadMetadata(page: Page): Promise<{ metadata: RuntimeHeadMetadata; finalUrl: string }> {
  return page.evaluate((maximum) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const bounded = (value: string | null | undefined) => value && value.length > maximum ? undefined : value?.trim() || null
    const content = (selector: string) =>
      bounded(document.querySelector<HTMLMetaElement>(selector)?.content)
    const href = (selector: string) =>
      bounded(document.querySelector<HTMLLinkElement>(selector)?.href)
    const image = content('meta[property="og:image"]')
    let imageUrl = image
    if (image) {
      try { imageUrl = bounded(new URL(image, document.baseURI).href) }
      catch { /* Keep an observed invalid declaration for the destination check. */ }
    }

    const metadata: RuntimeHeadMetadata = {
      title: bounded(document.title),
      description: content('meta[name="description"]'),
      ogTitle: content('meta[property="og:title"]'),
      ogDescription: content('meta[property="og:description"]'),
      ogImage: imageUrl,
      canonical: href('link[rel="canonical"]'),
      lang: bounded(document.documentElement.getAttribute('lang')),
      viewport: content('meta[name="viewport"]'),
      robots: content('meta[name="robots"]'),
      hasFavicon: Boolean(
        document.querySelector(
          'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
        )
      ),
    }
    return { finalUrl: location.href, metadata: Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined)) as RuntimeHeadMetadata }
  }, NATIVE_HEAD_TEXT_LIMIT)
}

async function waitForFinishedLoadState(
  page: Page,
  device: 'desktop' | 'mobile',
  startedAt: number,
  initial: LoadingUiSnapshot,
  scope: CaptureObservationScope,
  restrictions: string[] = [],
  deadline?: number,
): Promise<PageLoadExperience> {
  const initialCaptureElapsedMs = Date.now() - startedAt
  const timeout = (maximum: number) => Math.max(1, Math.min(maximum, (deadline ?? Infinity) - Date.now()))
  // Start observing before media, document readiness or metadata can delay us.
  // Without observed loading UI there is no clearance measurement.
  const clearance = initial.loadingVisible ? page.waitForFunction(loadingUiInDocument, true, { timeout: timeout(10_000) })
    .then(async observation => {
      const clearedAt = await observation.jsonValue()
      return typeof clearedAt === 'number' && Number.isFinite(clearedAt) && clearedAt >= startedAt ? clearedAt - startedAt : null
    }).catch(() => null) : Promise.resolve(null)
  const [, , loadingClearedMs] = await Promise.all([
    page.waitForFunction(() => document.readyState === 'complete', undefined, { timeout: timeout(8_000) }).catch(() => {}),
    page.waitForFunction(() => document.title.trim().length > 0, undefined, { timeout: timeout(3_000) }).catch(() => {}),
    clearance,
  ])

  await settleAuditPage(page)

  const final = await readLoadingUi(page)
  const content = await observeViewport(page, { profile: scope.profile, includeActions: false, excludeLoading: true })
  return {
    device,
    initialScreenshotUrl: null,
    initialCaptureElapsedMs,
    finalCaptureElapsedMs: Date.now() - startedAt,
    loadingVisibleAtInitial: initial.loadingVisible,
    loadingVisibleAtFinal: final.loadingVisible,
    loadingClearedMs,
    loadingLabel: initial.loadingLabel ?? final.loadingLabel,
    finalReadyState: final.readyState,
    finalTitle: final.title,
    observation: { version: 1, device, scope: { ...scope, finalUrl: content.pageUrl }, contentVisible: content.content === true,
      ready: final.readyState === 'complete', restricted: restrictions.length > 0 },
  }
}

function initialPageKey(pageKey: string | undefined): string {
  return pageKey ? `${pageKey}-initial` : 'initial'
}

async function closeSessionPage(page: Page | null): Promise<void> {
  if (!page) return
  const context = page.context()
  await page.close().catch(() => {})
  await context.close().catch(() => {})
}

async function consoleWindowComplete(page: Page | null, truncated: (() => boolean) | undefined, timing: (() => { loaded: boolean; observedMs: number; minimumMs: number }) | undefined,
  errors: ConsoleMessage[], minimumMs: number, deadline?: number): Promise<boolean> {
  const until = Math.min(deadline ?? Infinity, Date.now() + 90_000)
  if (!page || truncated?.() || timing?.().loaded === false || Date.now() >= until) return false
  // A client navigation starts a fresh load window. Re-read its timing after
  // waiting so elapsed time on an earlier document cannot certify the final one.
  while (timing && !actionableConsoleErrors(errors).length) {
    if (!timing().loaded || truncated?.()) return false
    const remaining = Math.max(0, Math.max(2000, minimumMs) - timing().observedMs)
    if (!remaining) break
    if (Date.now() + remaining >= until) return false
    await new Promise(resolve => setTimeout(resolve, remaining))
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const ready = await Promise.race([
      page.evaluate(() => document.readyState === 'complete').then(value => value === true).catch(() => false),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), Math.min(1000, Math.max(1, until - Date.now()))) }),
    ])
    return ready && !truncated?.()
  } finally { clearTimeout(timer) }
}

async function settleCaptureUploads(uploads: Promise<void>[]) {
  const results = await Promise.allSettled(uploads)
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
}

async function settleProfile<T>(work: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  try { return { status: 'fulfilled', value: await work() } }
  catch (reason) { return { status: 'rejected', reason } }
}

export type ScreenshotCaptureOptions = {
  consoleObservationMs?: number
  runFlow?: boolean
  scanAccess?: ScanAccessConfig | null
  flowDeadlineMs?: number
  deadline?: number
  onInitialScreenshot?: (url: string) => void
  collectOriginalDocument?: boolean
  /** Progressive DOM collection must not depend on private media storage. */
  captureMedia?: boolean
  mediaOnly?: boolean
  captureMotion?: boolean
  /** Progressive motion has its own checkpoint, so other page checks publish first. */
  deferMotionComparison?: boolean
  collectMobile?: boolean
  collectAccessibility?: boolean
}
type ProfileCaptureOptions = ScreenshotCaptureOptions & { consoleIdentityKey: string }

async function captureDesktopWithFlow(
  b: Browser,
  targetUrl: string,
  auditId: string,
  pageKey: string | undefined,
  consoleErrors: Array<{ type: string; text: string }>,
  options: ProfileCaptureOptions,
): Promise<
  ViewportCapture & {
    flowResult: FlowScanResult | null
    actionTimeline: ActionTimelineEvent[]
    formProbe: FormProbeResult | null
  }
> {
  const { runFlow = true, scanAccess, flowDeadlineMs, deadline, onInitialScreenshot, collectOriginalDocument = true,
    captureMedia = true, mediaOnly = false, consoleIdentityKey, consoleObservationMs = 0, collectAccessibility = true } = options
  const timeline = createActionTimeline()
  const result: ViewportCapture & {
    flowResult: FlowScanResult | null
    actionTimeline: ActionTimelineEvent[]
    formProbe: FormProbeResult | null
  } = {
    base64: null,
    url: null,
    initialUrl: null,
    html: null,
    flowResult: null,
    actionTimeline: [],
    formProbe: null,
  }

  let page: Page | null = null
  let disposeNetwork: (() => void) | null = null
  let consoleTruncated: (() => boolean) | undefined
  let consoleTiming: (() => { loaded: boolean; observedMs: number; minimumMs: number }) | undefined
  let finishedLoad: Promise<PageLoadExperience> | undefined
  const uploads: Promise<void>[] = []
  let landingStep: FlowScanStep | undefined
  try {
    timeline.push('navigate', `Open ${targetUrl}`, { url: targetUrl })
    const session = await createAuditPage(b, targetUrl, {
      profile: DESKTOP_CAPTURE_PROFILE,
      consoleErrors,
      consoleIdentityKey,
      settle: false,
      scanAccess,
      journeySafe: true,
      deadline,
      collectSearchEvidence: collectOriginalDocument,
    })
    page = session.page
    consoleTruncated = session.consoleTruncated
    consoleTiming = session.consoleTiming
    const captureStartedAt = session.navigationStartedAt
    disposeNetwork = session.disposeNetwork
    result.responseHeaders = session.responseHeaders
    result.originalDocument = session.originalDocument
    result.finalUrl = page.url()
    result.httpStatus = session.httpStatus
    result.networkFailures = [...session.networkFailures]
    result.technologyResources = [...session.technologyResources]
    result.technologyResourcesTruncated = session.technologyResourcesTruncated()
    result.formProbe = session.formProbe
    result.collectionRestrictions = session.safetyRestrictions
    timeline.push('capture', 'Page loaded', { url: page.url() })

    const initial = await readLoadingUi(page)
    finishedLoad = waitForFinishedLoadState(page, 'desktop', captureStartedAt, initial, {
      pageUrl: targetUrl, finalUrl: page.url(), profile: captureProfileKey(DESKTOP_CAPTURE_PROFILE), access: captureAccessKey(scanAccess, targetUrl),
    }, session.safetyRestrictions, deadline)
    void finishedLoad.catch(() => undefined)
    let initialCaptureElapsedMs = Date.now() - captureStartedAt
    if (captureMedia) try {
      const initialBuffer = await captureScreenshot(page, { type: 'png', fullPage: false }, deadline)
      const uploading = uploadScreenshot(auditId, 'desktop', initialBuffer, initialPageKey(pageKey), { deadline }).then(url => {
        result.initialUrl = url
        onInitialScreenshot?.(url)
      })
      uploads.push(uploading); void uploading.catch(() => undefined)
    } catch (error) {
      logger.warn('Optional screenshot unavailable', { error })
    } finally {
      initialCaptureElapsedMs = Date.now() - captureStartedAt
    }

    result.loadExperience = { ...await finishedLoad, initialScreenshotUrl: result.initialUrl, initialCaptureElapsedMs }
    result.tracking = session.tracking('page_load')
    // Snapshot after the initial page has settled and before the CTA flow so
    // destination resources cannot contaminate the landing-page stack.
    result.technologyResources = [...session.technologyResources]
    result.technologyResourcesTruncated = session.technologyResourcesTruncated()
    if (!mediaOnly) {
      const head = await readRuntimeHeadMetadata(page)
      result.runtimeHeadMetadata = head.metadata
      result.runtimeHeadScope = { pageUrl: targetUrl, finalUrl: head.finalUrl,
        profile: captureProfileKey(DESKTOP_CAPTURE_PROFILE), access: captureAccessKey(scanAccess, targetUrl) }
      result.technologyRuntimeMarkers = await readTechnologyRuntimeMarkers(page)
      try { result.renderedSearchSnapshot = await collectRenderedSearchSnapshot(page) }
      catch (error) { logger.warn('Rendered Search sections could not be collected', error) }
      const rendered = await collectRenderedHtml(page)
      result.html = rendered.html
      result.htmlTruncated = rendered.truncated
      result.htmlCompacted = rendered.compacted
      result.finalUrl = rendered.finalUrl ?? page.url()
      try {
        const copy = await observeRenderedCopy(page)
        result.renderedCopy = copy.pageUrl === result.finalUrl ? copy : null
      } catch (error) {
        result.renderedCopy = null
        logger.warn('Rendered copy could not be observed', error)
      }
      if (!rendered.truncated) result.renderedScope = { pageUrl: targetUrl, finalUrl: result.finalUrl,
        profile: captureProfileKey(DESKTOP_CAPTURE_PROFILE), access: captureAccessKey(scanAccess, targetUrl) }

    // Run axe-core on the top document + same-origin frames only.
    // Legacy mode disables cross-origin frame injection (YouTube/Calendly/etc.),
    // which otherwise flags third-party player DOM as the site's own a11y debt.
    if (collectAccessibility) try {
      const axeResults = await new AxeBuilder({ page })
        .options(ACCESSIBILITY_RUN_OPTIONS)
        .setLegacyMode(true)
        .analyze()
      result.axeViolations = recordedAxeViolations(axeResults)
      result.accessibilityEvidence = summarizeAccessibility(axeResults, { pageUrl: targetUrl, finalUrl: axeResults.url,
        profile: captureProfileKey(DESKTOP_CAPTURE_PROFILE), access: captureAccessKey(scanAccess, targetUrl) })
    } catch (err) {
      logger.warn('axe-core scan failed; accessibility evidence is unavailable', err)
      // Undefined means collection failed. An empty array means axe actually ran.
      result.axeViolations = undefined
      result.accessibilityEvidence = undefined
    }
    }

    if (captureMedia) try {
      const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, deadline)
      result.base64 = buffer.toString('base64')
      const uploading = uploadScreenshot(auditId, 'desktop', buffer, pageKey, { deadline }).then(url => { result.url = url })
      uploads.push(uploading); void uploading.catch(() => undefined)
    } catch (error) {
      logger.warn('Optional screenshot unavailable', { error })
    }
    timeline.push('capture', result.base64 ? 'Desktop screenshot captured' : 'Rendered content inspected', {
      screenshot: result.url,
      url: page.url(),
    })

    if (captureMedia && !mediaOnly) try {
      result.evidenceHarvest = await harvestEvidenceOnPage(
        page,
        'desktop',
        axeTargetsFromViolations(result.axeViolations)
      ) ?? undefined
    } catch (err) {
      logger.warn('Desktop evidence harvest skipped', err)
    }

    if (runFlow) {
      try {
        landingStep = {
          label: 'Landing',
          screenshotUrl: result.url,
          url: page.url(),
        }
        timeline.push('flow', 'Starting CTA flow scan')
        result.flowResult = await runFlowScan(page, auditId, targetUrl, {
          landingStep,
          scanAccess,
          deadlineMs: flowDeadlineMs,
        })
        result.networkFailures = [...session.networkFailures]
        result.formProbe = session.formProbe
        timeline.push('flow', `Flow scan ${result.flowResult.status}`, {
          url: result.flowResult.finalUrl,
          status: result.flowResult.httpStatus,
        })
        if (result.flowResult.overlayBlocker) {
          timeline.push('overlay', 'Overlay blocked primary CTA')
        }
      } catch (err) {
        logger.error('Flow scan failed', err)
        result.flowResult = {
          status: 'skipped',
          steps: landingStep ? [landingStep] : [],
          finalUrl: page.url(),
        }
        timeline.push('flow', 'Flow scan skipped after error')
      }
    }
  } catch (err) {
    logger.error('desktop screenshot failed', err)
    throw err
  } finally {
    result.consoleComplete = !mediaOnly && await consoleWindowComplete(page, consoleTruncated, consoleTiming, consoleErrors, consoleObservationMs, deadline)
    result.consoleObservedMs = consoleTiming?.().observedMs ?? 0
    result.consoleFinalUrl = page?.url()
    disposeNetwork?.()
    await closeSessionPage(page)
    await finishedLoad?.catch(() => undefined)
    result.consoleMinimumMs = consoleTiming?.().minimumMs ?? 0
    result.consoleMessagesTruncated = consoleTruncated?.() ?? false
    result.consoleComplete = result.consoleComplete && !result.consoleMessagesTruncated
    // Storage cannot retain the browser's physical capacity. Uploads already
    // run alongside observation, and finish only after the context is closed.
    await settleCaptureUploads(uploads)
    if (result.loadExperience) result.loadExperience.initialScreenshotUrl = result.initialUrl
    if (landingStep) landingStep.screenshotUrl = result.url
    result.actionTimeline = timeline.snapshot().map(event => event.kind === 'capture' && event.label === 'Desktop screenshot captured'
      ? { ...event, screenshot: result.url } : event)
    result.formProbe = result.formProbe ?? null
  }

  return result
}

async function captureMobileViewport(
  b: Browser,
  targetUrl: string,
  auditId: string,
  pageKey: string | undefined,
  consoleErrors: Array<{ type: string; text: string }>,
  options: ProfileCaptureOptions,
): Promise<ViewportCapture> {
  const { scanAccess, deadline, captureMedia = true, mediaOnly = false, consoleIdentityKey,
    consoleObservationMs = 0, captureMotion = true } = options
  const result: ViewportCapture = { base64: null, url: null, initialUrl: null, html: null }
  let page: Page | null = null
  let disposeNetwork: (() => void) | null = null
  let consoleTruncated: (() => boolean) | undefined
  let consoleTiming: (() => { loaded: boolean; observedMs: number; minimumMs: number }) | undefined
  let finishedLoad: Promise<PageLoadExperience> | undefined
  let initialMotion: Promise<MotionWindow> | undefined
  let restrictions: string[] = []
  const uploads: Promise<void>[] = []

  try {
    const session = await createAuditPage(b, targetUrl, {
      profile: MOBILE_CAPTURE_PROFILE,
      consoleErrors,
      consoleIdentityKey,
      settle: false,
      scanAccess,
      deadline,
      journeySafe: true,
      ...(captureMotion && !mediaOnly ? {
        configurePage: (current: Page) => current.emulateMedia({ reducedMotion: 'no-preference' }),
        onNavigationStart: (current: Page, started: number) => {
          initialMotion = observeMotionWindow(current, started, deadline)
          void initialMotion.catch(() => undefined)
        },
      } : {}),
    })
    page = session.page
    consoleTruncated = session.consoleTruncated
    consoleTiming = session.consoleTiming
    const captureStartedAt = session.navigationStartedAt
    disposeNetwork = session.disposeNetwork
    restrictions = session.safetyRestrictions
    result.networkFailures = [...session.networkFailures]
    result.finalUrl = page.url()
    result.httpStatus = session.httpStatus

    const initial = await readLoadingUi(page)
    const loadingScope = { pageUrl: targetUrl, finalUrl: page.url(), profile: captureProfileKey(MOBILE_CAPTURE_PROFILE), access: captureAccessKey(scanAccess, targetUrl) }
    finishedLoad = waitForFinishedLoadState(page, 'mobile', captureStartedAt, initial, loadingScope, session.safetyRestrictions, deadline)
    void finishedLoad.catch(() => undefined)
    let initialCaptureElapsedMs = Date.now() - captureStartedAt
    if (captureMedia) try {
      const initialBuffer = await captureScreenshot(page, { type: 'png', fullPage: false }, deadline)
      const uploading = uploadScreenshot(auditId, 'mobile', initialBuffer, initialPageKey(pageKey), { deadline }).then(url => { result.initialUrl = url })
      uploads.push(uploading); void uploading.catch(() => undefined)
    } catch (error) {
      logger.warn('Optional screenshot unavailable', { error })
    } finally {
      initialCaptureElapsedMs = Date.now() - captureStartedAt
    }

    result.loadExperience = { ...await finishedLoad, initialScreenshotUrl: result.initialUrl, initialCaptureElapsedMs }

    if (captureMedia) try {
      const buffer = await captureScreenshot(page, { type: 'png', fullPage: false }, deadline)
      result.base64 = buffer.toString('base64')
      const uploading = uploadScreenshot(auditId, 'mobile', buffer, pageKey, { deadline }).then(url => { result.url = url })
      uploads.push(uploading); void uploading.catch(() => undefined)
    } catch (error) {
      logger.warn('Optional screenshot unavailable', { error })
    }

    if (captureMedia && !mediaOnly) try {
      result.evidenceHarvest = await harvestEvidenceOnPage(page, 'mobile') ?? undefined
    } catch (err) {
      logger.warn('Mobile evidence harvest skipped', err)
    }

    if (!mediaOnly) try {
      result.captureMetrics = await measureMobileLayout(page, loadingScope, session.safetyRestrictions)
      result.captureMetrics.loadExperience = result.loadExperience ?? null
    } catch (err) {
      logger.error('mobile layout metrics failed', err)
    }
  } finally {
    if (initialMotion) {
      const observed = await initialMotion.catch(() => undefined)
      if (observed?.pageUrl) result.motionWindow = { ...observed, restricted: (restrictions?.length ?? 0) > 0,
        contentVisible: result.captureMetrics?.loadingObservation?.scope.finalUrl === observed.pageUrl && result.captureMetrics.loadingObservation.contentVisible === true }
    }
    result.consoleComplete = !mediaOnly && await consoleWindowComplete(page, consoleTruncated, consoleTiming, consoleErrors, consoleObservationMs, deadline)
    result.consoleObservedMs = consoleTiming?.().observedMs ?? 0
    result.consoleFinalUrl = page?.url()
    disposeNetwork?.()
    await closeSessionPage(page)
    await finishedLoad?.catch(() => undefined)
    result.consoleMinimumMs = consoleTiming?.().minimumMs ?? 0
    result.consoleMessagesTruncated = consoleTruncated?.() ?? false
    result.consoleComplete = result.consoleComplete && !result.consoleMessagesTruncated
    await settleCaptureUploads(uploads)
    if (result.loadExperience) result.loadExperience.initialScreenshotUrl = result.initialUrl
  }

  return result
}

export async function captureScreenshots(
  url: string,
  auditId: string,
  pageKey?: string,
  options?: ScreenshotCaptureOptions
): Promise<ScreenshotResult> {
  const generation = currentExecutionOwnership()?.generation
  if (generation && !pageKey?.endsWith('-g' + generation)) pageKey = (pageKey ?? 'primary') + '-g' + generation
  await assertPublicAuditUrl(url)
  const b = await getBrowser()
  const desktopErrors: Array<{ type: string; text: string }> = []
  const mobileErrors: Array<{ type: string; text: string }> = []
  const captureFailures: PageCaptureFailure[] = []
  const runFlow = options?.runFlow ?? true
  const consoleIdentityKey = randomUUID()
  const scanAccess = options?.scanAccess ?? null
  const profileOptions = { ...options, runFlow, scanAccess, consoleIdentityKey }

  // A browser task holds one native context at a time. Other page tasks can
  // progress when one profile is waiting on a document or renderer.
  const desktopSettled = await settleProfile(() => captureDesktopWithFlow(
      b,
      url,
      auditId,
      pageKey,
      desktopErrors,
      profileOptions,
    ))
  const mobileSettled = options?.collectMobile === false ? null : await settleProfile(() => captureMobileViewport(
      b,
      url,
      auditId,
      pageKey,
      mobileErrors,
      profileOptions,
    ))

  let desktop: ViewportCapture & {
    flowResult: FlowScanResult | null
    actionTimeline?: ActionTimelineEvent[]
    formProbe?: FormProbeResult | null
  }
  if (desktopSettled.status === 'fulfilled') {
    desktop = desktopSettled.value
  } else {
    if (isInfrastructureAuditError(desktopSettled.reason)) throw desktopSettled.reason
    captureFailures.push(pageCaptureFailureFromError('desktop', desktopSettled.reason))
    desktop = { base64: null, url: null, initialUrl: null, html: null, flowResult: null }
  }

  let mobile: ViewportCapture = { base64: null, url: null, initialUrl: null, html: null }
  if (mobileSettled?.status === 'fulfilled') {
    mobile = mobileSettled.value
  } else if (mobileSettled) {
    logger.error('mobile screenshot failed', mobileSettled.reason)
    captureFailures.push(pageCaptureFailureFromError('mobile', mobileSettled.reason))
  }

  const loadExperience = mobile.loadExperience ?? null
  const captureMetrics = mobile.captureMetrics
    ? {
        ...mobile.captureMetrics,
        loadExperience: mobile.loadExperience ?? mobile.captureMetrics.loadExperience ?? null,
        desktopLoadExperience: desktop.loadExperience ?? null,
      }
    : null

  let observedMetrics: CaptureMetrics | null = captureMetrics
  if (observedMetrics && mobile.motionWindow && !options?.deferMotionComparison) {
    try {
      const after = await collectReducedMotionWindow(b, url, { deadline: options?.deadline ?? Date.now() + 30_000, scanAccess })
      observedMetrics = applyMotionObservation(observedMetrics, { version: 1,
        scope: { pageUrl: url, finalUrl: mobile.motionWindow.pageUrl, profile: captureProfileKey(MOBILE_CAPTURE_PROFILE), access: captureAccessKey(scanAccess, url) },
        before: mobile.motionWindow, after })
    } catch (error) { logger.warn('Initial reduced-motion comparison unavailable', { error }) }
  }

  const mergedNetworkFailures = [
    ...(desktop.networkFailures ?? []),
    ...(mobile.networkFailures ?? []),
  ]
  const consoleErrors = dedupeConsoleErrors([...desktopErrors, ...mobileErrors])

  return {
    desktopUrl: desktop.url,
    mobileUrl: mobile.url,
    desktopBase64: desktop.base64,
    mobileBase64: mobile.base64,
    renderedSearchSnapshot: desktop.renderedSearchSnapshot,
    desktopHtml: desktop.html,
    desktopHtmlTruncated: desktop.htmlTruncated,
    desktopHtmlCompacted: desktop.htmlCompacted,
    originalDocument: desktop.originalDocument,
    desktopFinalUrl: desktop.finalUrl,
    desktopHttpStatus: desktop.httpStatus,
    consoleErrors: consoleErrors.slice(0, 500),
    consoleCoverage: {
      phase: runFlow ? 'page_load_and_public_action' : 'page_load',
      pageUrl: url,
      access: captureAccessKey(scanAccess, url),
      messagesTruncated: consoleErrors.length > 500 || desktop.consoleMessagesTruncated === true || mobile.consoleMessagesTruncated === true,
      desktop: { complete: desktopSettled.status === 'fulfilled' && desktop.consoleComplete === true && Boolean(desktop.consoleFinalUrl),
        profile: captureProfileKey(DESKTOP_CAPTURE_PROFILE),
        finalUrl: desktop.consoleFinalUrl ?? captureFailures.find(failure => failure.device === 'desktop')?.finalUrl ?? null,
        errors: actionableConsoleErrors(dedupeConsoleErrors(desktopErrors)).length,
        observedMs: desktop.consoleObservedMs ?? 0, minimumMs: desktop.consoleMinimumMs ?? 0 },
      mobile: { complete: mobileSettled?.status === 'fulfilled' && mobile.consoleComplete === true && Boolean(mobile.consoleFinalUrl),
        profile: captureProfileKey(MOBILE_CAPTURE_PROFILE),
        finalUrl: mobile.consoleFinalUrl ?? captureFailures.find(failure => failure.device === 'mobile')?.finalUrl ?? null,
        errors: actionableConsoleErrors(dedupeConsoleErrors(mobileErrors)).length,
        observedMs: mobile.consoleObservedMs ?? 0, minimumMs: mobile.consoleMinimumMs ?? 0 },
    },
    captureStatus: {
      desktop: options?.captureMedia === false ? 'pending' : desktop.url ? 'ok' : 'failed',
      mobile: options?.collectMobile === false || options?.captureMedia === false ? 'pending' : mobile.url ? 'ok' : 'failed',
    },
    captureFailures,
    flowResult: desktop.flowResult,
    captureMetrics: observedMetrics,
    ...(mobile.motionWindow ? { motionWindow: mobile.motionWindow } : {}),
    loadExperience,
    runtimeHeadMetadata: desktop.runtimeHeadMetadata ?? null,
    runtimeHeadScope: desktop.runtimeHeadScope,
    renderedCopy: desktop.renderedCopy ?? null,
    responseHeaders: desktop.responseHeaders ?? null,
    networkFailures: mergedNetworkFailures,
    tracking: desktop.tracking,
    technologyResources: desktop.technologyResources ?? [],
    technologyResourcesTruncated: desktop.technologyResourcesTruncated ?? false,
    technologyRuntimeMarkers: desktop.technologyRuntimeMarkers ?? [],
    actionTimeline: desktop.actionTimeline ?? [],
    formProbe: desktop.formProbe ?? null,
    axeViolations: desktop.axeViolations,
    accessibilityEvidence: desktop.accessibilityEvidence,
    renderedScope: desktop.renderedScope,
    collectionRestrictions: desktop.collectionRestrictions ?? [],
    evidenceHarvest: [desktop.evidenceHarvest, mobile.evidenceHarvest].filter(
      (harvest): harvest is HarvestedEvidence => Boolean(harvest)
    ),
  }
}

export async function getAuditBrowser(): Promise<Browser> {
  return getBrowser()
}

export async function closeBrowser() {
  await browserRuntime.close()
}

export { DESKTOP_VIEWPORT, MOBILE_VIEWPORT }
