import { type ScanAccessConfig } from '../scan-access'
import { randomUUID } from 'node:crypto'
import { auditPageObservation } from '../browser/observation-scope'
import type { Browser, Page, Response as BrowserResponse } from 'playwright'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { discoverFlowCtasWithFallback, flowCtaSelector, rankCtaCandidate } from './discover-cta'
import { createOverlayInteractionRecorder, type OverlayInteractionRecorder, type OverlayInspection } from '../browser/overlay-interaction'
import type { OverlayObservation, OverlayTarget } from '../checks/overlay-evidence'
import { resolveSameOrigin, isIntentionalExternalCta, isSameSiteOrigin } from './link-scoring'
import { urlsMeaningfullyChanged, isSamePageHashHref } from './flow-url'
import { anchorFromViewportRect } from './flow-evidence'
import type { EvidenceAnchor } from '@/lib/marketing/resolve-evidence-anchors'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import {
  DESKTOP_CAPTURE_PROFILE,
  type CaptureProfile,
} from '@/lib/audit/browser/capture-profile'
import { probePricingNav, runMultiStepProbes, type MultiStepProbeResult } from './nav-probes'
import { startPostClickObservation, type PostClickMetrics } from './post-click-probes'
import { runDestinationUXProbes, type DestinationUXQuality } from './destination-ux-probes'
import {
  detectObscuringElementAtPoint,
  detectOverlayAtPoint,
  dismissConsentChrome,
  dismissOpenDialogs,
  type OverlayBlockerInfo,
} from '@/lib/audit/browser/overlay-probe'
import { primaryPageContext, type PrimaryActionEvidence } from './primary-action-evidence'
import { isBotInterstitialPage } from '../browser/page-capture'
import { observeNavigationResponse } from './navigation-response'
import { actionPanelOpened, visibleActionPanels, type ActionPanelObservation } from './action-panels'

export const FLOW_SCAN_TIMEOUT_MS = 20_000
export const FLOW_CLICK_TIMEOUT_MS = 8_000
export const PRIMARY_CTA_BUDGET_MS = 12_000

export interface FlowScanStep {
  label: string
  screenshotUrl: string | null
  url: string
}

export type FlowScanStatus =
  | 'success'
  | 'no_cta'
  | 'unclickable'
  | 'error_response'
  | 'dead_end'
  | 'external_leave'
  | 'skipped'
  | 'timeout'

/**
 * Why a CTA click could not be performed. Lets checks distinguish a probe
 * artifact (element never existed / vanished mid-scan) from a genuine
 * user-facing unclickable state (covered by an overlay, disabled control).
 */
export type FlowClickFailure =
  | 'element_missing'
  | 'not_visible'
  | 'interaction_error'
  | 'timeout'

export interface FlowScanResult {
  overlayObservations?: OverlayObservation[]
  primaryOverlayObservation?: OverlayObservation
  actionEvidence?: PrimaryActionEvidence
  status: FlowScanStatus
  steps: FlowScanStep[]
  finalUrl: string
  ctaText?: string
  ctaHref?: string | null
  /** Normalized highlight region for the clicked CTA on the landing step. */
  ctaAnchor?: EvidenceAnchor | null
  httpStatus?: number
  multiStep?: MultiStepProbeResult
  postClickMetrics?: PostClickMetrics
  destinationTrust?: {
    hasPrivacyPolicy: boolean | null
    hasContactInfo: boolean | null
    isHttps: boolean
  }
  destinationUX?: DestinationUXQuality
  /** When click failed because another element covered the CTA. */
  overlayBlocker?: OverlayBlockerInfo | null
  /**
   * Any element covering the CTA center when the click failed, including plain
   * content overlap (e.g. an H2 over a button). Used to explain partial blocks.
   */
  obscuredBy?: OverlayBlockerInfo | null
  /** Classified reason the click probe failed (unclickable/dead_end paths). */
  clickFailure?: FlowClickFailure
  /** Raw error message from the failed click, truncated for evidence. */
  clickError?: string | null
}

