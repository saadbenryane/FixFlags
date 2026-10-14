import type { Browser, ConsoleMessage, Page, Response } from 'playwright'
import type { PublicDocument } from '../search/contracts'
import { SEARCH_DOCUMENT_LIMIT, missingDocument } from '../search/collect'
import { assertPublicAuditUrl } from '../url'
import { browserCapacity } from '../progressive/capacity'
import type { ScanAccessConfig } from '../scan-access'
import { applyScanAccessCookies, scanAccessToFetchHeaders, scanAccessToPlaywrightContext } from '../scan-access'
import { installRequestBoundary, type BrowserRequestPolicy } from './request-boundary'
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
import { actionableConsoleErrors } from '../console-evidence'
import type { ConsoleMessage as RecordedConsoleMessage } from '../console-evidence'
import { createHmac, randomUUID } from 'node:crypto'
import { classifyTrackingEndpoint } from '../tracking/endpoints'
import { bindAuditPageObservation } from './observation-scope'

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
  consoleErrors: RecordedConsoleMessage[]
  resetConsoleForPage?: () => void
  consoleTruncated: () => boolean
  consoleTiming: () => { loaded: boolean; observedMs: number; minimumMs: number }
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
  tracking: NetworkMonitor['tracking']
  setTrackingPhase: NetworkMonitor['setTrackingPhase']
  /** Optional form probe result when journeySafe engagement POST was observed. */
  formProbe: FormProbeResult | null
  /** Scanner-imposed restrictions, not customer failures. */
  safetyRestrictions: string[]
  disposeNetwork: () => void
}

export interface CreateAuditPageOptions {
  resourcePriority?: 'availability'
  profile: CaptureProfile
  consoleErrors?: RecordedConsoleMessage[]
  consoleIdentityKey?: string
  /** Demo fixture flow on localhost; skips public-URL guard for local dev URLs. */
  allowLocalhost?: boolean
  /** Set false when the caller needs the first post-DOMContentLoaded paint. */
  settle?: boolean
  /** Account inspection needs the rendered error response to assess an already known identity. */
  retainErrorDocument?: boolean
  /** Extra journey guards: block payments, downloads, and unauthorized mutations. */
  journeySafe?: boolean
  /** Local UI activation may not bypass routing through workers or sockets. */
  readOnlyInteractions?: boolean
  /** Opaque session token for an isolated, outbound-blocked local form probe. */
  localFormValidationToken?: string
  onSafetyRefusal?: JourneyRouteGuardOptions['onRefusal']
  /**
   * Buy-path walks: keep payment/download blocks, but allow same-origin cart
   * POSTs and do not preventDefault native form submit.
   */
  buyPath?: boolean
  /** Directory for Playwright recordVideo. Finalized when the context closes. */
  recordVideoDir?: string
  /** HTTP basic auth, cookies, or headers for preview/staging targets. */
  refusedRequestUrls?: Set<string>
  scanAccess?: ScanAccessConfig | null
  /** Tenant-scoped, decrypted only inside an isolated account check. */
  storageState?: import('playwright').BrowserContextOptions['storageState']
  /** Absolute audit deadline. Navigation never receives more than the remaining budget. */
  deadline?: number
  collectSearchEvidence?: boolean
  configurePage?: (page: Page) => Promise<void>
  /** Privileged caller authority is checked once per physical request, including redirects. */
  requestPolicy?: BrowserRequestPolicy
  /** Start bounded visitor observations on the same clock as navigation. */
  onNavigationStart?: (page: Page, startedAt: number) => void
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
  const playwrightAccess = scanAccessToPlaywrightContext(options.scanAccess, targetUrl)

