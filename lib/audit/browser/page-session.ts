import type { Browser, ConsoleMessage, Page } from 'puppeteer'
import { assertPublicAuditUrl } from '../url'
import type { CaptureProfile } from './capture-profile'
import { applyCaptureProfile, validateNavigationResponse } from './page-capture'

export const PAGE_TIMEOUT_MS = 30_000

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i

export function isLocalhostAuditUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url)
}

export interface AuditPageSession {
  page: Page
  /** Shared console error buffer (mutated by page listeners). */
  consoleErrors: Array<{ type: string; text: string }>
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
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 })
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
  const page = await browser.newPage()
  await page.setCacheEnabled(false)

  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const protocol = new URL(request.url()).protocol
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') {
      void request.continue()
      return
    }
    if (options.allowLocalhost && isLocalhostAuditUrl(request.url())) {
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

  await applyCaptureProfile(page, options.profile)

  const response = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: PAGE_TIMEOUT_MS,
  })
  await validateNavigationResponse(response, page.url(), page)

  if (options.settle !== false) {
    await settleAuditPage(page)
  }

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
