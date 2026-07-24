import type { Browser, ConsoleMessage, Page } from 'playwright'
import { assertPublicAuditUrl } from '../url'
import type { ScanAccessConfig } from '../scan-access'
import { applyScanAccessCookies, scanAccessToPlaywrightContext } from '../scan-access'
import type { CaptureProfile } from './capture-profile'
import {
  applyJourneyRouteGuards,
  blockFormSubmits,
  type FormProbeResult,
  type JourneyRouteGuardOptions,
} from './journey-safety'
import {
  attachNetworkMonitor,
  type NetworkFailureRecord,
  type NetworkMonitor,
  type TechnologyResourceRecord,
} from './network-monitor'

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
  /** Same-origin / engagement network failures collected during the session. */
  networkFailures: NetworkFailureRecord[]
  /** Sanitized, bounded initial resource inventory for deterministic technology detection. */
  technologyResources: TechnologyResourceRecord[]
  technologyResourcesTruncated: () => boolean
  /** Optional form probe result when journeySafe engagement POST was observed. */
  formProbe: FormProbeResult | null
  disposeNetwork: () => void
}

export interface CreateAuditPageOptions {
  profile: CaptureProfile
  consoleErrors?: Array<{ type: string; text: string }>
  /** Demo fixture flow on localhost; skips public-URL guard for local dev URLs. */
  allowLocalhost?: boolean
  /** Set false when the caller needs the first post-DOMContentLoaded paint. */
  settle?: boolean
  /** Extra journey guards: block payments, downloads, and mutating form posts (with one engagement probe). */
  journeySafe?: boolean
  /** HTTP basic auth, cookies, or headers for preview/staging targets. */
  scanAccess?: ScanAccessConfig | null
}

export async function settleAuditPage(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 })
  } catch {
    // timeout is fine
  }
}

export async function createAuditPage(
  browser: Browser,
  targetUrl: string,
  options: CreateAuditPageOptions
): Promise<AuditPageSession> {
  const consoleErrors = options.consoleErrors ?? []
  const playwrightAccess = scanAccessToPlaywrightContext(options.scanAccess)

  const context = await browser.newContext({
    viewport: { width: options.profile.width, height: options.profile.height },
    userAgent: options.profile.userAgent,
    deviceScaleFactor: options.profile.deviceScaleFactor ?? 1,
    locale: 'en-US',
    bypassCSP: true,
    ...playwrightAccess,
  })

  await applyScanAccessCookies(context, targetUrl, options.scanAccess)

  const page = await context.newPage()

  let originHost = ''
  try {
    originHost = new URL(targetUrl).hostname
  } catch {
    originHost = ''
  }

  const formProbeState: JourneyRouteGuardOptions['formProbe'] = options.journeySafe
    ? { result: null, probed: false }
    : undefined

  const guardOptions: JourneyRouteGuardOptions | undefined = options.journeySafe
    ? { originHost, formProbe: formProbeState }
    : undefined

  await page.route('**', async (route) => {
    const requestUrl = route.request().url()
    const protocol = new URL(requestUrl).protocol
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') {
      await route.continue()
      return
    }
    if (options.allowLocalhost && isLocalhostAuditUrl(requestUrl)) {
      if (options.journeySafe) {
        await applyJourneyRouteGuards(route, () => route.continue(), guardOptions)
        return
      }
      await route.continue()
      return
    }
    try {
      await assertPublicAuditUrl(requestUrl)
      if (options.journeySafe) {
        await applyJourneyRouteGuards(route, () => route.continue(), guardOptions)
        return
      }
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

  const network: NetworkMonitor = attachNetworkMonitor(page, targetUrl)

  const response = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: PAGE_TIMEOUT_MS,
  })

  // Yield the event loop after the heavy page.goto() to let pending I/O
  // callbacks (e.g. status polling requests) run before we continue.
  await new Promise<void>((resolve) => setImmediate(resolve))

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
      network.dispose()
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

  if (options.journeySafe) {
    await blockFormSubmits(page)
  }

  return {
    page,
    consoleErrors,
    responseHeaders,
    networkFailures: network.failures,
    technologyResources: network.resources,
    technologyResourcesTruncated: network.resourcesTruncated,
    formProbe: formProbeState?.result ?? null,
    disposeNetwork: network.dispose,
  }
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
    session.disposeNetwork()
    const context = session.page.context()
    await session.page.close().catch(() => {})
    await context.close().catch(() => {})
  }
}
