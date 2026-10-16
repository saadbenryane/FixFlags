import type { Page, Response, Frame, Request } from 'playwright'
import { auditPageObservation, captureObservationKey } from '../browser/observation-scope'
import { detectOverlayAtPoint, type OverlayBlockerInfo } from '../browser/overlay-probe'
import type { OverlayInteractionRecorder } from '../browser/overlay-interaction'
import type { OverlayObservation } from '../checks/overlay-evidence'
import { collectRenderedActionInventory, flowCtaSelector } from './discover-cta'
import { FLOW_IDX_ATTR } from './score-cta-candidates'
import { primaryControlContext, primaryPageContext } from './primary-action-evidence'
import { observeNavigationResponse } from './navigation-response'
import type { PricingNavigationEvidence } from './pricing-navigation-evidence'
import { sleep } from '@/lib/utils/sleep'

export interface PricingProbeResult {
  pricingNav: 'ok' | 'broken' | 'skipped'
  pricingNavLabel?: string
  pricingNavHref?: string
  pricingNavOverlay?: OverlayBlockerInfo | null
  pricingNavOverlayObservation?: OverlayObservation
  pricingEvidence?: PricingNavigationEvidence
  pricingComplete?: boolean
}

/** Observe the actual header action using the same painted-control inventory as
 * primary actions. Neither hidden mobile copies nor destination refetches apply. */
