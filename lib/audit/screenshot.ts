import puppeteer, { Browser } from 'puppeteer'
import fs from 'fs'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import type { ScreenshotCaptureStatus } from './screenshot-types'
import { assertPublicAuditUrl } from './url'
import { logger } from '@/lib/logger'
import { runFlowScan, type FlowScanResult } from './flow/run-flow-scan'
import { createAuditPage } from './browser/page-session'
import { measureMobileLayout, type CaptureMetrics } from './capture-metrics'

let browser: Browser | null = null

function getChromePath(): string | undefined {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ]
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p
  }
  return undefined
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
    executablePath: getChromePath(),
  })
  browser.on('disconnected', () => {
    browser = null
  })
  return browser
}

export interface ScreenshotResult {
  desktopUrl: string | null
  mobileUrl: string | null
  desktopBase64: string | null
  mobileBase64: string | null
  desktopHtml: string | null
  consoleErrors: Array<{ type: string; text: string }>
  captureStatus: ScreenshotCaptureStatus
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
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
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
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }

  return result
}

async function captureViewport(
  b: Browser,
  targetUrl: string,
  auditId: string,
  options: {
    width: number
    height: number
    device: 'desktop' | 'mobile'
    isMobile?: boolean
    deviceScaleFactor?: number
    captureHtml?: boolean
    pageKey?: string
  },
  consoleErrors: Array<{ type: string; text: string }>
): Promise<ViewportCapture> {
  const result: ViewportCapture = { base64: null, url: null, html: null }
  let page = null

  try {
    const session = await createAuditPage(b, targetUrl, {
      width: options.width,
      height: options.height,
      isMobile: options.isMobile,
      deviceScaleFactor: options.deviceScaleFactor,
      consoleErrors,
    })
    page = session.page

    if (options.captureHtml) {
      result.html = await page.content()
    }

    const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, options.device, buffer, options.pageKey)

    if (options.device === 'mobile') {
      try {
        result.captureMetrics = await measureMobileLayout(page)
      } catch (err) {
        logger.error('mobile layout metrics failed', err)
      }
    }
  } catch (err) {
    logger.error(`${options.device} screenshot failed`, err)
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
  const runFlow = options?.runFlow ?? true

  const [desktop, mobile] = await Promise.all([
    captureDesktopWithFlow(b, url, auditId, pageKey, consoleErrors, runFlow),
    captureViewport(
      b,
      url,
      auditId,
      {
        width: MOBILE_VIEWPORT.width,
        height: MOBILE_VIEWPORT.height,
        device: 'mobile',
        isMobile: true,
        deviceScaleFactor: MOBILE_VIEWPORT.deviceScaleFactor,
        pageKey,
      },
      consoleErrors
    ),
  ])

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
