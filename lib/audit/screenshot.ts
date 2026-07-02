import puppeteer, { Browser } from 'puppeteer'
import fs from 'fs'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import type { ScreenshotCaptureStatus } from './screenshot-types'
import { assertPublicAuditUrl } from './url'
import { logger } from '@/lib/logger'
import { runFlowScan, type FlowScanResult } from './flow/run-flow-scan'
import { createAuditPage } from './browser/page-session'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from './browser/capture-profile'
import { measureMobileLayout, type CaptureMetrics } from './capture-metrics'
import {
  pageCaptureFailureFromError,
  type PageCaptureFailure,
} from './browser/page-capture'
import { BrowserLaunchError, isInfrastructureAuditError } from './pipeline-errors'

let browser: Browser | null = null

const BROWSER_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
]

export function getChromePath(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }
  return undefined
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = getChromePath()
  // Production images skip Puppeteer's bundled download (PUPPETEER_SKIP_DOWNLOAD),
  // so if no system binary resolves there's nothing to launch. Fail loudly with
  // the path we looked for instead of Puppeteer's cryptic "Could not find Chrome".
  if (!executablePath && process.env.NODE_ENV === 'production') {
    throw new BrowserLaunchError(
      'No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH to a valid binary ' +
        `(looked at: ${process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium (unset)'}).`
    )
  }
  try {
    const launched = await puppeteer.launch({
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
  if (browser && browser.connected) return browser
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
}

interface ViewportCapture {
  base64: string | null
  url: string | null
  html: string | null
  captureMetrics?: CaptureMetrics | null
}

async function captureDesktopWithFlow(
  b: Browser,
  targetUrl: string,
  auditId: string,
  pageKey: string | undefined,
  consoleErrors: Array<{ type: string; text: string }>,
  runFlow: boolean
): Promise<ViewportCapture & { flowResult: FlowScanResult | null }> {
  const result: ViewportCapture & { flowResult: FlowScanResult | null } = {
    base64: null,
    url: null,
    html: null,
    flowResult: null,
  }

  let page = null
  try {
    const session = await createAuditPage(b, targetUrl, {
      profile: DESKTOP_CAPTURE_PROFILE,
      consoleErrors,
    })
    page = session.page

    result.html = await page.content()

    const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, 'desktop', buffer, pageKey)

    if (runFlow) {
      try {
        const landingStep = {
          label: 'Landing',
          screenshotUrl: result.url,
          url: page.url(),
        }
        result.flowResult = await runFlowScan(page, auditId, targetUrl, { landingStep })
      } catch (err) {
        logger.error('Flow scan failed', err)
        result.flowResult = {
          status: 'skipped',
          steps: result.url
            ? [{ label: 'Landing', screenshotUrl: result.url, url: page.url() }]
            : [],
          finalUrl: page.url(),
        }
      }
    }
  } catch (err) {
    logger.error('desktop screenshot failed', err)
    throw err
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }

  return result
}

async function captureMobileViewport(
  b: Browser,
  targetUrl: string,
  auditId: string,
  pageKey: string | undefined,
  consoleErrors: Array<{ type: string; text: string }>
): Promise<ViewportCapture> {
  const result: ViewportCapture = { base64: null, url: null, html: null }
  let page = null

  try {
    const session = await createAuditPage(b, targetUrl, {
      profile: MOBILE_CAPTURE_PROFILE,
      consoleErrors,
    })
    page = session.page

    const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, 'mobile', buffer, pageKey)

    try {
      result.captureMetrics = await measureMobileLayout(page)
    } catch (err) {
      logger.error('mobile layout metrics failed', err)
    }
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }

  return result
}

export async function captureScreenshots(
  url: string,
  auditId: string,
  pageKey?: string,
  options?: { runFlow?: boolean }
): Promise<ScreenshotResult> {
  await assertPublicAuditUrl(url)
  const b = await getBrowser()
  const consoleErrors: Array<{ type: string; text: string }> = []
  const captureFailures: PageCaptureFailure[] = []
  const runFlow = options?.runFlow ?? true

  // Desktop and mobile use independent pages in the shared browser, so capture
  // them concurrently. Sequential capture doubled the wall-clock cost of the
  // slowest step (each page carries a 30s navigation timeout), which is what
  // pushed slow sites past the audit deadline.
  const [desktopSettled, mobileSettled] = await Promise.allSettled([
    captureDesktopWithFlow(b, url, auditId, pageKey, consoleErrors, runFlow),
    captureMobileViewport(b, url, auditId, pageKey, consoleErrors),
  ])

  let desktop: ViewportCapture & { flowResult: FlowScanResult | null }
  if (desktopSettled.status === 'fulfilled') {
    desktop = desktopSettled.value
  } else {
    // Browser/storage failures are our infrastructure, not the target site, so
    // let them abort the audit so they surface with their own failure code
    // instead of being mis-reported as "this site blocked our visit".
    if (isInfrastructureAuditError(desktopSettled.reason)) throw desktopSettled.reason
    captureFailures.push(pageCaptureFailureFromError('desktop', desktopSettled.reason))
    desktop = { base64: null, url: null, html: null, flowResult: null }
  }

  let mobile: ViewportCapture = { base64: null, url: null, html: null }
  if (mobileSettled.status === 'fulfilled') {
    mobile = mobileSettled.value
  } else {
    logger.error('mobile screenshot failed', mobileSettled.reason)
    captureFailures.push(pageCaptureFailureFromError('mobile', mobileSettled.reason))
  }

  return {
    desktopUrl: desktop.url,
    mobileUrl: mobile.url,
    desktopBase64: desktop.base64,
    mobileBase64: mobile.base64,
    desktopHtml: desktop.html,
    consoleErrors,
    captureStatus: {
      desktop: desktop.url ? 'ok' : 'failed',
      mobile: mobile.url ? 'ok' : 'failed',
    },
    captureFailures,
    flowResult: desktop.flowResult,
    captureMetrics: mobile.captureMetrics ?? null,
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
