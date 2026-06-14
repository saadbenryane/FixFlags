import puppeteer, { Browser, ConsoleMessage, Page } from 'puppeteer'
import { uploadScreenshot } from '../storage/screenshots'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from './viewports'
import type { ScreenshotCaptureStatus } from './screenshot-types'

let browser: Browser | null = null

const SETTLE_MS = 1500
const TIMEOUT_MS = 30_000

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
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
  },
  consoleErrors: Array<{ type: string; text: string }>
): Promise<ViewportCapture> {
  const result: ViewportCapture = { base64: null, url: null, html: null }
  let page: Page | null = null

  try {
    page = await b.newPage()
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

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    })
    await settlePage(page)

    if (options.captureHtml) {
      result.html = await page.content()
    }

    const buffer = (await page.screenshot({
      type: 'webp',
      quality: 80,
      fullPage: false,
    })) as Buffer

    result.base64 = buffer.toString('base64')
    result.url = await uploadScreenshot(auditId, options.device, buffer)
  } catch (err) {
    console.error(`${options.device} screenshot failed:`, err)
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }

  return result
}

async function settlePage(page: Page) {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
}

export async function captureScreenshots(
  url: string,
  auditId: string
): Promise<ScreenshotResult> {
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
