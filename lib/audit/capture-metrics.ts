import type { Page } from 'puppeteer'

export interface CaptureMetrics {
  mobilePrimaryCtaTopPx: number | null
  mobilePrimaryCtaText: string | null
  mobileViewportHeight: number
  /** True when skeleton/spinner/aria-busy is still visible after load. */
  stuckLoadingIndicator: boolean
  stuckLoadingLabel: string | null
}

/** Measure primary CTA position on the current mobile viewport (375×812). */
export async function measureMobileLayout(page: Page): Promise<CaptureMetrics> {
  return page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('a[href], button, [role="button"]'))
    let bestScore = 0
    let bestTop: number | null = null
    let bestText: string | null = null

    for (const el of elements) {
      if (el.closest('nav, header, [role="navigation"]')) continue

      const tag = el.tagName.toLowerCase()
      const href =
        tag === 'a'
          ? (el as HTMLAnchorElement).getAttribute('href') ?? ''
          : el.closest('a')?.getAttribute('href') ?? ''
      const text =
        (el.textContent ?? '').trim() ||
        el.getAttribute('aria-label')?.trim() ||
        el.getAttribute('title')?.trim() ||
        ''

      const combined = `${href} ${text}`.toLowerCase()
      let score = 0
      if (/signup|sign-up|register|login|get-started|get started|try free|start free/.test(combined)) {
        score = 100
      } else if (/pricing|plans|price/.test(combined)) score = 70
      else if (/start|try|demo|contact|book/.test(combined)) score = 50
      else if (
        tag === 'button' &&
        /get started|sign up|signup|start|try|demo|contact|register|join/i.test(text)
      ) {
        score = 85
      }
      if (score === 0) continue

      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue

      if (score >= bestScore) {
        bestScore = score
        bestTop = Math.round(rect.top)
        bestText = text.slice(0, 80)
      }
    }

    return {
      mobilePrimaryCtaTopPx: bestTop,
      mobilePrimaryCtaText: bestText,
      mobileViewportHeight: window.innerHeight,
      ...detectStuckLoading(),
    }
  })
}

const LOADING_SELECTOR =
  '[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'

function detectStuckLoading(): { stuckLoadingIndicator: boolean; stuckLoadingLabel: string | null } {
  const candidates = Array.from(document.querySelectorAll(LOADING_SELECTOR))
  for (const el of candidates) {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const style = window.getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
    const label =
      el.getAttribute('aria-label') ||
      el.className.toString().split(/\s+/).find((c) => /skeleton|spinner|loading/i.test(c)) ||
      el.tagName.toLowerCase()
    return { stuckLoadingIndicator: true, stuckLoadingLabel: label }
  }
  return { stuckLoadingIndicator: false, stuckLoadingLabel: null }
}