  const release = await browserCapacity.acquire(options.deadline ? AbortSignal.timeout(Math.max(1, options.deadline - Date.now())) : undefined,
    options.resourcePriority === 'availability' ? 1 : 0)
  let context: Awaited<ReturnType<Browser['newContext']>>
  try { context = await browser.newContext({
    viewport: { width: options.profile.width, height: options.profile.height },
    userAgent: options.profile.userAgent,
    deviceScaleFactor: options.profile.deviceScaleFactor ?? 1,
    isMobile: options.profile.isMobile ?? false,
    hasTouch: options.profile.hasTouch ?? false,
    locale: 'en-US',
    bypassCSP: false,
    serviceWorkers: 'block',
    recordVideo: options.recordVideoDir
      ? {
          dir: options.recordVideoDir,
          size: { width: options.profile.width, height: options.profile.height },
        }
      : undefined,
    ...playwrightAccess,
    ...(options.storageState ? { storageState: options.storageState } : {}),
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
  const safetyRestrictions: string[] = [], refusedUrls = options.refusedRequestUrls ?? new Set<string>()
  const network: NetworkMonitor = attachNetworkMonitor(page, targetUrl)
  if (options.localFormValidationToken) {
    const bindingName = '__fixflagsLocalRefusal_' + options.localFormValidationToken.replaceAll('-', '')
    await context.exposeBinding(bindingName, () => {
      if (!safetyRestrictions.includes('protected_action_requires_fixture')) safetyRestrictions.push('protected_action_requires_fixture')
      options.onSafetyRefusal?.('protected_action_requires_fixture')
    })
    await context.addInitScript(({ bindingName }) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
      const scope = globalThis as unknown as Record<string, unknown>
      for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'WebTransport', 'Worker', 'SharedWorker']) {
        if (typeof scope[name] !== 'function') continue
        Object.defineProperty(scope, name, { configurable: false, writable: false, value: function () {
          void (scope[bindingName] as () => Promise<void>)()
          throw new DOMException('This local check cannot open a live transport or worker.', 'NotAllowedError')
        } })
      }
      const clipboard = navigator.clipboard
      if (clipboard) for (const name of ['read', 'readText', 'write', 'writeText']) {
        if (typeof (clipboard as unknown as Record<string, unknown>)[name] !== 'function') continue
        Object.defineProperty(Object.getPrototypeOf(clipboard), name, { configurable: false, writable: false, value: function () {
          void (scope[bindingName] as () => Promise<void>)()
          return Promise.reject(new DOMException('This local check cannot access the clipboard.', 'NotAllowedError'))
        } })
      }
    }, { bindingName })
  }
  if (options.localFormValidationToken) page.on('dialog', async dialog => {
    if (!safetyRestrictions.includes('protected_action_requires_fixture')) safetyRestrictions.push('protected_action_requires_fixture')
    options.onSafetyRefusal?.('protected_action_requires_fixture')
    await dialog.dismiss().catch(() => undefined)
  })
  if (options.readOnlyInteractions || options.localFormValidationToken) await page.routeWebSocket('**', async socket => {
    if (!safetyRestrictions.includes('protected_action_requires_fixture')) safetyRestrictions.push('protected_action_requires_fixture')
    options.onSafetyRefusal?.('protected_action_requires_fixture')
    await socket.close().catch(() => undefined)
  })

  await options.configurePage?.(page)

