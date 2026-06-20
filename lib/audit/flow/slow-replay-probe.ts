import type { Browser, Page } from 'puppeteer'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'

export interface SlowReplayResult {
  timeToFirstTextMs: number
  timeToCtaMs: number
  screenshotUrls: string[]
}

const SLOW_3G = {
  offline: false,
  downloadThroughput: 50 * 1024,
  uploadThroughput: 20 * 1024,
  latency: 400,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function measureVisibleText(page: Page): Promise<number> {
  return page.evaluate(() => {
    const text = (document.querySelector('main')?.innerText ?? document.body.innerText)
      .replace(/\s+/g, ' ')
      .trim()
    return text.length
  })
}

async function measureCtaVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      if (el.closest('nav, header, [role="navigation"]')) continue
      const combined = `${(el as HTMLAnchorElement).href ?? ''} ${el.textContent ?? ''}`.toLowerCase()
      if (!/get started|sign up|signup|start free|try|register|contact|pricing/i.test(combined)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight) return true
    }
    return false
  })
}

export async function runSlowReplay(
  browser: Browser,
  auditId: string,
  pageUrl: string,
  options: { allowLocalhost?: boolean } = {}
): Promise<SlowReplayResult> {
  let page: Page | null = null
  const screenshotUrls: string[] = []
  let timeToFirstTextMs = 30_000
  let timeToCtaMs = 30_000

  try {
    page = await browser.newPage()
    await page.setCacheEnabled(false)
    await page.setViewport({
      width: MOBILE_CAPTURE_PROFILE.width,
      height: MOBILE_CAPTURE_PROFILE.height,
      deviceScaleFactor: MOBILE_CAPTURE_PROFILE.deviceScaleFactor,
      isMobile: true,
    })
    await page.setUserAgent(MOBILE_CAPTURE_PROFILE.userAgent)
    await page.emulateNetworkConditions(SLOW_3G)

    const started = Date.now()
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const waitUntil = async (targetMs: number) => {
      const elapsed = Date.now() - started
      if (elapsed < targetMs) await sleep(targetMs - elapsed)
    }

    const captureScreenshot = async (label: string) => {
      try {
        const buffer = (await page!.screenshot({ type: 'png', fullPage: false })) as Buffer
        const url = await uploadScreenshot(auditId, 'mobile', buffer, label)
        screenshotUrls.push(url)
      } catch (err) {
        logger.error('Slow replay screenshot failed', err)
      }
    }

    const pollStart = Date.now()
    while (Date.now() - pollStart < 10_000) {
      const elapsed = Date.now() - started
      const textLen = await measureVisibleText(page)
      if (textLen > 20 && timeToFirstTextMs === 30_000) {
        timeToFirstTextMs = elapsed
      }
      if (await measureCtaVisible(page) && timeToCtaMs === 30_000) {
        timeToCtaMs = elapsed
      }
      if (timeToFirstTextMs < 30_000 && timeToCtaMs < 30_000) break
      await sleep(100)
    }

    await waitUntil(2_000)
    await captureScreenshot('flow-slow-2s')
    await waitUntil(5_000)
    await captureScreenshot('flow-slow-5s')
    await waitUntil(8_000)
    await captureScreenshot('flow-slow-8s')

    return { timeToFirstTextMs, timeToCtaMs, screenshotUrls }
  } catch (err) {
    logger.error('Slow replay probe failed', err)
    return { timeToFirstTextMs, timeToCtaMs, screenshotUrls }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}
