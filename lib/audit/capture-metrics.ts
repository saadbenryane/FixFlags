import type { Page } from 'puppeteer'

export interface CaptureMetrics {
  mobilePrimaryCtaTopPx: number | null
  mobilePrimaryCtaText: string | null
  mobileViewportHeight: number
  /** True when skeleton/spinner/aria-busy is still visible after load. */
  stuckLoadingIndicator: boolean
  stuckLoadingLabel: string | null
  uniqueFontFamilies: number
  fontFamilySample: string[]
  buttonBorderRadii: number[]
  /** True when CSS animations still run under prefers-reduced-motion: reduce. */
  motionIgnoresReducedPreference: boolean
  motionSampleLabel: string | null
}

/** Measure mobile layout, CTA fold position, loading state, design tokens, and motion a11y. */
export async function measureMobileLayout(page: Page): Promise<CaptureMetrics> {
  const motion = await measureMotionA11y(page)

  const base = await page.evaluate(() => {
    function scoreCtaInPage(href: string, text: string, tag: string): number {
      const combined = `${href} ${text}`.toLowerCase()
      if (/\b(login|log in|sign in|signin)\b/i.test(combined)) return 15
      if (/pricing|plans|price/.test(combined)) return 100
      if (/book a call|book demo|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo/i.test(combined)) {
        return 95
      }
      if (/signup|sign-up|register|try|demo|contact|book/.test(combined)) return 70
      if (
        tag === 'button' &&
        /get started|sign up|signup|start|try|demo|contact|register|join/i.test(text)
      ) {
        return 85
      }
      return 0
    }

    function detectStuckLoading(): { stuckLoadingIndicator: boolean; stuckLoadingLabel: string | null } {
      const loadingSelector =
        '[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'
      const candidates = Array.from(document.querySelectorAll(loadingSelector))
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

    function sampleDesignConsistency(): {
      uniqueFontFamilies: number
      fontFamilySample: string[]
      buttonBorderRadii: number[]
    } {
      const fontSet = new Set<string>()
      const roots = document.querySelectorAll(
        'main h1, main h2, main h3, main p, main a, main button, body'
      )
      for (const el of roots) {
        const ff = window.getComputedStyle(el).fontFamily
        if (!ff) continue
        fontSet.add(ff.split(',')[0]?.trim().replace(/['"]/g, '') ?? ff)
      }

      const radii = new Set<number>()
      for (const btn of document.querySelectorAll('main a[href], main button, [role="button"]')) {
        if (btn.closest('nav, header, [role="navigation"]')) continue
        const text = (btn.textContent ?? '').trim()
        if (!text || text.length > 48) continue
        const br = window.getComputedStyle(btn).borderRadius
        const px = parseFloat(br)
        if (!Number.isNaN(px) && px >= 0) radii.add(Math.round(px))
      }

      return {
        uniqueFontFamilies: fontSet.size,
        fontFamilySample: [...fontSet].slice(0, 6),
        buttonBorderRadii: [...radii].sort((a, b) => a - b),
      }
    }

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

      const score = scoreCtaInPage(href, text, tag)
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
      ...sampleDesignConsistency(),
    }
  })

  return {
    ...base,
    motionIgnoresReducedPreference: motion.motionIgnoresReducedPreference,
    motionSampleLabel: motion.motionSampleLabel,
  }
}

/** Count long/looping CSS animations visible on page (runs in browser context). */
async function countSignificantMotionInPage(
  page: Page
): Promise<{ count: number; sample: string | null }> {
  return page.evaluate(() => {
    const parseDurationMs = (raw: string) => {
      if (!raw || raw === '0s') return 0
      const parts = raw.split(',').map((p) => p.trim())
      return Math.max(
        ...parts.map((part) => {
          const ms = part.match(/^([\d.]+)ms$/)
          if (ms) return parseFloat(ms[1])
          const sec = part.match(/^([\d.]+)s$/)
          if (sec) return parseFloat(sec[1]) * 1000
          return 0
        })
      )
    }

    const roots = document.querySelectorAll('main, [class*="hero" i], body')
    let count = 0
    let sample: string | null = null

    for (const root of roots) {
      for (const el of root.querySelectorAll('*')) {
        const style = window.getComputedStyle(el)
        const animName = style.animationName
        if (!animName || animName === 'none') continue

        const durationMs = parseDurationMs(style.animationDuration)
        const iteration = style.animationIterationCount
        const isLongOrLooping = durationMs >= 500 || iteration === 'infinite'
        if (!isLongOrLooping) continue

        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue

        count++
        if (!sample) {
          sample =
            el.getAttribute('aria-label') ||
            el.className.toString().split(/\s+/).find((c) => /animate|motion|fade|slide/i.test(c)) ||
            el.tagName.toLowerCase()
        }
      }
    }

    return { count, sample }
  })
}

/** Compare motion before/after emulating prefers-reduced-motion: reduce. */
export async function measureMotionA11y(page: Page): Promise<{
  motionIgnoresReducedPreference: boolean
  motionSampleLabel: string | null
}> {
  const before = await countSignificantMotionInPage(page)
  if (before.count === 0) {
    return { motionIgnoresReducedPreference: false, motionSampleLabel: null }
  }

  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    const after = await countSignificantMotionInPage(page)
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

    const stillAnimating = after.count > 0 && after.count >= Math.ceil(before.count * 0.5)
    return {
      motionIgnoresReducedPreference: stillAnimating,
      motionSampleLabel: stillAnimating ? before.sample : null,
    }
  } catch {
    return { motionIgnoresReducedPreference: false, motionSampleLabel: null }
  }
}