  const guardRequest = async (route: import('playwright').Route) => {
    const requestUrl = route.request().url()
    const fallback = () => route.fallback()
    // Observe the browser's own attempts without replaying or manufacturing
    // events. These refusals do not make an unrelated customer action fail.
    if (classifyTrackingEndpoint(requestUrl, route.request().resourceType(), targetUrl)?.role === 'event' && !['HEAD', 'OPTIONS'].includes(route.request().method())) {
      network.suppressTracking(route.request())
      refusedUrls.add(requestUrl)
      await route.abort('blockedbyclient')
      return
    }
    const routeGuards = guardOptions ? { ...guardOptions, onRefusal: (reason: 'protected_action_requires_fixture' | 'payment_or_download_blocked') => {
      refusedUrls.add(requestUrl)
      if (!safetyRestrictions.includes(reason) && safetyRestrictions.length < 16) safetyRestrictions.push(reason)
      options.onSafetyRefusal?.(reason)
    } } : undefined
    const protocol = new URL(requestUrl).protocol
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'about:') {
      await route.fallback()
      return
    }
    if (options.allowLocalhost && isLocalhostAuditUrl(requestUrl)) {
      if (journeyGuards) {
        await applyJourneyRouteGuards(route, fallback, routeGuards)
        return
      }
      await fallback()
      return
    }
    try {
      await assertPublicAuditUrl(requestUrl)
      if (journeyGuards) {
        await applyJourneyRouteGuards(route, fallback, routeGuards)
        return
      }
      await fallback()
    } catch {
      await route.abort('blockedbyclient')
    }
  }
  if (options.localFormValidationToken) await context.route('**', async route => {
    // The original page already has this guard. Additional pages and worker
    // requests cannot bypass public-target and mutation checks during load.
    try { if (route.request().frame().page() === page) return await route.fallback() } catch { /* Requests without a frame still require the guard. */ }
    await guardRequest(route)
  })
  await page.route('**', guardRequest)
  const credentialOrigin = options.scanAccess?.origin ?? targetUrl
  const configuredHeaders = scanAccessToFetchHeaders(options.scanAccess ? { headers: options.scanAccess.headers, origin: options.scanAccess.origin } : null, credentialOrigin)
  await installRequestBoundary(page, credentialOrigin, configuredHeaders, guardRequest, options.requestPolicy
    ? async request => {
      // The shared guard suppresses recognized telemetry before it is sent.
      // It cannot consume a caller's one mutation or invalidate read-only inspection.
      if (classifyTrackingEndpoint(request.url, request.resourceType, targetUrl)?.role === 'event' && !['HEAD', 'OPTIONS'].includes(request.method)) return true
      const admitted = await options.requestPolicy!(request)
      if (!admitted) refusedUrls.add(request.url)
      return admitted
    } : undefined)

  let consoleTruncated = false
  let consoleLoadedAt: number | null = null, lastConsoleErrorAt: number | null = null
  page.on('load', () => { consoleLoadedAt = Date.now() })
  const consoleKeys = new Set<string>()
  const consoleIdentityKey = options.consoleIdentityKey ?? randomUUID()
  const recordConsoleError = (text: string) => {
    if (!actionableConsoleErrors([{ type: 'error', text }]).length) return
    lastConsoleErrorAt = Date.now()
    const bounded = text.slice(0, 2000)
    const identity = createHmac('sha256', consoleIdentityKey).update(text).digest('hex')
    if (text.length > bounded.length) consoleTruncated = true
    if (consoleKeys.has(identity)) return
    if (consoleKeys.size >= 500) { consoleTruncated = true; return }
    consoleKeys.add(identity)
    consoleErrors.push({ type: 'error', text: bounded, identity })
  }
  page.on('pageerror', (error: Error) => recordConsoleError(error.message))
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      if (refusedUrls.has(msg.location().url) && /(?:ERR_FAILED|blockedbyclient|ERR_BLOCKED_BY_CLIENT)/i.test(msg.text())) return
      recordConsoleError(msg.text())
    }
  })

  const navigationTimeout = options.deadline
    ? Math.max(1, Math.min(PAGE_TIMEOUT_MS, options.deadline - Date.now()))
    : PAGE_TIMEOUT_MS
  const navigationStartedAt = Date.now()
  bindAuditPageObservation(page, targetUrl, options.profile, options.scanAccess, safetyRestrictions, options.storageState)
  options.onNavigationStart?.(page, navigationStartedAt)
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

    if ((!statusOk && !(options.retainErrorDocument && httpStatus >= 400 && (contentTypeOk || hasHtmlDocument))) || (!contentTypeOk && !hasHtmlDocument)) {
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
        httpStatus,
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
      httpStatus: response?.status() ?? null,
      contentType: response?.headers()['content-type'] ?? null,
      finalUrl: page.url(),
    })
  }

  if (options.journeySafe && !options.buyPath) {
    await blockFormSubmits(page, options.localFormValidationToken)
  }

  return {
    page,
    navigationStartedAt,
    consoleErrors,
    resetConsoleForPage: () => { consoleErrors.splice(0); consoleKeys.clear(); consoleTruncated = false; consoleLoadedAt = null; lastConsoleErrorAt = null },
    consoleTruncated: () => consoleTruncated,
    consoleTiming: () => ({ loaded: consoleLoadedAt !== null, observedMs: consoleLoadedAt === null ? 0 : Math.min(90000, Math.max(0, Date.now() - consoleLoadedAt)),
      minimumMs: Math.min(90000, Math.max(2000, lastConsoleErrorAt !== null && consoleLoadedAt !== null ? lastConsoleErrorAt - consoleLoadedAt + 1000 : 0)) }),
    httpStatus: response?.status() ?? null,
    responseHeaders,
    originalDocument: options.collectSearchEvidence ? await originalNavigationDocument(response, targetUrl, options.deadline) : undefined,
    networkFailures: network.failures,
    technologyResources: network.resources,
    technologyResourcesTruncated: network.resourcesTruncated,
    tracking: network.tracking,
    setTrackingPhase: network.setTrackingPhase,
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
