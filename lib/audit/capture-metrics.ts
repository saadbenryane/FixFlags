import type { Page } from 'playwright'
import { readLoadingUi, type LoadingObservation } from './browser/loading-ui'
import { observeViewport } from './browser/viewport-observation'
import type { CaptureObservationScope } from './browser/observation-scope'
import { measureCurrentMotion } from './browser/motion-observation'
import type { MotionObservation } from './checks/motion-evidence'
export { measureCurrentMotion as measureMotionA11y } from './browser/motion-observation'

export interface CaptureMetrics {
  mobilePrimaryCtaTopPx: number | null
  mobilePrimaryCtaText: string | null
  /** Distinct high-intent CTAs visible above the mobile fold (focus dilution). */
  competingPrimaryCtaCount: number
  competingPrimaryCtaLabels: string[]
  mobileViewportHeight: number
  /** Absolute document position of the primary CTA (scrollY + rect.top). */
  mobileScrollY: number
  /** Full document height at measurement time (used as a plausibility bound). */
  mobileDocumentHeight: number
  /** True when skeleton/spinner/aria-busy is still visible after load. */
  stuckLoadingIndicator: boolean
  stuckLoadingLabel: string | null
  uniqueFontFamilies: number
  fontFamilySample: string[]
  buttonBorderRadii: number[]
  /** True when CSS animations still run under prefers-reduced-motion: reduce. */
  motionIgnoresReducedPreference: boolean
  motionSampleLabel: string | null
  /** False when browser emulation or either motion observation failed. */
  motionComplete?: boolean
  motionObservation?: MotionObservation
  inputsBelow16px: Array<{ selector: string; fontSize: number }>
  loadExperience?: PageLoadExperience | null
  desktopLoadExperience?: PageLoadExperience | null
  loadingObservation?: LoadingObservation
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
  observation?: LoadingObservation
}
export async function measureMobileLayout(page: Page, scope?: CaptureObservationScope, restrictions: string[] = []): Promise<CaptureMetrics> {
  const motion = scope ? { motionIgnoresReducedPreference: false, motionSampleLabel: null, motionComplete: false } : await measureCurrentMotion(page)
  const loading = await readLoadingUi(page)
  const content = scope ? await observeViewport(page, { profile: scope.profile, includeActions: false, excludeLoading: true }) : null

  const base = await page.evaluate(() => {
    // tsx/esbuild dev runs (npm run worker, scripts/*) inject `__name(...)` wrapper calls into
    // compiled functions; that reference doesn't exist inside Playwright's isolated browser
    // context. No-op under tsc/webpack builds (prod, `next dev`), which never emit `__name`.
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
    function visibleInDocument(element: Element): boolean {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      if (window.getComputedStyle(element).visibility !== 'visible') return false
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = window.getComputedStyle(node)
        if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return false
      }
      return true
    }
    const fontSet = new Set<string>()
    for (const el of document.querySelectorAll(
      'main h1, main h2, main h3, main p, main a, main button, body'
    )) {
      if (!visibleInDocument(el)) continue
      const ff = window.getComputedStyle(el).fontFamily
      if (!ff) continue
      fontSet.add(ff.split(',')[0]?.trim().replace(/['"]/g, '') ?? ff)
    }

    const radii = new Set<number>()
    for (const btn of document.querySelectorAll('main a[href], main button, [role="button"]')) {
      if (!visibleInDocument(btn)) continue
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
      if (!visibleInDocument(el)) continue
      const style = window.getComputedStyle(el)
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
      if (!visibleInDocument(el)) return null
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
        /buy now|add to cart|purchase|\bcheckout\b|book (a call|demo)|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo|watch demo|get early access|claim (your|this|the|a spot)|reserve (my|your|a|the|your spot|a spot)|shop now|browse (our|the|all|plans|packages)|see (how|what|the|our|it|it in action)|view (plans|pricing|products|our|the|demo)|find (your|out)/i.test(
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
      return { score, top: Math.round(rect.top), text: text.slice(0, 80) || tag }
    }

    function shouldSkipNavHeader(el: Element): boolean {
      // Some responsive mega-menus are rendered outside a semantic <nav> and
      // laid out far down the document while closed. Their links are neither
      // visible page CTAs nor meaningful scroll-depth evidence.
      if (
        el.closest(
          'nav, [role="navigation"], footer, [role="contentinfo"], [class*="menu" i], [id*="menu" i]'
        )
      )
        return true
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

    // Top-document only: page.evaluate runs in the main frame, so cross-origin
    // iframe content (YouTube player buttons, etc.) is never collected here.
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
      if (!visibleInDocument(el)) continue
      if (rect.top < 0 || rect.top > foldLine) continue

      const form = el.closest('form')
      let submitBtnText = ''
      if (form) {
        const submitBtn = form.querySelector(
          'button[type="submit"], input[type="submit"], button:not([type])'
        )
        if (submitBtn && visibleInDocument(submitBtn)) {
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
        if (!visibleInDocument(el)) continue
        if (rect.top < 0 || rect.top > window.innerHeight * 2) continue

        const form = el.closest('form')
        let submitBtnText = ''
        if (form) {
          const submitBtn = form.querySelector(
            'button[type="submit"], input[type="submit"], button:not([type])'
          )
          if (submitBtn && visibleInDocument(submitBtn)) {
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
    // The candidate `top` is viewport-relative (used for above-the-fold
    // selection). The persisted metric must be the absolute document scroll
    // depth: a CTA below the fold is reported as its true position on the
    // page, independent of any scroll state at measurement time.
    const scrollY = window.scrollY || 0
    const documentHeight =
      document.documentElement.scrollHeight || document.body.scrollHeight || 0
    const absoluteBestTop =
      bestTop == null ? null : Math.max(0, Math.round(bestTop + scrollY))

    return {
      mobilePrimaryCtaTopPx: absoluteBestTop,
      mobilePrimaryCtaText: bestText,
      competingPrimaryCtaCount: competingLabels.length,
      competingPrimaryCtaLabels: competingLabels.slice(0, 6),
      mobileViewportHeight: window.innerHeight,
      mobileScrollY: Math.round(scrollY),
      mobileDocumentHeight: Math.round(documentHeight),
      uniqueFontFamilies: fontSet.size,
      fontFamilySample: [...fontSet].slice(0, 6),
      buttonBorderRadii: [...radii].sort((a, b) => a - b),
      inputsBelow16px,
    }
  })

  return {
    ...base,
    stuckLoadingIndicator: loading.loadingVisible,
    stuckLoadingLabel: loading.loadingLabel,
    ...(scope && content ? { loadingObservation: { version: 1 as const, device: 'mobile' as const,
      scope: { ...scope, finalUrl: content.pageUrl }, contentVisible: content.content === true,
      ready: loading.readyState === 'complete', restricted: restrictions.length > 0 } } : {}),
    motionIgnoresReducedPreference: motion.motionIgnoresReducedPreference,
    motionSampleLabel: motion.motionSampleLabel,
    motionComplete: motion.motionComplete,
  }
}
