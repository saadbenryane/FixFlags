import type { Browser, Page } from 'playwright'
import { MOBILE_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { createAuditPage } from '@/lib/audit/browser/page-session'

export interface SlowReplayResult {
  timeToFirstTextMs: number
  timeToCtaMs: number
  screenshotUrls: string[]
  complete?: boolean
}

const SLOW_3G = {
  offline: false,
  downloadThroughput: 50 * 1024,
  uploadThroughput: 20 * 1024,
  latency: 400,
}

import { sleep } from '@/lib/utils/sleep'

async function measureVisibleText(page: Page): Promise<number> {
  return page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const text = (document.querySelector('main')?.innerText ?? document.body.innerText)
      .replace(/\s+/g, ' ')
      .trim()
    return text.length
  })
}

async function measureCtaVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      if (el.closest('nav, header, [role="navigation"]')) continue
      const combined = `${(el as HTMLAnchorElement).href ?? ''} ${el.textContent ?? ''}`.toLowerCase()
      if (!/get started|sign up|signup|start free|try|register|contact|pricing|book (?:a )?call|schedule/i.test(combined)) continue
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
  options: { deadline?: number; pageKey?: string; scanAccess?: import('../scan-access').ScanAccessConfig | null } = {},
): Promise<SlowReplayResult> {
  let page: Page | null = null
  const screenshotUrls: string[] = []
  let timeToFirstTextMs = 30_000
  let timeToCtaMs = 30_000

  try {
    const session = await createAuditPage(browser, pageUrl, {
      profile: MOBILE_CAPTURE_PROFILE, settle: false, deadline: options.deadline, scanAccess: options.scanAccess,
      journeySafe: true,
      allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
      configurePage: async initialPage => {
        const cdp = await initialPage.context().newCDPSession(initialPage)
        await cdp.send('Network.emulateNetworkConditions', SLOW_3G)
      },
    })
    page = session.page
    const started = session.navigationStartedAt

    const waitUntil = async (targetMs: number) => {
      const elapsed = Date.now() - started
      if (elapsed < targetMs) await sleep(targetMs - elapsed)
    }

    const captureScreenshot = async (label: string) => {
      try {
        const buffer = Buffer.from(await page!.screenshot({ type: 'png', fullPage: false }))
        const url = await uploadScreenshot(auditId, 'mobile', buffer, options.pageKey ? options.pageKey + '-' + label : label)
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

    return { timeToFirstTextMs, timeToCtaMs, screenshotUrls, complete: true }
  } catch (err) {
    logger.error('Slow replay probe failed', err)
    return { timeToFirstTextMs, timeToCtaMs, screenshotUrls, complete: false }
  } finally {
    if (page) {
      const context = page.context()
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }
  }
}
