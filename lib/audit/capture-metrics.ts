import type { Page } from 'puppeteer'

export interface CaptureMetrics {
  mobilePrimaryCtaTopPx: number | null
  mobilePrimaryCtaText: string | null
  /** Distinct high-intent CTAs visible above the mobile fold (focus dilution). */
  competingPrimaryCtaCount: number
  competingPrimaryCtaLabels: string[]
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
  inputsBelow16px: Array<{ selector: string; fontSize: number }>
  loadExperience?: PageLoadExperience | null
}

export interface PageLoadExperience {
  device: 'desktop' | 'mobile'
  initialScreenshotUrl: string | null
  initialCaptureElapsedMs: number
  finalCaptureElapsedMs: number
  loadingVisibleAtInitial: boolean
  loadingVisibleAtFinal: boolean
  loadingClearedMs: number | null
  loadingLabel: string | null
  finalReadyState: string
  finalTitle: string | null
}
export async function measureMobileLayout(page: Page): Promise<CaptureMetrics> {
  const motion = await measureMotionA11y(page)

  const base = await page.evaluate(() => {
    let stuckLoadingIndicator = false
    let stuckLoadingLabel: string | null = null
    const loadingSelector =
      '[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'
    for (const el of document.querySelectorAll(loadingSelector)) {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
      stuckLoadingIndicator = true
      stuckLoadingLabel =
        el.getAttribute('aria-label') ||
        el.className.toString().split(/\s+/).find((c) => /skeleton|spinner|loading/i.test(c)) ||
        el.tagName.toLowerCase()
      break
    }

    const fontSet = new Set<string>()
    for (const el of document.querySelectorAll(
      'main h1, main h2, main h3, main p, main a, main button, body'
    )) {
      const ff = window.getComputedStyle(el).fontFamily
      if (!ff) continue
      fontSet.add(ff.split(',')[0]?.trim().replace(/['"]/g, '') ?? ff)
    }

    const radii = new Set<number>()
    for (const btn of document.querySelectorAll('main a[href], main button, [role="button"]')) {
      if (btn.closest('nav, header, [role="navigation"]')) continue
      const text = (btn.textContent ?? '').trim()
      if (!text || text.length > 48) continue
      const px = parseFloat(window.getComputedStyle(btn).borderRadius)
      if (!Number.isNaN(px) && px >= 0) radii.add(Math.round(px))
    }

    const inputsBelow16px: Array<{ selector: string; fontSize: number }> = []
    for (const input of document.querySelectorAll('main input, main textarea, main select')) {
      const el = input as HTMLElement
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const fontSize = parseFloat(style.fontSize)
      if (Number.isNaN(fontSize) || fontSize >= 16) continue
      const id = el.id
      const name = el.getAttribute('name')
      const selector = id ? `#${id}` : name ? `[name="${name}"]` : el.tagName.toLowerCase()
      inputsBelow16px.push({ selector, fontSize: Math.round(fontSize * 10) / 10 })
    }

    let bestScore = 0
    let bestTop: number | null = null
    let bestText: string | null = null
    const competingCtas = new Set<string>()

    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
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
      if (/\b(login|log in|sign in|signin)\b/i.test(combined)) score = 15
      else if (/pricing|plans|price/.test(combined)) score = 100
      else if (
        /book a call|book demo|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo/i.test(
          combined
        )
      )
        score = 95
      else if (/signup|sign-up|register|try|demo|contact|book/.test(combined)) score = 70
      else if (
        tag === 'button' &&
        /get started|sign up|signup|start|try|demo|contact|register|join/i.test(text)
      )
        score = 85

      if (score === 0) continue

      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue

      // High-intent CTA visible within the first mobile screen.
      if (score >= 85 && rect.top >= 0 && rect.top <= window.innerHeight) {
        const label = text.slice(0, 80) || tag
        competingCtas.add(label)
      }

      if (score >= bestScore) {
        bestScore = score
        bestTop = Math.round(rect.top)
        bestText = text.slice(0, 80)
      }
    }

    const competingLabels = [...competingCtas]

    return {
      mobilePrimaryCtaTopPx: bestTop,
      mobilePrimaryCtaText: bestText,
      competingPrimaryCtaCount: competingLabels.length,
      competingPrimaryCtaLabels: competingLabels.slice(0, 6),
      mobileViewportHeight: window.innerHeight,
      stuckLoadingIndicator,
      stuckLoadingLabel,
      uniqueFontFamilies: fontSet.size,
      fontFamilySample: [...fontSet].slice(0, 6),
      buttonBorderRadii: [...radii].sort((a, b) => a - b),
      inputsBelow16px,
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
    const roots = document.querySelectorAll('main, [class*="hero" i], body')
    let count = 0
    let sample: string | null = null

    for (const root of roots) {
      for (const el of root.querySelectorAll('*')) {
        const style = window.getComputedStyle(el)
        const animName = style.animationName
        if (!animName || animName === 'none') continue

        let durationMs = 0
        const raw = style.animationDuration
        if (raw && raw !== '0s') {
          for (const part of raw.split(',')) {
            const p = part.trim()
            const ms = p.match(/^([\d.]+)ms$/)
            const sec = p.match(/^([\d.]+)s$/)
            if (ms) durationMs = Math.max(durationMs, parseFloat(ms[1]))
            else if (sec) durationMs = Math.max(durationMs, parseFloat(sec[1]) * 1000)
          }
        }

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
