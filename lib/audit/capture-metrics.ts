import type { Page } from 'puppeteer'

export interface CaptureMetrics {
  mobilePrimaryCtaTopPx: number | null
  mobilePrimaryCtaText: string | null
  mobileViewportHeight: number
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
    }
  })
}
