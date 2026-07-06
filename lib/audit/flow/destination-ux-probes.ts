import type { Page } from 'puppeteer'
import { fetchAndParseMetadata } from '@/lib/audit/metadata'

export interface DestinationUXQuality {
  hasClearHeadline: boolean
  hasPrimaryCTA: boolean
  ctaText: string | null
  ctaPromisesMatch: boolean
  headline: string | null
  pageType: string | null
  /** Total visible CTA elements on the destination page. */
  visibleCtaCount: number
  /** CTAs with actionable hrefs (not dead/placeholder/empty). */
  actionableCtaCount: number
  /** Resolved href of the primary CTA, if one exists. */
  primaryCtaHref: string | null
  trustSignals: {
    hasPrivacyPolicy: boolean
    hasContactInfo: boolean
    isHttps: boolean
  }
  mobileReadiness: {
    hasViewportMeta: boolean
    tapTargetsSmall: boolean
  }
  frictionSignals: {
    tooManyCTAs: boolean
    ctaCount: number
    hasDeadEnd: boolean
    formRequiredForValue: boolean
  }
  loadQuality: {
    timeToContentMs: number
    hadStuckLoading: boolean
    layoutShift: boolean
  }
}

const LOADING_SELECTOR =
  '[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function measureLoadQuality(page: Page, deadlineMs = 6000): Promise<DestinationUXQuality['loadQuality']> {
  const started = Date.now()
  let timeToContentMs = deadlineMs
  let hadStuckLoading = false
  const layoutShift = false

  while (Date.now() - started < deadlineMs) {
    const elapsed = Date.now() - started
    const snapshot = await page.evaluate((loadingSel) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const main = document.querySelector('main')
      const text = (main?.innerText ?? document.body.innerText).replace(/\s+/g, ' ').trim()
      const hasContent = text.length > 30

      let stuck = false
      for (const el of document.querySelectorAll(loadingSel)) {
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
        stuck = true
        break
      }

      return { hasContent, stuck }
    }, LOADING_SELECTOR)

    if (snapshot.hasContent && timeToContentMs === deadlineMs) {
      timeToContentMs = elapsed
    }

    if (snapshot.stuck && elapsed > 2000) {
      hadStuckLoading = true
    }

    if (snapshot.hasContent && !snapshot.stuck) {
      break
    }

    await sleep(100)
  }

  return { timeToContentMs, hadStuckLoading, layoutShift }
}

export async function runDestinationUXProbes(
  page: Page,
  originCtaText: string | null,
  originCtaHref: string | null
): Promise<DestinationUXQuality> {
  const url = page.url()

  const loadQuality = await measureLoadQuality(page)

  const pageData = await page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    const h1 = document.querySelector('h1')
    const headline = h1?.textContent?.trim() ?? null

    function isActionableHref(href: string | null, tag: string): boolean {
      if (tag === 'button' || tag === 'input') return true
      if (!href || href === '#' || href.startsWith('javascript:') || href === 'about:blank') return false
      try {
        const url = new URL(href)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return true
      }
    }

    const ctas = Array.from(document.querySelectorAll('a[href], button, [role="button"]'))
      .filter((el) => {
        if (el.closest('nav, header, [role="navigation"]')) return false
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      .map((el) => ({
        text: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).href ?? null,
        isPrimary: el.matches('.primary, [class*="cta"], [class*="btn-primary"], button:not([class*="ghost"])'),
        tag: el.tagName.toLowerCase(),
      }))

    const primaryCta = ctas.find((c) => c.isPrimary) ?? ctas[0] ?? null

    const actionableCtas = ctas.filter((c) => isActionableHref(c.href, c.tag))

    const viewportMeta = !!document.querySelector('meta[name="viewport"]')

    const smallTapTargets = Array.from(document.querySelectorAll('a[href], button, [role="button"]'))
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.height < 44 && rect.width < 44
      }).length > 0

    const formForValue = !!document.querySelector('form input[type="email"], form textarea, form input[required]')

    return {
      headline,
      ctaText: primaryCta?.text ?? null,
      ctaHref: primaryCta?.href ?? null,
      ctaCount: ctas.length,
      actionableCtaCount: actionableCtas.length,
      primaryCtaExists: primaryCta !== null,
      hasViewportMeta: viewportMeta,
      tapTargetsSmall: smallTapTargets,
      hasFormForValue: formForValue,
    }
  })

  const metadata = await fetchAndParseMetadata(url).catch(() => null)

  const ctaPromisesMatch = (() => {
    if (!originCtaText || !pageData.headline) return true
    const words = originCtaText.toLowerCase().split(' ')
    const headline = pageData.headline.toLowerCase()
    const wordMatch = words.some(w => w.length > 3 && headline.includes(w))
    if (wordMatch) return true
    if (originCtaHref) {
      const segments = originCtaHref.toLowerCase().split(/[/-]/)
      return segments.some(s => s.length > 3 && headline.includes(s))
    }
    return true
  })()

  return {
    hasClearHeadline: pageData.headline !== null && pageData.headline.length > 5,
    hasPrimaryCTA: pageData.primaryCtaExists,
    ctaText: pageData.ctaText,
    ctaPromisesMatch,
    headline: pageData.headline,
    pageType: null,
    visibleCtaCount: pageData.ctaCount,
    actionableCtaCount: pageData.actionableCtaCount,
    primaryCtaHref: pageData.ctaHref,
    trustSignals: {
      hasPrivacyPolicy: metadata?.hasPrivacyPolicy ?? false,
      hasContactInfo: metadata?.hasContactInfo ?? false,
      isHttps: url.startsWith('https://'),
    },
    mobileReadiness: {
      hasViewportMeta: pageData.hasViewportMeta,
      tapTargetsSmall: pageData.tapTargetsSmall,
    },
    frictionSignals: {
      tooManyCTAs: pageData.ctaCount > 3,
      ctaCount: pageData.ctaCount,
      hasDeadEnd: !pageData.primaryCtaExists && !pageData.headline,
      formRequiredForValue: pageData.hasFormForValue,
    },
    loadQuality,
  }
}
