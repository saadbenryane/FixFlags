import type { Browser, ConsoleMessage, Page, Response } from 'playwright'
import type { PublicDocument } from '../search/contracts'
import { SEARCH_DOCUMENT_LIMIT, missingDocument } from '../search/collect'
import { assertPublicAuditUrl } from '../url'
import { browserCapacity } from '../progressive/capacity'
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
import { isBotInterstitialPage, PageCaptureError } from './page-capture'

export const PAGE_TIMEOUT_MS = 30_000

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i

export function isLocalhostAuditUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url)
}

export interface AuditPageSession {
  page: Page
  /** Visitor timing begins after browser-capacity admission, immediately before navigation. */
  navigationStartedAt: number
  /** Shared console error buffer (mutated by page listeners). */
  consoleErrors: Array<{ type: string; text: string }>
  /** HTTP status from the initial navigation, if known. */
  httpStatus: number | null
  /** Response headers from the initial page navigation. */
  responseHeaders: Record<string, string>
  originalDocument?: PublicDocument
  /** Same-origin / engagement network failures collected during the session. */
  networkFailures: NetworkFailureRecord[]
  /** Sanitized, bounded initial resource inventory for deterministic technology detection. */
  technologyResources: TechnologyResourceRecord[]
  technologyResourcesTruncated: () => boolean
  /** Optional form probe result when journeySafe engagement POST was observed. */
  formProbe: FormProbeResult | null
  /** Scanner-imposed restrictions, not customer failures. */
  safetyRestrictions: string[]
  disposeNetwork: () => void
}

export interface CreateAuditPageOptions {
  resourcePriority?: 'availability'
  profile: CaptureProfile
  consoleErrors?: Array<{ type: string; text: string }>
  /** Demo fixture flow on localhost; skips public-URL guard for local dev URLs. */
  allowLocalhost?: boolean
  /** Set false when the caller needs the first post-DOMContentLoaded paint. */
  settle?: boolean
  /** Extra journey guards: block payments, downloads, and unauthorized mutations. */
  journeySafe?: boolean
  onSafetyRefusal?: JourneyRouteGuardOptions['onRefusal']
  /**
   * Buy-path walks: keep payment/download blocks, but allow same-origin cart
   * POSTs and do not preventDefault native form submit.
   */
  buyPath?: boolean
  /** Directory for Playwright recordVideo. Finalized when the context closes. */
  recordVideoDir?: string
  /** HTTP basic auth, cookies, or headers for preview/staging targets. */
  scanAccess?: ScanAccessConfig | null
  /** Absolute audit deadline. Navigation never receives more than the remaining budget. */
  deadline?: number
  collectSearchEvidence?: boolean
  configurePage?: (page: Page) => Promise<void>
}

