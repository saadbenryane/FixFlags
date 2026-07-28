import { chromium, type Browser, type Page } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import fs from 'fs'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import type { ScreenshotCaptureStatus } from './screenshot-types'
import { assertPublicAuditUrl } from './url'
import { logger } from '@/lib/logger'
import { runFlowScan, type FlowScanResult } from './flow/run-flow-scan'
import { createAuditPage, settleAuditPage } from './browser/page-session'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from './browser/capture-profile'
import { scanAccessToFetchHeaders } from './scan-access'
import type { ScanAccessConfig } from './scan-access'
import {
  measureMobileLayout,
  type CaptureMetrics,
  type PageLoadExperience,
} from './capture-metrics'
import type { RuntimeHeadMetadata } from './metadata'
import {
  pageCaptureFailureFromError,
  type PageCaptureFailure,
} from './browser/page-capture'
import { BrowserLaunchError, isInfrastructureAuditError } from './pipeline-errors'
import type { NetworkFailureRecord } from './browser/network-monitor'
import type { TechnologyResourceRecord } from './browser/network-monitor'
import type { FormProbeResult } from './browser/journey-safety'
import { createActionTimeline, type ActionTimelineEvent } from './action-timeline'

let browser: Browser | null = null

const BROWSER_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
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
    const launched = await chromium.launch({
      args: BROWSER_LAUNCH_ARGS,
      headless: true,
      executablePath,
    })
    launched.on('disconnected', () => {
      if (browser === launched) browser = null
    })
    return launched
  } catch (err) {
    throw new BrowserLaunchError(
      `Failed to launch Chromium${executablePath ? ` (${executablePath})` : ''}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    )
  }
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser
  // Drop any stale/crashed handle before relaunching.
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
  }
  try {
    browser = await launchBrowser()
    return browser
  } catch (err) {
    // Retry once for a transient launch failure (crashed handle, race). A missing
    // executable throws without a cause and won't benefit from a retry.
    if (err instanceof BrowserLaunchError && err.cause !== undefined) {
      browser = await launchBrowser()
      return browser
    }
    throw err
  }
}

export function getBrowserDiagnostics(): {
  connected: boolean
  activeContexts: number
} {
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
  errors: Array<{ type: string; text: string }>
): Array<{ type: string; text: string }> {
  return [...new Map(errors.map((e) => [`${e.type}:${e.text}`, e])).values()]
}

export interface ScreenshotResult {
  desktopUrl: string | null
  mobileUrl: string | null
  desktopBase64: string | null
  mobileBase64: string | null
  desktopHtml: string | null
  consoleErrors: Array<{ type: string; text: string }>
  captureStatus: ScreenshotCaptureStatus
  captureFailures: PageCaptureFailure[]
  flowResult?: FlowScanResult | null
  captureMetrics?: CaptureMetrics | null
  loadExperience?: PageLoadExperience | null
  runtimeHeadMetadata?: RuntimeHeadMetadata | null
  responseHeaders?: Record<string, string> | null
  networkFailures?: NetworkFailureRecord[]
  technologyResources?: TechnologyResourceRecord[]
  technologyResourcesTruncated?: boolean
  technologyRuntimeMarkers?: string[]
  actionTimeline?: ActionTimelineEvent[]
  formProbe?: FormProbeResult | null
  axeViolations?: import('./checks/accessibility').AxeViolation[]
}

interface ViewportCapture {
  base64: string | null
  url: string | null
  initialUrl: string | null
  html: string | null
  captureMetrics?: CaptureMetrics | null
  loadExperience?: PageLoadExperience | null
  runtimeHeadMetadata?: RuntimeHeadMetadata | null
  responseHeaders?: Record<string, string> | null
  networkFailures?: NetworkFailureRecord[]
  technologyResources?: TechnologyResourceRecord[]
  technologyResourcesTruncated?: boolean
  technologyRuntimeMarkers?: string[]
  axeViolations?: import('./checks/accessibility').AxeViolation[]
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

interface PageLoadSnapshot {
  readyState: string
  title: string | null
  loadingVisible: boolean
  loadingLabel: string | null
}

const LOADING_UI_SELECTOR =
  '[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'

async function readLoadSnapshot(page: Page): Promise<PageLoadSnapshot> {
  return page.evaluate((loadingSelector) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn

    function isBlockingLoadingEl(el: Element): boolean {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0')
        return false

      const inMain = Boolean(el.closest('main, [role="main"], [class*="hero" i]'))
      const viewportArea = window.innerWidth * window.innerHeight
      const elArea = rect.width * rect.height
      const coversViewport = elArea >= viewportArea * 0.12
      const isLargeOverlay = elArea >= viewportArea * 0.35
      if (!inMain && !coversViewport && !isLargeOverlay) return false
      return true
    }

    let loadingVisible = false
    let loadingLabel: string | null = null

    for (const el of document.querySelectorAll(loadingSelector)) {
      if (!isBlockingLoadingEl(el)) continue
      loadingVisible = true
      loadingLabel =
        el.getAttribute('aria-label') ||
        el.className.toString().split(/\s+/).find((c) => /skeleton|spinner|loading/i.test(c)) ||
        el.tagName.toLowerCase()
      break
    }

    return {
      readyState: document.readyState,
      title: document.title.trim() || null,
      loadingVisible,
      loadingLabel,
    }
  }, LOADING_UI_SELECTOR)
}

async function readRuntimeHeadMetadata(page: Page): Promise<RuntimeHeadMetadata> {
  return page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const content = (selector: string) =>
      document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || null
    const href = (selector: string) =>
      document.querySelector<HTMLLinkElement>(selector)?.href?.trim() || null

    return {
      title: document.title.trim() || null,
      description: content('meta[name="description"]'),
      ogTitle: content('meta[property="og:title"]'),
      ogDescription: content('meta[property="og:description"]'),
      ogImage: content('meta[property="og:image"]'),
      canonical: href('link[rel="canonical"]'),
      lang: document.documentElement.getAttribute('lang')?.trim() || null,
      viewport: content('meta[name="viewport"]'),
      robots: content('meta[name="robots"]'),
      hasFavicon: Boolean(
        document.querySelector(
          'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
        )
      ),
    }
  })
}

async function waitForFinishedLoadState(
  page: Page,
  device: 'desktop' | 'mobile',
  startedAt: number,
  initialScreenshotUrl: string | null,
  initialCaptureElapsedMs: number,
  initial: PageLoadSnapshot
): Promise<PageLoadExperience> {
  await page
    .waitForFunction(() => document.readyState === 'complete', { timeout: 8_000 })
    .catch(() => {})
  await page
    .waitForFunction(() => document.title.trim().length > 0, { timeout: 3_000 })
    .catch(() => {})

  let loadingClearedMs: number | null = initial.loadingVisible ? null : Date.now() - startedAt
  if (initial.loadingVisible) {
    await page
      .waitForFunction(
        (loadingSelector) => {
          for (const el of document.querySelectorAll(loadingSelector)) {
            const rect = el.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) continue
            const style = window.getComputedStyle(el)
            if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
              continue
            }
            return false
          }
          return true
        },
        LOADING_UI_SELECTOR,
        { timeout: 10_000 }
      )
      .then(() => {
        loadingClearedMs = Date.now() - startedAt
      })
      .catch(() => {})
  }

  await settleAuditPage(page)

  const final = await readLoadSnapshot(page)
  return {
    device,
    initialScreenshotUrl,
    initialCaptureElapsedMs,
    finalCaptureElapsedMs: Date.now() - startedAt,
    loadingVisibleAtInitial: initial.loadingVisible,
    loadingVisibleAtFinal: final.loadingVisible,
    loadingClearedMs,
    loadingLabel: initial.loadingLabel ?? final.loadingLabel,
    finalReadyState: final.readyState,
    finalTitle: final.title,
  }
}

function initialPageKey(pageKey: string | undefined): string {
  return pageKey ? `${pageKey}-initial` : 'initial'
}

function pickLoadExperience(
  desktop?: PageLoadExperience | null,
  mobile?: PageLoadExperience | null
): PageLoadExperience | null {
  const candidates = [desktop, mobile].filter(Boolean) as PageLoadExperience[]
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => {
    const aMs = a.loadingClearedMs ?? a.finalCaptureElapsedMs
    const bMs = b.loadingClearedMs ?? b.finalCaptureElapsedMs
    return bMs - aMs
  })[0]
}

async function closeSessionPage(page: Page | null): Promise<void> {
  if (!page) return
  const context = page.context()
  await page.close().catch(() => {})
  await context.close().catch(() => {})
}

async function captureDesktopWithFlow(
  b: Browser,
  targetUrl: string,
  auditId: string,
  pageKey: string | undefined,
  consoleErrors: Array<{ type: string; text: string }>,
  runFlow: boolean,
  scanAccess?: ScanAccessConfig | null,
  flowDeadlineMs?: number,
  deadline?: number
): Promise<
  ViewportCapture & {
    flowResult: FlowScanResult | null
    actionTimeline: ActionTimelineEvent[]
    formProbe: FormProbeResult | null
  }
> {
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
  try {
    const captureStartedAt = Date.now()
    timeline.push('navigate', `Open ${targetUrl}`, { url: targetUrl })
    const session = await createAuditPage(b, targetUrl, {
      profile: DESKTOP_CAPTURE_PROFILE,
      consoleErrors,
      settle: false,
      scanAccess,
      journeySafe: runFlow,
      deadline,
    })
    page = session.page
    disposeNetwork = session.disposeNetwork
    result.responseHeaders = session.responseHeaders
    result.networkFailures = [...session.networkFailures]
    result.technologyResources = [...session.technologyResources]
    result.technologyResourcesTruncated = session.technologyResourcesTruncated()
    result.formProbe = session.formProbe
    timeline.push('capture', 'Page loaded', { url: page.url() })

    const initial = await readLoadSnapshot(page)
    const initialBuffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    result.initialUrl = await uploadScreenshot(auditId, 'desktop', initialBuffer, initialPageKey(pageKey))

    result.loadExperience = await waitForFinishedLoadState(
      page,
      'desktop',
      captureStartedAt,
      result.initialUrl,
      Date.now() - captureStartedAt,
      initial
    )
    // Snapshot after the initial page has settled and before the CTA flow so
    // destination resources cannot contaminate the landing-page stack.
    result.technologyResources = [...session.technologyResources]
    result.technologyResourcesTruncated = session.technologyResourcesTruncated()
    result.runtimeHeadMetadata = await readRuntimeHeadMetadata(page)
    result.technologyRuntimeMarkers = await readTechnologyRuntimeMarkers(page)
    result.html = await page.content()

    // Run axe-core accessibility scan on the settled page.
    try {
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze()
      result.axeViolations = axeResults.violations as import('./checks/accessibility').AxeViolation[]
    } catch (err) {
      logger.warn('axe-core scan failed, falling back to PageSpeed checks', err)
      result.axeViolations = []
    }

    const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, 'desktop', buffer, pageKey)
    timeline.push('capture', 'Desktop screenshot captured', {
      screenshot: result.url,
      url: page.url(),
    })

    if (runFlow) {
      try {
        const landingStep = {
          label: 'Landing',
          screenshotUrl: result.url,
          url: page.url(),
        }
        timeline.push('flow', 'Starting CTA flow scan')
        result.flowResult = await runFlowScan(page, auditId, targetUrl, {
          landingStep,
          fetchHeaders: scanAccessToFetchHeaders(scanAccess),
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
          steps: result.url
            ? [{ label: 'Landing', screenshotUrl: result.url, url: page.url() }]
            : [],
          finalUrl: page.url(),
        }
        timeline.push('flow', 'Flow scan skipped after error')
      }
    }
  } catch (err) {
    logger.error('desktop screenshot failed', err)
    throw err
  } finally {
    disposeNetwork?.()
    await closeSessionPage(page)
    result.actionTimeline = timeline.snapshot()
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
  scanAccess?: ScanAccessConfig | null,
  deadline?: number
): Promise<ViewportCapture> {
  const result: ViewportCapture = { base64: null, url: null, initialUrl: null, html: null }
  let page: Page | null = null
  let disposeNetwork: (() => void) | null = null

  try {
    const captureStartedAt = Date.now()
    const session = await createAuditPage(b, targetUrl, {
      profile: MOBILE_CAPTURE_PROFILE,
      consoleErrors,
      settle: false,
      scanAccess,
      deadline,
    })
    page = session.page
    disposeNetwork = session.disposeNetwork
    result.networkFailures = [...session.networkFailures]

    const initial = await readLoadSnapshot(page)
    const initialBuffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    result.initialUrl = await uploadScreenshot(auditId, 'mobile', initialBuffer, initialPageKey(pageKey))

    result.loadExperience = await waitForFinishedLoadState(
      page,
      'mobile',
      captureStartedAt,
      result.initialUrl,
      Date.now() - captureStartedAt,
      initial
    )

    const buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }))
    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, 'mobile', buffer, pageKey)

    try {
      result.captureMetrics = await measureMobileLayout(page)
      result.captureMetrics.loadExperience = result.loadExperience ?? null
    } catch (err) {
      logger.error('mobile layout metrics failed', err)
    }
  } finally {
    disposeNetwork?.()
    await closeSessionPage(page)
  }

  return result
}

export async function captureScreenshots(
  url: string,
  auditId: string,
  pageKey?: string,
  options?: {
    runFlow?: boolean
    scanAccess?: ScanAccessConfig | null
    flowDeadlineMs?: number
    deadline?: number
  }
): Promise<ScreenshotResult> {
  await assertPublicAuditUrl(url)
  const b = await getBrowser()
  const consoleErrors: Array<{ type: string; text: string }> = []
  const captureFailures: PageCaptureFailure[] = []
  const runFlow = options?.runFlow ?? true
  const scanAccess = options?.scanAccess ?? null

  const [desktopSettled, mobileSettled] = await Promise.allSettled([
    captureDesktopWithFlow(
      b,
      url,
      auditId,
      pageKey,
      consoleErrors,
      runFlow,
      scanAccess,
      options?.flowDeadlineMs,
      options?.deadline
    ),
    captureMobileViewport(
      b,
      url,
      auditId,
      pageKey,
      consoleErrors,
      scanAccess,
      options?.deadline
    ),
  ])

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
  if (mobileSettled.status === 'fulfilled') {
    mobile = mobileSettled.value
  } else {
    logger.error('mobile screenshot failed', mobileSettled.reason)
    captureFailures.push(pageCaptureFailureFromError('mobile', mobileSettled.reason))
  }

  const loadExperience = pickLoadExperience(desktop.loadExperience, mobile.loadExperience)
  const captureMetrics = mobile.captureMetrics
    ? { ...mobile.captureMetrics, loadExperience }
    : null

  const mergedNetworkFailures = [
    ...(desktop.networkFailures ?? []),
    ...(mobile.networkFailures ?? []),
  ]

  return {
    desktopUrl: desktop.url,
    mobileUrl: mobile.url,
    desktopBase64: desktop.base64,
    mobileBase64: mobile.base64,
    desktopHtml: desktop.html,
    consoleErrors: dedupeConsoleErrors(consoleErrors),
    captureStatus: {
      desktop: desktop.url ? 'ok' : 'failed',
      mobile: mobile.url ? 'ok' : 'failed',
    },
    captureFailures,
    flowResult: desktop.flowResult,
    captureMetrics,
    loadExperience,
    runtimeHeadMetadata: desktop.runtimeHeadMetadata ?? null,
    responseHeaders: desktop.responseHeaders ?? null,
    networkFailures: mergedNetworkFailures,
    technologyResources: desktop.technologyResources ?? [],
    technologyResourcesTruncated: desktop.technologyResourcesTruncated ?? false,
    technologyRuntimeMarkers: desktop.technologyRuntimeMarkers ?? [],
    actionTimeline: desktop.actionTimeline ?? [],
    formProbe: desktop.formProbe ?? null,
    axeViolations: desktop.axeViolations ?? [],
  }
}

export async function getAuditBrowser(): Promise<Browser> {
  return getBrowser()
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

export { DESKTOP_VIEWPORT, MOBILE_VIEWPORT }