export async function probePricingNav(page: Page, overlayRecorder?: OverlayInteractionRecorder, expectedContexts?: string[]): Promise<PricingProbeResult> {
  const before = page.url(), source = auditPageObservation(page)
  const pageContext = primaryPageContext(source?.scope.pageUrl ?? before, before, page.viewportSize(), source?.scope)
  const native = Boolean(source && !source.restricted && captureObservationKey(source.scope) !== 'unknown')
  const originalSelector = overlayRecorder?.expectedSelector('nav', 'pricing_navigation')
  const inventory = await collectRenderedActionInventory(page, true)
  if (inventory.pageUrl !== before) return { pricingNav: 'skipped', pricingComplete: false }
  const candidates = inventory.controls.filter(control => control.labelComplete && control.tag === 'a' && control.inNavigation &&
    /\bpricing\b|\bplans?\b/i.test(`${control.text} ${control.href ?? ''}`)).map(control => ({ ...control,
      context: primaryControlContext({ pageContext, identity: control.identity, label: control.text, href: control.resolvedHref, controls: control.controls })
        .replace('flow:control:', 'flow:pricing:v1:') }))
  const originalIndex = originalSelector ? await page.locator(originalSelector).getAttribute(FLOW_IDX_ATTR).catch(() => null) : null
  const link = candidates.find(control => (!originalSelector || String(control.idx) === originalIndex) && (!expectedContexts || expectedContexts.includes(control.context)))
  if (!link) return { pricingNav: 'skipped', pricingComplete: inventory.complete, ...(expectedContexts?.[0] ? {
    pricingEvidence: { context: expectedContexts[0], complete: false, passed: false, reason: 'original-missing' as const } } : {}) }
  const base = { pricingNavLabel: link.text, pricingNavHref: link.href ?? undefined }
  const result = (reason: PricingNavigationEvidence['reason'], complete: boolean, passed = false): PricingProbeResult => ({ ...base,
    pricingNav: !complete ? 'skipped' : passed ? 'ok' : 'broken', pricingEvidence: { context: link.context, complete: native && complete, passed, reason } })
  const selector = originalSelector ?? flowCtaSelector(link.idx)
  const inspected = await overlayRecorder?.inspect(selector, 'nav', 'pricing_navigation')
  if (inspected && !inspected.matchesExpected) return result('unavailable', false)
  if (inspected?.observation?.controls.some(control => control.disposition === 'failed')) return { ...result('unavailable', false),
    pricingNav: 'broken', pricingNavOverlay: inspected.blocker, pricingNavOverlayObservation: inspected.observation }
  if (overlayRecorder && !overlayRecorder.activationRequired('pricing_navigation')) return result('unavailable', false)
  if (!link.enabled) return result('disabled', true)
  if (link.opensInNewTab) return result('unavailable', false)
  if (!link.resolvedHref || !/^https?:/.test(link.resolvedHref)) return result('unavailable', false)
  const target = new URL(link.resolvedHref), entry = new URL(before)
  const fragment = target.origin === entry.origin && target.pathname === entry.pathname && target.search === entry.search && target.hash.length > 1
  let response: Response | null = null, timer: ReturnType<typeof setTimeout> | undefined
  let requested = false, committed = false
  let finish: (() => void) | undefined
  const navigation = new Promise<void>(resolve => { finish = resolve })
  const onFrame = (frame: Frame) => { if (frame === page.mainFrame()) { committed = true; finish?.() } }
  const onResponse = (received: Response) => {
    if (received.request().isNavigationRequest() && received.frame() === page.mainFrame()) response = received
  }
  const onRequest = (request: Request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) requested = true }
  if (!fragment) { page.on('framenavigated', onFrame); page.on('response', onResponse); page.on('request', onRequest); timer = setTimeout(() => finish?.(), 8_000) }
  try {
    await page.click(selector, { timeout: 2_000, noWaitAfter: true })
    overlayRecorder?.activated(inspected)
    if (fragment) {
      await sleep(400)
      const reached = await page.evaluate(hash => {
        let element: Element | null = null
        try { const id = decodeURIComponent(hash.slice(1)); element = document.getElementById(id) ?? [...document.getElementsByName(id)].find(node => node.tagName === 'A') ?? null } catch { /* Malformed fragments remain unavailable. */ }
        const ready = document.readyState === 'complete' || ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.domContentLoadedEventEnd ?? 0) > 0
        if (!element) return { ready, visible: false }
        const rect = element.getBoundingClientRect()
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (style.display === 'none' || style.contentVisibility === 'hidden' || style.visibility === 'hidden' || Number(style.opacity) === 0) return { ready, visible: false }
        }
        return { ready, visible: rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0 }
      }, target.hash)
      const current = new URL(page.url())
      if (current.origin !== entry.origin || current.pathname !== entry.pathname || current.search !== entry.search) return result('unavailable', false)
      return result(reached.visible ? 'visible-section' : 'missing-section', reached.ready, reached.visible)
    }
    await navigation
    const received = response as Response | null
    // Reading the old document can wait behind a pending navigation. Its absence
    // of a committed response already makes this observation incomplete.
    if (requested && !committed) return result('unavailable', false)
    if (!received || received.status() < 400) await page.waitForLoadState('domcontentloaded', { timeout: 1500 }).catch(() => undefined)
    const observation = await observeNavigationResponse(page, received)
    if (['challenge', 'restricted'].includes(observation.state)) return result('unavailable', false)
    if (observation.state === 'error') return result('http-error', true)
    const ready = await page.evaluate(() => document.readyState === 'complete' ||
      ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.domContentLoadedEventEnd ?? 0) > 0)
    if (!ready || !observation.copy?.complete) return result('unavailable', false)
    if (!received && requested) return result('unavailable', false)
    if (page.url() === before && !received) return result('no-advance', true)
    const reached = new URL(observation.pageUrl)
    const declared = reached.origin === target.origin && reached.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '')
    const pricingPage = declared || /pricing|plans?/i.test(reached.pathname) || observation.copy.h1s.some(heading => /\bpricing\b|\bplans?\b/i.test(heading))
    const healthy = observation.state === 'healthy' || !received && page.url() !== before && observation.state === 'unknown'
    if (!healthy || !observation.copy.pageText.trim()) return result('unavailable', false)
    return result(pricingPage ? 'page-reached' : 'unexpected-destination', pricingPage, pricingPage)
  } catch {
    const after = await overlayRecorder?.inspect(selector, 'nav', 'pricing_navigation_after')
    const blocker = await detectOverlayAtPoint(page, selector).catch(() => null)
    return { ...result('unavailable', false), pricingNav: blocker ? 'broken' : 'skipped', pricingNavOverlay: blocker, pricingNavOverlayObservation: after?.observation }
  } finally {
    clearTimeout(timer)
    page.off('framenavigated', onFrame); page.off('response', onResponse); page.off('request', onRequest)
  }
}