async function originalNavigationDocument(response: Response | null, targetUrl: string, deadline?: number): Promise<PublicDocument> {
  if (!response) return missingDocument(targetUrl, 'navigation_response_unavailable')
  const bytes = Number(response.headers()['content-length'] ?? 0)
  if (bytes > SEARCH_DOCUMENT_LIMIT) return missingDocument(targetUrl, 'document_truncated')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const buffer = await Promise.race([
      response.body(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('response deadline')),
        Math.max(1, Math.min(3000, (deadline ?? Date.now() + 3000) - Date.now()))) }),
    ])
    if (buffer.byteLength > SEARCH_DOCUMENT_LIMIT) return missingDocument(targetUrl, 'document_truncated')
    const redirects: string[] = []
    let previous = response.request().redirectedFrom()
    while (previous && redirects.length < 5) { redirects.unshift(previous.url()); previous = previous.redirectedFrom() }
    return { url: targetUrl, finalUrl: response.url(), status: response.status(), headers: response.headers(),
      body: buffer.toString('utf8'), complete: true, reason: null, collectedAt: new Date().toISOString(), redirects }
  } catch { return missingDocument(targetUrl, 'original_html_unavailable') }
  finally { if (timer) clearTimeout(timer) }
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

  const release = await browserCapacity.acquire(options.deadline ? AbortSignal.timeout(Math.max(1, options.deadline - Date.now())) : undefined,
    options.resourcePriority === 'availability' ? 1 : 0)
  let context: Awaited<ReturnType<Browser['newContext']>>
  try { context = await browser.newContext({
    viewport: { width: options.profile.width, height: options.profile.height },
    userAgent: options.profile.userAgent,
    deviceScaleFactor: options.profile.deviceScaleFactor ?? 1,
    isMobile: options.profile.isMobile ?? false,
    locale: 'en-US',
    bypassCSP: false,
    recordVideo: options.recordVideoDir
      ? {
          dir: options.recordVideoDir,
          size: { width: options.profile.width, height: options.profile.height },
        }
      : undefined,
    ...playwrightAccess,
  }) } catch (error) { release(); throw error }
  const deadlineTimer = options.deadline ? setTimeout(() => {
    // Cancel the entire isolated context, including screenshots, injected scans,
    // nested navigation and locator waits, not only the initial page.goto.
    void context.close().catch(() => {})
  }, Math.max(1, options.deadline - Date.now())) : undefined
  deadlineTimer?.unref?.()
  context.once('close', () => { clearTimeout(deadlineTimer); release() })
  try {

  await applyScanAccessCookies(context, targetUrl, options.scanAccess)

  const page = await context.newPage()

  let originHost = ''
  try {
    originHost = new URL(targetUrl).hostname
  } catch {
    originHost = ''
  }

  const journeyGuards = options.journeySafe || options.buyPath
  const formProbeState: JourneyRouteGuardOptions['formProbe'] = journeyGuards
    ? { result: null, probed: false }
    : undefined

  const guardOptions: JourneyRouteGuardOptions | undefined = journeyGuards
    ? {
        originHost,
        origin: new URL(targetUrl).origin,
        onRefusal: options.onSafetyRefusal,
        formProbe: formProbeState,
        allowCartMutations: options.buyPath === true,
      }
    : undefined
  const safetyRestrictions: string[] = [], refusedUrls = new Set<string>()

  await page.route('**', async (route) => {
    const requestUrl = route.request().url()
    const routeGuards = guardOptions ? { ...guardOptions, onRefusal: (reason: 'protected_action_requires_fixture' | 'payment_or_download_blocked') => {
      refusedUrls.add(requestUrl)
      if (!safetyRestrictions.includes(reason) && safetyRestrictions.length < 16) safetyRestrictions.push(reason)
      options.onSafetyRefusal?.(reason)
    } } : undefined
    const protocol = new URL(requestUrl).protocol
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') {
      await route.continue()
      return
    }
    if (options.allowLocalhost && isLocalhostAuditUrl(requestUrl)) {
      if (journeyGuards) {
        await applyJourneyRouteGuards(route, () => route.continue(), routeGuards)
        return
      }
      await route.continue()
      return
    }
    try {
      await assertPublicAuditUrl(requestUrl)
      if (journeyGuards) {
        await applyJourneyRouteGuards(route, () => route.continue(), routeGuards)
        return
      }
      await route.continue()
    } catch {
      await route.abort('blockedbyclient')
    }
  })

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      if (refusedUrls.has(msg.location().url) && /(?:ERR_FAILED|blockedbyclient|ERR_BLOCKED_BY_CLIENT)/i.test(msg.text())) return
      consoleErrors.push({ type: msg.type(), text: msg.text() })
    }
  })

  const network: NetworkMonitor = attachNetworkMonitor(page, targetUrl)
  await options.configurePage?.(page)

  const navigationTimeout = options.deadline
    ? Math.max(1, Math.min(PAGE_TIMEOUT_MS, options.deadline - Date.now()))
    : PAGE_TIMEOUT_MS
  const navigationStartedAt = Date.now()
  const response = await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: navigationTimeout,
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

    if (isBotInterstitialPage({ cfMitigated: rawHeaders['cf-mitigated'] })) {
      network.dispose()
      throw new PageCaptureError('Destination presented a bot challenge instead of the Product', {
        code: 'HTTP_FORBIDDEN',
        httpStatus: httpStatus === 200 ? 403 : httpStatus,
        contentType: contentType || null,
        finalUrl: page.url(),
      })
    }
  }

  if (options.settle !== false) {
    await settleAuditPage(page)
  }

  const pageTitle = await page.title().catch(() => '')
  if (isBotInterstitialPage({ title: pageTitle })) {
    network.dispose()
    throw new PageCaptureError('Destination presented a bot challenge instead of the Product', {
      code: 'HTTP_FORBIDDEN',
      httpStatus: 403,
      contentType: 'text/html',
      finalUrl: page.url(),
    })
  }

  if (options.journeySafe && !options.buyPath) {
    await blockFormSubmits(page)
  }

  return {
    page,
    navigationStartedAt,
    consoleErrors,
    httpStatus: response?.status() ?? null,
    responseHeaders,
    originalDocument: options.collectSearchEvidence ? await originalNavigationDocument(response, targetUrl, options.deadline) : undefined,
    networkFailures: network.failures,
    technologyResources: network.resources,
    technologyResourcesTruncated: network.resourcesTruncated,
    // The interaction happens after navigation; expose the current probe,
    // rather than freezing its initial null value in the returned session.
    get formProbe() { return formProbeState?.result ?? null },
    safetyRestrictions,
    disposeNetwork: network.dispose,
  }
  } catch (error) {
    clearTimeout(deadlineTimer)
    await context.close().catch(async () => { await browser.close() })
    release()
    throw error
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
