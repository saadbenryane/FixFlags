import type { Browser, ConsoleMessage, Page } from 'playwright'
import { assertPublicAuditUrl } from '../url'
import type { CaptureProfile } from './capture-profile'

export const PAGE_TIMEOUT_MS = 30_000

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i

export function isLocalhostAuditUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url)
}

export interface AuditPageSession {
  page: Page
  /** Shared console error buffer (mutated by page listeners). */
  consoleErrors: Array<{ type: string; text: string }>
  /** Response headers from the initial page navigation. */
  responseHeaders: Record<string, string>
}

export interface CreateAuditPageOptions {
  profile: CaptureProfile
  consoleErrors?: Array<{ type: string; text: string }>
  /** Demo fixture flow on localhost; skips public-URL guard for local dev URLs. */
  allowLocalhost?: boolean
  /** Set false when the caller needs the first post-DOMContentLoaded paint. */
  settle?: boolean
}

export async function settleAuditPage(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 })
  } catch {
    // timeout is fine. page may be slow. screenshot still captures useful state.
  }
}

export async function createAuditPage(
  browser: Browser,
  targetUrl: string,
  options: CreateAuditPageOptions
): Promise<AuditPageSession> {
  const consoleErrors = options.consoleErrors ?? []

  // Playwright sets viewport/userAgent/isMobile on BrowserContext, not Page.
  const context = await browser.newContext({
    viewport: { width: options.profile.width, height: options.profile.height },
    userAgent: options.profile.userAgent,
    deviceScaleFactor: options.profile.deviceScaleFactor ?? 1,
    locale: 'en-US',
    bypassCSP: true,
  })

  const page = await context.newPage()

  // Request interception: block non-public URLs via page.route().
  await page.route('**', async (route) => {
    const requestUrl = route.request().url()
    const protocol = new URL(requestUrl).protocol
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') {
      await route.continue()
      return
    }
    if (options.allowLocalhost && isLocalhostAuditUrl(requestUrl)) {
      await route.continue()
      return
    }
    try {
      await assertPublicAuditUrl(requestUrl)
      await route.continue()
    } catch {
      await route.abort('blockedbyclient')
    }
  })

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ type: msg.type(), text: msg.text() })
    }
  })

  const response = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: PAGE_TIMEOUT_MS,
  })

  const responseHeaders: Record<string, string> = {}
  if (response) {
    const rawHeaders = response.headers()
    for (const [key, value] of Object.entries(rawHeaders)) {
      responseHeaders[key] = value
    }

    const contentType = response.headers()['content-type']?.toLowerCase() ?? ''
    const httpStatus = response.status()
    const statusOk = response.ok() || httpStatus === 304 || (httpStatus >= 200 && httpStatus < 400)

    const hasHtmlDocument = await page.evaluate(() => {
      return document.documentElement?.tagName === 'HTML'
    })
    const contentTypeOk =
      contentType.includes('text/html') || contentType.includes('application/xhtml+xml')

    if (!statusOk || (!contentTypeOk && !hasHtmlDocument)) {
      const { PageCaptureError } = await import('./page-capture')
      throw new PageCaptureError('Destination did not return a successful HTML document', {
        code:
          httpStatus === 403
            ? 'HTTP_FORBIDDEN'
            : httpStatus === 429
              ? 'HTTP_RATE_LIMIT'
              : contentTypeOk || hasHtmlDocument
                ? 'HTTP_ERROR'
                : 'NON_HTML_RESPONSE',
        httpStatus,
        contentType: contentType || null,
        finalUrl: page.url(),
      })
    }
  }

  if (options.settle !== false) {
    await settleAuditPage(page)
  }

  return { page, consoleErrors, responseHeaders }
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
    const context = session.page.context()
    await session.page.close().catch(() => {})
    await context.close().catch(() => {})
  }
}
