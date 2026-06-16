import type { Browser, ConsoleMessage, Page } from 'puppeteer'
import { assertPublicAuditUrl } from '../url'

export const SETTLE_MS = 1500
export const PAGE_TIMEOUT_MS = 30_000

export interface AuditPageSession {
  page: Page
  /** Shared console error buffer (mutated by page listeners). */
  consoleErrors: Array<{ type: string; text: string }>
}

export interface CreateAuditPageOptions {
  width: number
  height: number
  isMobile?: boolean
  deviceScaleFactor?: number
  consoleErrors?: Array<{ type: string; text: string }>
}

export async function settleAuditPage(_page: Page): Promise<void> {
  void _page
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
}

export async function createAuditPage(
  browser: Browser,
  targetUrl: string,
  options: CreateAuditPageOptions
): Promise<AuditPageSession> {
  const consoleErrors = options.consoleErrors ?? []
  const page = await browser.newPage()

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
    timeout: PAGE_TIMEOUT_MS,
  })
  const contentType = response?.headers()['content-type']?.toLowerCase() ?? ''
  if (
    !response?.ok() ||
    (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml'))
  ) {
    await page.close().catch(() => {})
    throw new Error('Destination did not return a successful HTML document')
  }

  await settleAuditPage(page)

  return { page, consoleErrors }
}

export async function withAuditPage<T>(
  browser: Browser,
  targetUrl: string,
  options: CreateAuditPageOptions,
  fn: (session: AuditPageSession) => Promise<T>
): Promise<T> {
  const session = await createAuditPage(browser, targetUrl, options)
  try {
    return await fn(session)
  } finally {
    await session.page.close().catch(() => {})
  }
}
