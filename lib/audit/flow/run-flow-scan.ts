import type { Browser, Page } from 'playwright'
import { uploadScreenshot } from '@/lib/storage/screenshots'
import { logger } from '@/lib/logger'
import { discoverFlowCtasWithFallback, flowCtaSelector, rankCtaCandidate } from './discover-cta'
import { resolveSameOrigin, isIntentionalExternalCta, isSameSiteOrigin } from './link-scoring'
import { urlsMeaningfullyChanged, isSamePageHashHref } from './flow-url'
import { anchorFromViewportRect } from './flow-evidence'
import type { EvidenceAnchor } from '@/lib/marketing/resolve-evidence-anchors'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { runMultiStepProbes, type MultiStepProbeResult } from './nav-probes'
import { measurePostClickLoading, type PostClickMetrics } from './post-click-probes'
import { fetchAndParseMetadata } from '@/lib/audit/metadata'
import { runDestinationUXProbes, type DestinationUXQuality } from './destination-ux-probes'
import {
  detectOverlayAtPoint,
  type OverlayBlockerInfo,
} from '@/lib/audit/browser/overlay-probe'

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

export interface FlowScanResult {
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
    hasPrivacyPolicy: boolean
    hasContactInfo: boolean
    isHttps: boolean
  }
  destinationUX?: DestinationUXQuality
  /** When click failed because another element covered the CTA. */
  overlayBlocker?: OverlayBlockerInfo | null
}

export interface RunFlowScanOptions {
  deadlineMs?: number
  /** Reuse desktop hero capture as step 0 instead of re-screenshotting. */
  landingStep?: FlowScanStep | null
  allowLocalhost?: boolean
  fetchHeaders?: Record<string, string>
}

async function captureFlowStep(
  page: Page,
  auditId: string,
  stepIndex: number,
  label: string
): Promise<FlowScanStep> {
  let screenshotUrl: string | null = null
  try {
    const buffer = (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
    screenshotUrl = await uploadScreenshot(auditId, 'desktop', buffer, `flow-${stepIndex}`)
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

async function fetchDestinationTrust(
  finalUrl: string,
  fetchHeaders?: Record<string, string>
): Promise<FlowScanResult['destinationTrust']> {
  try {
    const meta = await fetchAndParseMetadata(finalUrl, { headers: fetchHeaders })
    return {
      hasPrivacyPolicy: meta.hasPrivacyPolicy,
      hasContactInfo: meta.hasContactInfo,
      isHttps: finalUrl.startsWith('https://'),
    }
  } catch {
    return undefined
  }
}

async function runFlowScanWithinBudget(
  page: Page,
  auditId: string,
  pageUrl: string,
  options: RunFlowScanOptions = {}
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
  } else {
    steps.push(await captureFlowStep(page, auditId, 0, 'Landing'))
  }

  const landingUrl = page.url()
  const multiStep = await runMultiStepProbes(page, landingUrl)

  const candidates = await discoverFlowCtasWithFallback(page, pageUrl)
  const cta = rankCtaCandidate(candidates)
  if (!cta) {
    return { status: 'no_cta', steps, finalUrl: page.url(), multiStep }
  }

  const selector = flowCtaSelector(cta.flowIdx)
  const ctaMeta = {
    ctaText: cta.text,
    ctaHref: cta.href ?? null,
    ctaAnchor: await captureCtaAnchor(page, selector),
    multiStep,
  }

  const skipNavigationWait =
    cta.opensInNewTab || isIntentionalExternalCta(origin, cta.href ?? null)
  let clicked = false
  let clickResponseStatus: number | undefined

  try {
    await page.evaluate((sel) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const el = document.querySelector(sel)
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'center' })
      }
    }, selector)

    const clickTarget = await page.$(selector)
    if (!clickTarget) {
      const overlayBlocker = await detectOverlayAtPoint(page, selector)
      return {
        status: 'unclickable',
        steps,
        finalUrl: page.url(),
        overlayBlocker,
        ...ctaMeta,
      }
    }

    if (skipNavigationWait) {
      await clickTarget.click()
      clicked = true
      await new Promise((r) => setTimeout(r, 800))
    } else {
      const navigationPromise = page
        .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: FLOW_CLICK_TIMEOUT_MS })
        .catch(() => null)

      await Promise.race([
        (async () => {
          await clickTarget.click()
          clicked = true
          const response = await navigationPromise
          if (response) {
            clickResponseStatus = response.status()
          } else {
            await new Promise((r) => setTimeout(r, 1500))
          }
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('flow_click_timeout')), FLOW_CLICK_TIMEOUT_MS)
        ),
      ])
    }
  } catch (err) {
    logger.error('Flow CTA click failed', err)
    const overlayBlocker = !clicked ? await detectOverlayAtPoint(page, selector) : null
    return {
      status: clicked ? 'dead_end' : 'unclickable',
      steps,
      finalUrl: page.url(),
      overlayBlocker,
      ...ctaMeta,
    }
  }

  if (Date.now() - started > deadlineMs) {
    return { status: 'timeout', steps, finalUrl: page.url(), ...ctaMeta }
  }

  const postClickMetrics = await measurePostClickLoading(page)
  steps.push(await captureFlowStep(page, auditId, 1, 'After click'))

  const finalUrl = page.url()
  const httpStatus = clickResponseStatus

  const destinationTrust =
    urlsMeaningfullyChanged(landingUrl, finalUrl)
      ? await fetchDestinationTrust(finalUrl, options.fetchHeaders)
      : undefined

  const destinationUX = urlsMeaningfullyChanged(landingUrl, finalUrl)
    ? await runDestinationUXProbes(page, ctaMeta.ctaText, ctaMeta.ctaHref, options.fetchHeaders)
    : undefined

  if (httpStatus && httpStatus >= 400) {
      return {
        status: 'error_response',
        steps,
        finalUrl,
        httpStatus,
        destinationUX,
        ...ctaMeta,
      }
    }

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
    if (skipNavigationWait || isIntentionalExternalCta(origin, cta.href ?? null)) {
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

  return new Promise<FlowScanResult>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      const finalUrl = page.isClosed() ? pageUrl : page.url()
      resolve({ status: 'timeout', steps: [], finalUrl })
      void page.close().catch(() => {})
    }, deadlineMs)
    timer.unref?.()

    void runFlowScanWithinBudget(page, auditId, pageUrl, {
      ...options,
      deadlineMs: Math.min(deadlineMs, PRIMARY_CTA_BUDGET_MS),
    }).then(
      (result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        logger.error('Flow scan failed inside deadline', error)
        resolve({
          status: 'skipped',
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
  options: Pick<RunFlowScanOptions, 'allowLocalhost'> = {}
): Promise<FlowScanResult> {
  let page: Page | null = null
  try {
    const session = await createAuditPage(browser, pageUrl, {
      profile: DESKTOP_CAPTURE_PROFILE,
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
