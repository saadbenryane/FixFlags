import type { Page } from 'puppeteer'
import { MOBILE_VIEWPORT } from '@/lib/audit/viewports'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'

export type ProbeOutcome = 'ok' | 'broken' | 'skipped'

export interface MultiStepProbeResult {
  pricingNav: ProbeOutcome
  pricingNavLabel?: string
  pricingNavHref?: string
  mobileMenu: ProbeOutcome
}

function isPricingLink(text: string, href: string): boolean {
  const combined = `${text} ${href}`.toLowerCase()
  return /\bpricing\b|\bplans?\b/.test(combined)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface PricingProbeResult {
  pricingNav: ProbeOutcome
  pricingNavLabel?: string
  pricingNavHref?: string
}

/** Click the header Pricing/Plans nav link and verify it reaches a real section or page. */
export async function probePricingNav(page: Page): Promise<PricingProbeResult> {
  const link = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('header nav a[href], nav[aria-label] a[href], header a[href]')
    )
    for (let i = 0; i < anchors.length; i++) {
      const el = anchors[i] as HTMLAnchorElement
      const text = (el.textContent ?? '').trim()
      const href = el.getAttribute('href') ?? ''
      if (!/\bpricing\b|\bplans?\b/i.test(`${text} ${href}`)) continue
      el.setAttribute('data-fixflags-pricing-nav', String(i))
      return { index: i, text, href }
    }
    return null
  })

  if (!link) {
    return { pricingNav: 'skipped' as const }
  }

  const selector = `[data-fixflags-pricing-nav="${link.index}"]`

  if (link.href.startsWith('#')) {
    const targetExists = await page.evaluate(
      (hash) => !!document.querySelector(hash),
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
      await sleep(400)
      const inView = await page.evaluate((hash) => {
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
      return {
        pricingNav: 'broken' as const,
        pricingNavLabel: link.text,
        pricingNavHref: link.href,
      }
    }
  }

  try {
    const navPromise = page
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8_000 })
      .catch(() => null)
    await page.click(selector)
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
    return {
      pricingNav: 'broken' as const,
      pricingNavLabel: link.text,
      pricingNavHref: link.href,
    }
  }
}

function countVisibleNavLinks(): { visible: number; total: number } {
  const navLinks = Array.from(
    document.querySelectorAll('header nav a[href], nav[aria-label] a[href]')
  )
  let visible = 0
  for (const el of navLinks) {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    ) {
      visible++
    }
  }
  return { visible, total: navLinks.length }
}

interface MobileMenuProbeResult {
  mobileMenu: ProbeOutcome
}

/** On mobile viewport, nav links hidden behind a menu toggle must become reachable after open. */
export async function probeMobileMenu(page: Page): Promise<MobileMenuProbeResult> {
  const desktopViewport = page.viewport()
  await page.setViewport({
    width: MOBILE_VIEWPORT.width,
    height: MOBILE_VIEWPORT.height,
    deviceScaleFactor: MOBILE_VIEWPORT.deviceScaleFactor,
    isMobile: true,
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(200)

  const before = await page.evaluate(countVisibleNavLinks)
  if (before.visible > 0 || before.total === 0) {
    if (desktopViewport) {
      await page.setViewport(desktopViewport)
    } else {
      await page.setViewport({
        width: DESKTOP_CAPTURE_PROFILE.width,
        height: DESKTOP_CAPTURE_PROFILE.height,
      })
    }
    return { mobileMenu: 'skipped' as const }
  }

  const toggle = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('button, [role="button"], summary')
    )
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i]
      const label = (
        el.getAttribute('aria-label') ??
        el.getAttribute('title') ??
        el.textContent ??
        ''
      ).toLowerCase()
      const hasMenuCue =
        /menu|navigation|nav|hamburger|toggle/i.test(label) ||
        el.getAttribute('aria-expanded') !== null ||
        el.getAttribute('aria-controls') !== null
      if (!hasMenuCue) continue
      el.setAttribute('data-fixflags-menu-toggle', String(i))
      return { index: i, label: label.slice(0, 40) }
    }
    return null
  })

  if (!toggle) {
    if (desktopViewport) {
      await page.setViewport(desktopViewport)
    } else {
      await page.setViewport({
        width: DESKTOP_CAPTURE_PROFILE.width,
        height: DESKTOP_CAPTURE_PROFILE.height,
      })
    }
    return { mobileMenu: 'skipped' as const }
  }

  try {
    await page.click(`[data-fixflags-menu-toggle="${toggle.index}"]`)
    await sleep(400)
    const after = await page.evaluate(countVisibleNavLinks)
    const outcome: ProbeOutcome = after.visible > 0 ? 'ok' : 'broken'
    if (desktopViewport) {
      await page.setViewport(desktopViewport)
    } else {
      await page.setViewport({
        width: DESKTOP_CAPTURE_PROFILE.width,
        height: DESKTOP_CAPTURE_PROFILE.height,
      })
    }
    return { mobileMenu: outcome }
  } catch {
    if (desktopViewport) {
      await page.setViewport(desktopViewport)
    }
    return { mobileMenu: 'broken' as const }
  }
}

export async function runMultiStepProbes(page: Page, landingUrl: string): Promise<MultiStepProbeResult> {
  const pricing = await probePricingNav(page)
  if (pricing.pricingNav !== 'skipped' && page.url() !== landingUrl) {
    await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
    await sleep(300)
  }

  const mobile = await probeMobileMenu(page)
  return {
    pricingNav: pricing.pricingNav,
    pricingNavLabel: pricing.pricingNavLabel,
    pricingNavHref: pricing.pricingNavHref,
    mobileMenu: mobile.mobileMenu,
  }
}