export interface RunFlowScanOptions {
  overlayRecorder?: OverlayInteractionRecorder
  expectedOverlayTargets?: OverlayTarget[]
  overlayOnly?: boolean
  /** A repair checks the original recorded control rather than today's top CTA. */
  expectedActionContexts?: string[]
  expectedPricingContexts?: string[]
  mode?: 'primary' | 'destination' | 'pricing'
  captureSteps?: boolean
  /** Optional asset prefix; each captured walk retains a distinct identity. */
  pageKey?: string
  deadlineMs?: number
  /** Reuse desktop hero capture as step 0 instead of re-screenshotting. */
  landingStep?: FlowScanStep | null
  allowLocalhost?: boolean
  scanAccess?: ScanAccessConfig | null
  includeFormValidation?: boolean
  includeMobileNavigation?: boolean
  includePricingNavigation?: boolean
}

async function captureFlowStep(
  page: Page,
  auditId: string,
  stepIndex: number,
  label: string,
  pageKey: string,
  deadline?: number,
): Promise<FlowScanStep> {
  let screenshotUrl: string | null = null
  try {
    const buffer = (await page.screenshot({ type: 'png', fullPage: false,
      ...(deadline ? { timeout: Math.max(1, deadline - Date.now()) } : {}) })) as Buffer
    screenshotUrl = await uploadScreenshot(auditId, 'desktop', buffer, `${pageKey}-flow-${stepIndex}`, { deadline })
  } catch (err) {
    logger.error('Flow step screenshot failed', err)
  }
  return {
    label,
    screenshotUrl,
    url: page.url(),
  }
}

function isConversionPathUrl(origin: string, url: string): boolean {
  const resolved = resolveSameOrigin(origin, url)
  if (!resolved) return false
  return /pricing|plan|signup|sign-up|register|login|contact|demo|start/i.test(resolved)
}


/**
 * Resolve the click target with one waitForSelector retry so a transient DOM
 * race (SPA re-render between CTA discovery and click) does not get reported
 * as a genuine unclickable CTA. Classifies the failure so checks can decide
 * whether it is a probe artifact or a real user-facing issue.
 */
async function resolveClickTarget(
  page: Page,
  selector: string
): Promise<{
  target: import('playwright').ElementHandle | null
  failure: FlowClickFailure | null
}> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 2_500 })
  } catch {
    return { target: null, failure: 'element_missing' }
  }
  const handle = await page.$(selector)
  if (!handle) {
    return { target: null, failure: 'element_missing' }
  }
  const visible = await handle.isVisible().catch(() => false)
  if (!visible) {
    await handle.dispose().catch(() => {})
    return { target: null, failure: 'not_visible' }
  }
  return { target: handle, failure: null }
}

