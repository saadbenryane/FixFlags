import type { Page } from 'playwright'
import { MOBILE_VIEWPORT } from '@/lib/audit/viewports'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { detectOverlayAtPoint, type OverlayBlockerInfo } from '@/lib/audit/browser/overlay-probe'
import { probeFormValidation, type FormProbeResult } from './form-probes'
import type { FormEvidence } from './form-evidence'
import { probeGhostSections } from './scroll-probes'
import type { OverlayInteractionRecorder } from '../browser/overlay-interaction'
import type { OverlayObservation } from '../checks/overlay-evidence'
import { collectMobileNavigation } from './mobile-navigation'
import type { MobileNavigationObservation } from './mobile-navigation-evidence'

export type ProbeOutcome = 'ok' | 'broken' | 'skipped'

export interface MultiStepProbeResult {
  pricingNavOverlayObservation?: OverlayObservation
  formOverlayObservation?: OverlayObservation
  pricingNav: ProbeOutcome
  pricingNavLabel?: string
  pricingNavHref?: string
  pricingNavOverlay?: OverlayBlockerInfo | null
  mobileMenu: ProbeOutcome
  mobileNavigationObservations?: MobileNavigationObservation[]
  formValidation: ProbeOutcome
  formLabel?: string
  formFeedbackMs?: number | null
  formOverlay?: OverlayBlockerInfo | null
  formEvidence?: FormEvidence
  ghostSections?: number
  ghostSampleSelector?: string
  ghostSampleText?: string
}

import { sleep } from '@/lib/utils/sleep'

/** Reset desktop capture viewport after mobile probes. */
export async function restoreDesktopCaptureViewport(page: Page): Promise<void> {
  if (page.isClosed()) return
  try {
    await page.setViewportSize({
      width: DESKTOP_CAPTURE_PROFILE.width,
      height: DESKTOP_CAPTURE_PROFILE.height,
    })
    await page.evaluate(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      window.scrollTo(0, 0)
    })
    await sleep(200)
  } catch {
    // page or browser may have closed during probes; nothing to restore
  }
}

interface PricingProbeResult {
  pricingNavOverlayObservation?: OverlayObservation
  pricingNav: ProbeOutcome
  pricingNavLabel?: string
  pricingNavHref?: string
  pricingNavOverlay?: OverlayBlockerInfo | null
}

/** Click the header Pricing/Plans nav link and verify it reaches a real section or page. */
export async function probePricingNav(page: Page, overlayRecorder?: OverlayInteractionRecorder): Promise<PricingProbeResult> {
  const originalSelector = overlayRecorder?.expectedSelector('nav', 'pricing_navigation')
  const link = await page.evaluate(originalSelector => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const anchors = Array.from(
      document.querySelectorAll('header nav a[href], nav[aria-label] a[href], header a[href]')
    )
    if (originalSelector) {
      const element = document.querySelector(originalSelector)
      return element instanceof HTMLAnchorElement ? { index: -1, text: element.textContent?.trim() ?? '', href: element.getAttribute('href') ?? '' } : null
    }
    for (let i = 0; i < anchors.length; i++) {
      const el = anchors[i] as HTMLAnchorElement
      const text = (el.textContent ?? '').trim()
      const href = el.getAttribute('href') ?? ''
      if (!/\bpricing\b|\bplans?\b/i.test(`${text} ${href}`)) continue
      el.setAttribute('data-fixflags-pricing-nav', String(i))
      return { index: i, text, href }
    }
    return null
  }, originalSelector)

  if (!link) {
    return { pricingNav: 'skipped' as const }
  }

  const selector = originalSelector ?? `[data-fixflags-pricing-nav="${link.index}"]`
  const inspected = await overlayRecorder?.inspect(selector, 'nav', 'pricing_navigation')
  if (inspected && !inspected.matchesExpected) return { pricingNav: 'skipped', pricingNavLabel: link.text, pricingNavHref: link.href }
  if (inspected?.observation?.controls.some(control => control.disposition === 'failed'))
    return { pricingNav: 'broken', pricingNavLabel: link.text, pricingNavHref: link.href, pricingNavOverlay: inspected.blocker, pricingNavOverlayObservation: inspected.observation }
  if (overlayRecorder && !overlayRecorder.activationRequired('pricing_navigation')) return { pricingNav: 'skipped', pricingNavLabel: link.text, pricingNavHref: link.href }

  if (link.href.startsWith('#')) {
    const targetExists = await page.evaluate(
      (hash) => {
        ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
        return !!document.querySelector(hash)
      },
      link.href
    )
    if (!targetExists) {
      return {
        pricingNav: 'broken' as const,
        pricingNavLabel: link.text,
        pricingNavHref: link.href,
      }
    }

    try {
      await page.click(selector)
      overlayRecorder?.activated(inspected)
      await sleep(400)
      const inView = await page.evaluate((hash) => {
        ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
        const el = document.querySelector(hash)
        if (!el) return false
        const rect = el.getBoundingClientRect()
        return rect.top < window.innerHeight && rect.bottom > 0
      }, link.href)
      return {
        pricingNav: inView ? ('ok' as const) : ('broken' as const),
        pricingNavLabel: link.text,
        pricingNavHref: link.href,
      }
    } catch {
      const inspected = await overlayRecorder?.inspect(selector, 'nav', 'pricing_navigation_after')
      const overlay = await detectOverlayAtPoint(page, selector)
      return {
        pricingNav: 'broken' as const,
        pricingNavLabel: link.text,
        pricingNavHref: link.href,
        pricingNavOverlay: overlay,
        pricingNavOverlayObservation: inspected?.observation,
      }
    }
  }

  try {
    const navPromise = page
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8_000 })
      .catch(() => null)
    await page.click(selector)
    overlayRecorder?.activated(inspected)
    const response = await navPromise
    const status = response?.status()
    const finalUrl = page.url()
    const reachedPricing =
      /pricing|plans?/i.test(finalUrl) && (!status || status < 400)
    return {
      pricingNav: reachedPricing ? ('ok' as const) : ('broken' as const),
      pricingNavLabel: link.text,
      pricingNavHref: link.href,
    }
  } catch {
    const inspected = await overlayRecorder?.inspect(selector, 'nav', 'pricing_navigation_after')
    const overlay = await detectOverlayAtPoint(page, selector)
    return {
      pricingNav: 'broken' as const,
      pricingNavLabel: link.text,
      pricingNavHref: link.href,
      pricingNavOverlay: overlay,
      pricingNavOverlayObservation: inspected?.observation,
    }
  }
}

