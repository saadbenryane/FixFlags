import puppeteer, { Browser, ConsoleMessage } from 'puppeteer'
import { uploadScreenshot } from '../storage/r2'

let browser: Browser | null = null

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
  consoleErrors: Array<{ type: string; text: string }>
}

export async function captureScreenshots(
  url: string,
  auditId: string
): Promise<ScreenshotResult> {
  const b = await getBrowser()
  const consoleErrors: Array<{ type: string; text: string }> = []

  const result: ScreenshotResult = {
    desktopUrl: null,
    mobileUrl: null,
    desktopBase64: null,
    mobileBase64: null,
    consoleErrors: [],
  }

  const timeoutMs = 30_000

  // Desktop
  try {
    const page = await b.newPage()
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type()
      if (type === 'error') {
        consoleErrors.push({ type, text: msg.text() })
      }
    })

    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeoutMs,
    })

    const desktopBuffer = await page.screenshot({
      type: 'webp',
      quality: 80,
      fullPage: false,
    }) as Buffer

    result.desktopBase64 = desktopBuffer.toString('base64')

    if (process.env.R2_BUCKET_NAME) {
      result.desktopUrl = await uploadScreenshot(auditId, 'desktop', desktopBuffer)
    }

    await page.close()
  } catch (err) {
    console.error('Desktop screenshot failed:', err)
  }

  // Mobile
  try {
    const page = await b.newPage()
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: 'error', text: msg.text() })
      }
    })
    await page.setViewport({ width: 375, height: 812, isMobile: true, deviceScaleFactor: 2 })
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeoutMs,
    })

    const mobileBuffer = await page.screenshot({
      type: 'webp',
      quality: 80,
      fullPage: false,
    }) as Buffer

    result.mobileBase64 = mobileBuffer.toString('base64')

    if (process.env.R2_BUCKET_NAME) {
      result.mobileUrl = await uploadScreenshot(auditId, 'mobile', mobileBuffer)
    }

    await page.close()
  } catch (err) {
    console.error('Mobile screenshot failed:', err)
  }

  result.consoleErrors = consoleErrors
  return result
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}
