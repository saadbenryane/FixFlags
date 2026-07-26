import type { Page } from 'playwright'

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
    // tsx/esbuild dev runs (npm run worker, scripts/*) inject `__name(...)` wrapper calls into
    // compiled functions; that reference doesn't exist inside Playwright's isolated browser
    // context. No-op under tsc/webpack builds (prod, `next dev`), which never emit `__name`.
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    let stuckLoadingIndicator = false
    let stuckLoadingLabel: string | null = null
    const loadingSelector =
      '[aria-busy="true"], [data-loading], [class*="skeleton" i], [class*="spinner" i], [class*="loading" i]'

    function isBlockingLoadingEl(el: Element): boolean {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0')
        return false
      const inMain = Boolean(el.closest('main, [role="main"], [class*="hero" i]'))
      const viewportArea = window.innerWidth * window.innerHeight
      const elArea = rect.width * rect.height
      const coversViewport = elArea >= viewportArea * 0.12
      const isLargeOverlay = elArea >= viewportArea * 0.35
      if (!inMain && !coversViewport && !isLargeOverlay) return false
      return true
    }

    for (const el of document.querySelectorAll(loadingSelector)) {
      if (!isBlockingLoadingEl(el)) continue
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
      const href = btn.tagName.toLowerCase() === 'a'
        ? (btn as HTMLAnchorElement).getAttribute('href') ?? ''
        : btn.closest('a')?.getAttribute('href') ?? ''
      const ctaSignal = `${href} ${text}`
      if (
        !/\b(book (?:a )?call|book demo|get started|start free|try free|sign up|register|contact|pricing|subscribe|request demo|schedule|shop now)\b/i.test(
          ctaSignal
        )
      ) {
        continue
      }
      const px = parseFloat(window.getComputedStyle(btn).borderRadius)
      if (!Number.isNaN(px) && px >= 0) radii.add(Math.round(px))
    }

    const inputsBelow16px: Array<{ selector: string; fontSize: number }> = []
    for (const input of document.querySelectorAll(
      'main input:not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), main textarea, main select'
    )) {
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

    const MOBILE_FOLD_RATIO = 0.85
    const foldLine = Math.round(window.innerHeight * MOBILE_FOLD_RATIO)

    type CtaCandidate = { score: number; top: number; text: string }

    function scoreCtaElement(el: Element): CtaCandidate | null {
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
      const mediaLabel = `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`.toLowerCase()
      const opensMedia =
        /view full size|open (?:the )?(?:image|photo)|zoom (?:the )?(?:image|photo)|enlarge (?:the )?(?:image|photo)/i.test(
          mediaLabel
        ) ||
        Boolean(el.closest('figure, [class*="gallery" i], [class*="lightbox" i]')?.querySelector('img'))
      if (opensMedia) return null

      let score = 0
      if (/\b(login|log in|sign in|signin)\b/i.test(combined)) score = 15
      else if (/\bview (all|details|plan details|more info)\b/i.test(text)) score = 55
      else if (
        /(?:^|\/)(?:pricing|plans?)(?:\/|$|[?#])/.test(href.toLowerCase()) ||
        /^(?:view |see |compare )?(?:our )?(?:pricing|plans?|prices)(?:\s|$)/i.test(text)
      )
        score = 100
      else if (
        /book (a call|demo)|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo|watch demo|get early access|claim (your|this|the|a spot)|reserve (my|your|a|the|your spot|a spot)|shop now|browse (our|the|all|plans|packages)|see (how|what|the|our|it|it in action)|view (plans|pricing|products|our|the|demo)|find (your|out)/i.test(
          combined
        )
      )
        score = 95
      else if (/signup|sign-up|register|try|demo|contact|book|learn more|explore|shop|browse|watch|find|claim|reserve/i.test(combined)) score = 70
      else if (
        tag === 'button' &&
        /\b(?:get started|sign up|signup|start(?: now| free| trial)?|try(?: free)?|demo|contact|register|join|learn more|explore|shop|browse|watch|find|claim|reserve|see how|get access)\b/i.test(
          text
        )
      )
        score = 85
      else if (
        tag === 'button' &&
        /search|audit|analyze|check.*site|run.*(scan|audit|check|test)|test.*site/i.test(text)
      )
        score = 85

      if (score === 0) return null

      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null

      return { score, top: Math.round(rect.top), text: text.slice(0, 80) || tag }
    }

    function shouldSkipNavHeader(el: Element): boolean {
      if (el.closest('nav, [role="navigation"]')) return true
      const header = el.closest('header')
      if (!header) return false
      const form = el.closest('form')
      if (form) {
        const input = form.querySelector('input[type="search"], input[type="url"], input[type="text"]')
        if (input) {
          const placeholder = (input.getAttribute('placeholder') || '').toLowerCase()
          if (
            /search|find|doctor|clinic|service|location|special|symptom|hospital|provider/i.test(
              placeholder
            )
          ) {
            return false
          }
        }
      }
      return true
    }

    const candidates: CtaCandidate[] = []
    const competingCtas = new Set<string>()

    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      if (shouldSkipNavHeader(el)) continue
      const candidate = scoreCtaElement(el)
      if (!candidate) continue
      candidates.push(candidate)

      if (candidate.score >= 85 && candidate.top >= 0 && candidate.top <= window.innerHeight) {
        competingCtas.add(candidate.text || 'cta')
      }
    }

    let selected: CtaCandidate | null = null

    // Pass 1: hero search form in the first screen (directory / marketplace landing pages).
    for (const el of document.querySelectorAll(
      'input[type="search"], input[type="url"], input[type="text"]'
    )) {
      const placeholder = (el.getAttribute('placeholder') || '').toLowerCase()
      if (
        !placeholder ||
        !/(search|find|doctor|clinic|service|location|special|symptom|hospital|provider|url|website|www\.|https?|enter.*(url|site|link|domain)|paste.*(url|link|domain))/i.test(
          placeholder
        )
      )
        continue

      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (rect.top < 0 || rect.top > foldLine) continue

      const form = el.closest('form')
      let submitBtnText = ''
      if (form) {
        const submitBtn = form.querySelector(
          'button[type="submit"], input[type="submit"], button:not([type])'
        )
        if (submitBtn) {
          submitBtnText =
            (submitBtn.textContent || submitBtn.getAttribute('aria-label') || '').trim()
        }
      }

      selected = {
        score: submitBtnText ? 92 : 90,
        top: Math.round(rect.top),
        text: submitBtnText || placeholder || 'Search input',
      }
      break
    }

    // Pass 2: topmost high-intent CTA above the fold.
    if (!selected) {
      for (const c of candidates) {
        if (c.score < 85 || c.top < 0 || c.top > foldLine) continue
        if (
          !selected ||
          c.top < selected.top ||
          (c.top === selected.top && c.score > selected.score)
        ) {
          selected = c
        }
      }
    }

    // Pass 3: global best score, tie-break topmost.
    if (!selected) {
      for (const c of candidates) {
        if (
          !selected ||
          c.score > selected.score ||
          (c.score === selected.score && c.top < selected.top)
        ) {
          selected = c
        }
      }
    }

    // Pass 4: deep-page search input fallback.
    if (!selected) {
      for (const el of document.querySelectorAll(
        'input[type="search"], input[type="url"], input[type="text"]'
      )) {
        const placeholder = (el.getAttribute('placeholder') || '').toLowerCase()
        if (
          !placeholder ||
          !/(search|url|website|www\.|https?|enter.*(url|site|link|domain)|paste.*(url|link|domain))/i.test(
            placeholder
          )
        )
          continue

        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (rect.top < 0 || rect.top > window.innerHeight * 2) continue

        const form = el.closest('form')
        let submitBtnText = ''
        if (form) {
          const submitBtn = form.querySelector(
            'button[type="submit"], input[type="submit"], button:not([type])'
          )
          if (submitBtn) {
            submitBtnText =
              (submitBtn.textContent || submitBtn.getAttribute('aria-label') || '').trim()
          }
        }

        selected = {
          score: submitBtnText ? 90 : 85,
          top: Math.round(rect.top),
          text: submitBtnText || placeholder || 'Search input',
        }
        break
      }
    }

    const bestTop = selected?.top ?? null
    const bestText = selected?.text ?? null
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
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
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
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const after = await countSignificantMotionInPage(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    const stillAnimating = after.count > 0 && after.count >= Math.ceil(before.count * 0.5)
    return {
      motionIgnoresReducedPreference: stillAnimating,
      motionSampleLabel: stillAnimating ? before.sample : null,
    }
  } catch {
    return { motionIgnoresReducedPreference: false, motionSampleLabel: null }
  }
}