async function runFlowScanWithinBudget(
  page: Page,
  auditId: string,
  pageUrl: string,
  options: RunFlowScanOptions & { pageKey: string }
): Promise<FlowScanResult> {
  const deadlineMs = options.deadlineMs ?? FLOW_SCAN_TIMEOUT_MS
  const started = Date.now()
  const origin = new URL(pageUrl).origin
  const steps: FlowScanStep[] = []

  if (Date.now() - started > deadlineMs) {
    return { status: 'timeout', steps, finalUrl: page.url() }
  }

  if (options.landingStep) {
    steps.push(options.landingStep)
  } else if (options.captureSteps !== false) {
    steps.push(await captureFlowStep(page, auditId, 0, 'Landing', options.pageKey, started + deadlineMs))
  } else {
    steps.push({ label: 'Landing', screenshotUrl: null, url: page.url() })
  }

  const landingUrl = page.url()
  const multiStep: MultiStepProbeResult | undefined = options.mode === 'pricing'
    ? { ...await probePricingNav(page, options.overlayRecorder, options.expectedPricingContexts), mobileMenu: 'skipped', formValidation: 'skipped' }
    : options.mode ? undefined : await runMultiStepProbes(page, landingUrl, { includeFormValidation: options.includeFormValidation, includeMobileNavigation: options.includeMobileNavigation,
      includePricingNavigation: options.includePricingNavigation, overlayRecorder: options.overlayRecorder, overlayOnly: options.overlayOnly })
  if (options.mode === 'pricing' || page.url() !== landingUrl)
    return { status: 'skipped', steps, finalUrl: page.url(), multiStep }
  if (options.overlayOnly && !options.expectedOverlayTargets?.some(target => target.kind === 'cta' && target.context.split(':')[3].startsWith('primary_action')))
    return { status: 'skipped', steps, finalUrl: page.url(), multiStep }
  // Form/nav probes can leave auth or result dialogs open (dogfood: GradLoom
  // "Show My Career Path" opens a Saved Career Paths modal). Dismiss residue
  // before ranking/clicking the primary CTA so we do not self-inflict overlay FPs.
  await dismissConsentChrome(page)
  await dismissOpenDialogs(page)

  const discovered = await discoverFlowCtasWithFallback(page, pageUrl), candidates = discovered.candidates
  const actionEvidence: PrimaryActionEvidence = { version: 1,
    pageContext: primaryPageContext(pageUrl, page.url(), page.viewportSize(), auditPageObservation(page)?.scope), controlContext: null,
    candidateCount: candidates.length, candidateComplete: discovered.complete || candidates.length > 0, presenceVersion: 3,
    clicked: false, clickBlocked: false, navigation: 'unknown', response: 'unknown', responseExpected: false, httpStatus: null }
  const originalActions = options.expectedOverlayTargets?.filter(target => target.kind === 'cta' && target.context.split(':')[3].startsWith('primary_action'))
  const originalIndexes = originalActions?.length ? await page.evaluate(selectors => selectors.flatMap(selector => {
    const element = document.querySelector(selector)
    const index = element?.getAttribute('data-fixflags-flow-idx')
    return index == null ? [] : [Number(index)]
  }), originalActions.map(target => target.selector)) : undefined
  const cta = originalIndexes ? candidates.find(candidate => originalIndexes.includes(candidate.flowIdx)) ?? null
    : options.expectedActionContexts ? candidates.find(candidate => candidate.context && options.expectedActionContexts!.includes(candidate.context)) ?? null : rankCtaCandidate(candidates)
  if (!cta) {
    return { status: options.expectedActionContexts ? 'skipped' : 'no_cta', steps, finalUrl: page.url(), multiStep, actionEvidence }
  }

  const selector = flowCtaSelector(cta.flowIdx)
  const ctaMeta = {
    actionEvidence,
    ctaText: cta.text,
    ctaHref: cta.href ?? null,
    ctaAnchor: await captureCtaAnchor(page, selector),
    multiStep,
  }
  actionEvidence.controlContext = cta.context ?? null
  const panelWasVisible = cta.controls ? await controlledPanelVisible(page, cta.controls) : false

  // Buttons with on-page handlers (no navigable href), hash links, new tabs, and
  // intentional external CTAs must not race waitForNavigation - that race was
  // reporting flow_click_timeout as CRITICAL unclickable on working same-page CTAs
  // (dogfood: gradloom.app "See How It Works" button).
  const href = cta.href ?? null
  actionEvidence.responseExpected = Boolean(href && !isSamePageHashHref(href))
  const skipNavigationWait =
    cta.opensInNewTab ||
    isIntentionalExternalCta(origin, href) ||
    !href ||
    isSamePageHashHref(href)
  let clicked = false
  let clickResponseStatus: number | undefined
  let clickResponse: BrowserResponse | null = null
  let beforeInspection: OverlayInspection | undefined
  let panelsBefore: ActionPanelObservation[] | null = null
  let postClick: ReturnType<typeof startPostClickObservation> | undefined
  const recordDocumentResponse = (response: BrowserResponse) => {
    const request = response.request()
    if (!request.isNavigationRequest() || response.frame() !== page.mainFrame()) return
    clickResponse = response
    clickResponseStatus = response.status()
  }

  try {
    await page.evaluate((sel) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const el = document.querySelector(sel)
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'center' })
      }
    }, selector)

    const resolved = await resolveClickTarget(page, selector)
    const clickTarget = resolved.target
    if (!clickTarget) {
      const overlayBlocker = await detectOverlayAtPoint(page, selector)
      const obscuredBy =
        overlayBlocker ?? (await detectObscuringElementAtPoint(page, selector))
      actionEvidence.clickBlocked = Boolean(overlayBlocker || obscuredBy)
      return {
        status: 'unclickable',
        steps,
        finalUrl: page.url(),
        overlayBlocker,
        obscuredBy,
        clickFailure: resolved.failure ?? 'element_missing',
        ...ctaMeta,
      }
    }
    actionEvidence.clickBlocked = !(await clickTarget.isEnabled().catch(() => true))
    if (actionEvidence.clickBlocked) {
      // Disabled controls are a direct observation. Optional overlay inspection
      // excludes them and cannot replace this known failure with a skipped scan.
      await clickTarget.dispose().catch(() => {})
      return { status: 'unclickable', steps, finalUrl: page.url(), clickFailure: 'interaction_error',
        clickError: 'The primary control is disabled', ...ctaMeta }
    }
    const inspected = await options.overlayRecorder?.inspect(selector, 'cta', 'primary_action')
    beforeInspection = inspected
    if (inspected && !inspected.matchesExpected) return { status: 'skipped', steps, finalUrl: page.url(), ...ctaMeta }
    if (inspected?.observation?.controls.some(control => control.disposition === 'failed')) {
      actionEvidence.clickBlocked = true
      return { status: 'unclickable', steps, finalUrl: page.url(), overlayBlocker: inspected.blocker, primaryOverlayObservation: inspected.observation, clickFailure: 'interaction_error', ...ctaMeta }
    }
    if (options.overlayOnly && !options.overlayRecorder?.activationRequired('primary_action')) return { status: 'success', steps, finalUrl: page.url(), ...ctaMeta }
    panelsBefore = await visibleActionPanels(page)

    // Bound the Playwright click itself. For real navigable hrefs, arm
    // waitForNavigation before the click so we do not miss the response.
    const navigationPromise = skipNavigationWait
      ? null
      : page
          .waitForNavigation({ waitUntil: 'commit', timeout: FLOW_CLICK_TIMEOUT_MS })
          .catch(() => null)

    page.on('response', recordDocumentResponse)
    try {
      if (options.mode !== 'primary') postClick = startPostClickObservation(page, { expectNavigation: !skipNavigationWait, deadline: started + deadlineMs })
      await clickTarget.click({ timeout: FLOW_CLICK_TIMEOUT_MS, noWaitAfter: true })
      postClick?.afterClick()
      clicked = true
      actionEvidence.clicked = true
      actionEvidence.clickBlocked = false
      options.overlayRecorder?.activated(beforeInspection)
    } catch (err) {
      await clickTarget.dispose().catch(() => {})
      throw err
    }

    if (skipNavigationWait) {
      await new Promise((r) => setTimeout(r, 800))
    } else {
      const response = await navigationPromise
      clickResponse = response
      if (response) {
        clickResponseStatus = response.status()
      } else {
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
  } catch (err) {
    postClick?.cancel()
    logger.error('Flow CTA click failed', err)
    const overlayBlocker = !clicked ? await detectOverlayAtPoint(page, selector) : null
    const inspected = !clicked ? await options.overlayRecorder?.inspect(selector, 'cta', 'primary_action_after') : undefined
    const obscuredBy =
      !clicked
        ? overlayBlocker ?? (await detectObscuringElementAtPoint(page, selector))
        : null
    actionEvidence.clickBlocked ||= Boolean(overlayBlocker || obscuredBy)
    const clickError =
      err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    return {
      status: clicked ? 'dead_end' : 'unclickable',
      steps,
      finalUrl: page.url(),
      overlayBlocker,
      primaryOverlayObservation: inspected?.observation,
      obscuredBy,
      clickFailure: clicked ? undefined : 'interaction_error',
      clickError: clicked ? undefined : clickError || null,
      ...ctaMeta,
    }
  } finally {
    page.off('response', recordDocumentResponse)
  }

  if (Date.now() - started > deadlineMs) {
    postClick?.cancel()
    return { status: 'timeout', steps, finalUrl: page.url(), ...ctaMeta }
  }

  if (clickResponse) actionEvidence.responseExpected = true
  actionEvidence.httpStatus = clickResponseStatus ?? null
  const explicitChallenge = isBotInterstitialPage({ cfMitigated: clickResponse?.headers()['cf-mitigated'] })
  const postClickMetrics = postClick && (!clickResponseStatus || clickResponseStatus < 400) && !explicitChallenge
    ? await postClick.finish(Boolean(clickResponse)) : undefined
  if (options.mode === 'primary' && clickResponse) await page.waitForLoadState('domcontentloaded', {
    timeout: Math.max(1, Math.min(1500, started + deadlineMs - Date.now())),
  }).catch(() => undefined)
  actionEvidence.response = (await observeNavigationResponse(page, clickResponse)).state
  if (actionEvidence.response === 'error') {
    postClick?.cancel()
    actionEvidence.navigation = urlsMeaningfullyChanged(landingUrl, page.url()) ? 'changed' : !skipNavigationWait ? 'same' : 'unknown'
    // Optional destination work cannot replace the completed failed response.
    steps.push(options.captureSteps === false ? { label: 'After click', screenshotUrl: null, url: page.url() }
      : await captureFlowStep(page, auditId, 1, 'After click', options.pageKey, Math.min(started + deadlineMs, Date.now() + 1_000)))
    return { status: 'error_response', steps, finalUrl: page.url(), httpStatus: clickResponseStatus, ...ctaMeta }
  }
  const declaredPanelOpened = Boolean(cta.controls && !panelWasVisible && await controlledPanelVisible(page, cta.controls))
  const semanticPanelOpened = !urlsMeaningfullyChanged(landingUrl, page.url())
    ? actionPanelOpened(panelsBefore, await visibleActionPanels(page)) : false
  if (declaredPanelOpened || semanticPanelOpened) actionEvidence.samePageProgress = declaredPanelOpened ? 'declared-panel' : 'semantic-panel'
  actionEvidence.navigation = urlsMeaningfullyChanged(landingUrl, page.url()) || declaredPanelOpened || semanticPanelOpened ? 'changed'
    : !skipNavigationWait && semanticPanelOpened !== null ? 'same' : 'unknown'
  if (actionEvidence.response === 'restricted' || actionEvidence.response === 'challenge') {
    postClick?.cancel()
    return { status: 'skipped', steps, finalUrl: page.url(), httpStatus: clickResponseStatus, ...ctaMeta }
  }

  steps.push(options.captureSteps === false ? { label: 'After click', screenshotUrl: null, url: page.url() }
    : await captureFlowStep(page, auditId, 1, 'After click', options.pageKey, started + deadlineMs))

  const finalUrl = page.url()

  const destinationUX = options.mode !== 'primary' && urlsMeaningfullyChanged(landingUrl, finalUrl)
    ? await runDestinationUXProbes(page, ctaMeta.ctaText, ctaMeta.ctaHref, postClickMetrics)
    : undefined
  const destinationTrust = destinationUX?.trustSignals

  const leftOrigin = !isSameSiteOrigin(finalUrl, origin)
  if (leftOrigin && !isConversionPathUrl(origin, finalUrl)) {
    return {
      status: 'external_leave',
      steps,
      finalUrl,
      destinationUX,
      ...ctaMeta,
    }
  }

  if (!urlsMeaningfullyChanged(landingUrl, finalUrl)) {
    if (skipNavigationWait || declaredPanelOpened || semanticPanelOpened || isIntentionalExternalCta(origin, cta.href ?? null)) {
      return {
        status: 'success',
        steps,
        finalUrl,
        postClickMetrics,
        destinationTrust,
        destinationUX,
        ...ctaMeta,
      }
    }
    if (isSamePageHashHref(cta.href)) {
      const scrolledToAnchor = await page.evaluate((hash) => {
        ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
        const el = document.querySelector(hash)
        if (!el) return false
        const rect = el.getBoundingClientRect()
        return rect.top < window.innerHeight && rect.bottom > 0
      }, cta.href)
      if (scrolledToAnchor) {
        return {
          status: 'success',
          steps,
          finalUrl,
          postClickMetrics,
          destinationTrust,
          destinationUX,
          ...ctaMeta,
        }
      }
    }
    return {
      status: 'dead_end',
      steps,
      finalUrl,
      postClickMetrics,
      destinationTrust,
      destinationUX,
      ...ctaMeta,
    }
  }

  return {
    status: 'success',
    steps,
    finalUrl,
    postClickMetrics,
    destinationTrust,
    destinationUX,
    ...ctaMeta,
  }
}