/** Compatibility adapter for the stage pipeline. Progressive runs use an independent mobile task. */
export async function probeMobileMenu(page: Page) {
  if (page.isClosed()) return { mobileMenu: 'skipped' as const }
  try {
    await page.setViewportSize({ width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height })
    await page.evaluate(() => window.scrollTo(0, 0))
    const observed = await collectMobileNavigation(page, Date.now() + 8000)
    return { mobileMenu: observed.observations.some(item => item.complete && (!item.opened || !item.links.length || item.links.some(link => !link.reachable)))
      ? 'broken' as const : observed.complete && observed.applicable ? 'ok' as const : 'skipped' as const,
      mobileNavigationObservations: observed.observations }
  } finally { await restoreDesktopCaptureViewport(page) }
}

export async function runMultiStepProbes(page: Page, landingUrl: string, options: { includeFormValidation?: boolean; includeMobileNavigation?: boolean; overlayRecorder?: OverlayInteractionRecorder; overlayOnly?: boolean } = {}): Promise<MultiStepProbeResult> {
  const pricing = await probePricingNav(page, options.overlayRecorder)
  if (pricing.pricingNav !== 'skipped' && page.url() !== landingUrl) {
    await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
    await sleep(300)
  }

  const formOptions = { overlayRecorder: options.overlayRecorder, overlayOnly: options.overlayOnly, overlayPhase: 'flow_form_validation' }
  const form: FormProbeResult = options.includeFormValidation === false ? { formValidation: 'skipped' } : await probeFormValidation(page, formOptions)
  let formResult = form
  if (options.includeFormValidation !== false && form.formValidation === 'skipped') {
    const signupPath = await page.evaluate(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const cta = document.querySelector('a.demo-cta-primary')
      const href = cta?.getAttribute('href') ?? ''
      return href.includes('signup') ? href : null
    })
    if (signupPath) {
      const signupUrl = new URL(signupPath, landingUrl).href
      await page.goto(signupUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
      await sleep(300)
      formResult = await probeFormValidation(page, formOptions)
      await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
      await sleep(300)
    }
  }

  if (formResult.formValidation !== 'skipped' && page.url() !== landingUrl) {
    await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
    await sleep(300)
  }

  const ghost = await probeGhostSections(page)
  if (page.url() !== landingUrl) {
    await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
    await sleep(300)
  }

  const mobile = options.includeMobileNavigation === false ? { mobileMenu: 'skipped' as const, mobileNavigationObservations: undefined } : await probeMobileMenu(page)
  await restoreDesktopCaptureViewport(page)
  return {
    pricingNav: pricing.pricingNav,
    pricingNavLabel: pricing.pricingNavLabel,
    pricingNavHref: pricing.pricingNavHref,
    pricingNavOverlay: pricing.pricingNavOverlay,
    mobileMenu: mobile.mobileMenu,
    mobileNavigationObservations: mobile.mobileNavigationObservations,
    formValidation: formResult.formValidation,
    formLabel: formResult.formLabel,
    formFeedbackMs: formResult.feedbackMs,
    formOverlay: formResult.formOverlay,
    pricingNavOverlayObservation: pricing.pricingNavOverlayObservation,
    formOverlayObservation: formResult.formOverlayObservation,
    formEvidence: formResult.evidence,
    ghostSections: ghost.ghostCount,
    ghostSampleSelector: ghost.sampleSelector ?? undefined,
    ghostSampleText: ghost.sampleText ?? undefined,
  }
}
