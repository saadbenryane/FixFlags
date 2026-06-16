import puppeteer, { Browser, ConsoleMessage, Page } from 'puppeteer'
import fs from 'fs'
import { uploadScreenshot } from '../storage/screenshots'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import type { ScreenshotCaptureStatus } from './screenshot-types'
import { assertPublicAuditUrl } from './url'
import { logger } from '../logger'

let browser: Browser | null = null

const SETTLE_MS = 1500
const TIMEOUT_MS = 30_000

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
}

interface ViewportCapture {
  base64: string | null
  url: string | null
  html: string | null
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
  let page: Page | null = null

  try {
    page = await b.newPage()
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const protocol = new URL(request.url()).protocol
      if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') {
        void request.continue()
        return
      }
      void assertPublicAuditUrl(request.url())
        .then(() => request.continue())
        .catch(() => request.abort('blockedbyclient'))
    })
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: msg.type(), text: msg.text() })
      }
    })

    await page.setViewport({
      width: options.width,
      height: options.height,
      isMobile: options.isMobile,
      deviceScaleFactor: options.deviceScaleFactor,
    })

    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    })
    const contentType = response?.headers()['content-type']?.toLowerCase() ?? ''
    if (!response?.ok() || (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml'))) {
      throw new Error('Destination did not return a successful HTML document')
    }
    await settlePage(page)

    if (options.captureHtml) {
      result.html = await page.content()
    }

    const buffer = await page.screenshot({ type: 'png', fullPage: false }) as Buffer

    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, options.device, buffer, options.pageKey)
  } catch (err) {
    logger.error(`${options.device} screenshot failed`, err)
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }

  return result
}

async function settlePage(_page: Page) {
  void _page
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
}

export async function captureScreenshots(
  url: string,
  auditId: string,
  pageKey?: string
): Promise<ScreenshotResult> {
  await assertPublicAuditUrl(url)
  const b = await getBrowser()
  const consoleErrors: Array<{ type: string; text: string }> = []

  const [desktop, mobile] = await Promise.all([
    captureViewport(
      b,
      url,
      auditId,
      {
        width: DESKTOP_VIEWPORT.width,
        height: DESKTOP_VIEWPORT.height,
        device: 'desktop',
        captureHtml: true,
        pageKey,
      },
      consoleErrors
    ),
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
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}