async function controlledPanelVisible(page: Page, controls: string) {
  return page.evaluate((ids) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    return ids.trim().split(/\s+/).some(id => {
      const panel = document.getElementById(id)
      if (!panel) return false
      const rect = panel.getBoundingClientRect(), style = getComputedStyle(panel)
      let node: Element | null = panel
      while (node) {
        const ancestor = getComputedStyle(node)
        if (ancestor.display === 'none' || ancestor.visibility === 'hidden' || ancestor.opacity === '0') return false
        node = node.parentElement
      }
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0 && style.visibility !== 'hidden'
    })
  }, controls).catch(() => false)
}

/**
 * Enforce one wall-clock budget across every nested flow probe. Closing the
 * page cancels outstanding Playwright work so an optional probe cannot delay
 * the rest of the audit or leak browser work into a later stage.
 */
export async function runFlowScan(
  page: Page,
  auditId: string,
  pageUrl: string,
  options: RunFlowScanOptions = {}
): Promise<FlowScanResult> {
  const deadlineMs = Math.max(
    1,
    Math.min(options.deadlineMs ?? FLOW_SCAN_TIMEOUT_MS, FLOW_SCAN_TIMEOUT_MS)
  )
  const overlayRecorder = options.overlayRecorder ?? createOverlayInteractionRecorder(page, { deadline: Date.now() + deadlineMs, expectedTargets: options.expectedOverlayTargets })

  return new Promise<FlowScanResult>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      const finalUrl = page.isClosed() ? pageUrl : page.url()
      resolve({ status: 'timeout', steps: [], finalUrl, overlayObservations: overlayRecorder.observations() })
      void page.close().catch(() => {})
    }, deadlineMs)
    timer.unref?.()

    void runFlowScanWithinBudget(page, auditId, pageUrl, {
      ...options,
      pageKey: `${(options.pageKey ?? 'flow').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'flow'}-${randomUUID().replaceAll('-', '')}`,
      overlayRecorder,
      deadlineMs: Math.min(deadlineMs, PRIMARY_CTA_BUDGET_MS),
    }).then(
      (result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ ...result, overlayObservations: overlayRecorder.observations() })
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        logger.error('Flow scan failed inside deadline', error)
        resolve({
          status: 'skipped',
          overlayObservations: overlayRecorder.observations(),
          steps: [],
          finalUrl: page.isClosed() ? pageUrl : page.url(),
        })
      }
    )
  })
}

async function captureCtaAnchor(page: Page, selector: string): Promise<EvidenceAnchor | null> {
  const rect = await page.evaluate((sel) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }, selector)
  if (!rect) return null
  const viewport = page.viewportSize()
  if (!viewport) return null
  return anchorFromViewportRect(rect, viewport.width, viewport.height)
}

export async function runFlowScanStandalone(
  browser: Browser,
  auditId: string,
  pageUrl: string,
  options: Pick<RunFlowScanOptions, 'allowLocalhost'> & { profile?: CaptureProfile } = {}
): Promise<FlowScanResult> {
  let page: Page | null = null
  try {
    const session = await createAuditPage(browser, pageUrl, {
      profile: options.profile ?? DESKTOP_CAPTURE_PROFILE,
      allowLocalhost: options.allowLocalhost,
    })
    page = session.page
    return await runFlowScan(page, auditId, pageUrl)
  } catch (err) {
    logger.error('Standalone flow scan failed', err)
    return {
      status: 'skipped',
      steps: [],
      finalUrl: pageUrl,
    }
  } finally {
    if (page) {
      const context = page.context()
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }
  }
}
