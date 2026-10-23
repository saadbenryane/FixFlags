import type { Page } from 'playwright'
import { collectRenderedActionInventory, flowCtaSelector } from './flow/discover-cta'
import { createHash } from 'node:crypto'
import { readLoadingUi, type LoadingObservation } from './browser/loading-ui'
import { observeViewport } from './browser/viewport-observation'
import type { CaptureObservationScope } from './browser/observation-scope'
import { documentEvidenceWithheld } from './browser/document-evidence'
import { measureCurrentMotion } from './browser/motion-observation'
import type { MotionObservation } from './checks/motion-evidence'
export { measureCurrentMotion as measureMotionA11y } from './browser/motion-observation'

export type CtaStyleSample = { label: string; surface: 'filled' | 'outlined' | 'text'; fontSize: number; fontWeight: number; height: number }

export interface CaptureMetrics {
  mobilePrimaryCtaTopPx: number | null
  mobilePrimaryCtaText: string | null
  /** Distinct high-intent actions in the strongest comparable mobile style cohort. */
  competingPrimaryCtaCount: number
  competingPrimaryCtaLabels: string[]
  competingPrimaryCtaSamples?: CtaStyleSample[]
  competingPrimaryCtaComplete?: boolean
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
  buttonBorderRadiiComplete?: boolean
  /** True when CSS animations still run under prefers-reduced-motion: reduce. */
  motionIgnoresReducedPreference: boolean
  motionSampleLabel: string | null
  /** False when browser emulation or either motion observation failed. */
  motionComplete?: boolean
  motionObservation?: MotionObservation
  inputsBelow16px: Array<{ selector: string; fontSize: number }>
  inputFontSamples?: Array<{ selector: string; fontSize: number; context?: string }>
  inputFontsComplete?: boolean
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

  const inventory = await collectRenderedActionInventory(page, true, false)
  const actions = inventory.controls.map(({ idx, tag, role, inputType, text, href, labelComplete, inNavigation }) =>
    ({ tag, role, inputType, text, href, labelComplete, inNavigation, selector: flowCtaSelector(idx) }))
  const base = await page.evaluate(({ actions, complete, pageUrl }) => {
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

    const renderedActions = pageUrl === location.href ? actions.filter(action => action.labelComplete).flatMap(action => {
      const element = document.querySelector(action.selector)
      return element && visibleInDocument(element) ? [{ ...action, element }] : []
    }) : []
    const actionsComplete = complete && pageUrl === location.href && renderedActions.length === actions.length
    const radii = new Set<number>()
    for (const action of renderedActions) {
      const btn = action.element
      if (!(btn.closest('main') || action.role === 'button') || action.inNavigation) continue
      const text = action.text, href = action.href ?? ''
      if (!text || text.length > 48) continue
      if (!/\b(book (?:a )?call|book demo|get started|start free|try free|sign up|register|contact|pricing|subscribe|request demo|schedule|shop now)\b/i.test(`${href} ${text}`)) continue
      const px = parseFloat(window.getComputedStyle(btn).borderRadius)
      if (!Number.isNaN(px) && px >= 0) radii.add(Math.round(px))
    }

    const inputsBelow16px: Array<{ selector: string; fontSize: number }> = []
    const inputFontSamples: Array<{ selector: string; fontSize: number; identity: string; formScope: string | null }> = []
    let inputFontsComplete = true
    let sampledInputs = 0
    function inputSelector(element: Element) {
      const parts: string[] = []
      for (let node: Element | null = element; node && parts.length < 30; node = node.parentElement) {
        if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) {
          parts.unshift('#' + CSS.escape(node.id)); break
        }
        const siblings = node.parentElement ? [...node.parentElement.children].filter(sibling => sibling.tagName === node!.tagName) : [node]
        parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')')
        if (node.tagName === 'BODY') break
      }
      return parts.join(' > ')
    }
    for (const input of document.querySelectorAll(
      'main input:not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), main textarea, main select'
    )) {
      const el = input as HTMLElement
      if (!visibleInDocument(el)) continue
      if (sampledInputs++ >= 200) { inputFontsComplete = false; break }
      const style = window.getComputedStyle(el)
      const fontSize = parseFloat(style.fontSize)
      if (!Number.isFinite(fontSize) || fontSize <= 0) { inputFontsComplete = false; continue }
      const selector = inputSelector(el)
      if (selector.length > 2000 || document.querySelectorAll(selector).length !== 1) { inputFontsComplete = false; continue }
      const sample = { selector, fontSize: Math.round(fontSize * 10) / 10 }
      const field = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      const namedBy = (el.getAttribute('aria-labelledby') ?? '').trim().split(/\s+/).slice(0, 8)
        .map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
      const label = (namedBy || el.getAttribute('aria-label') || Array.from(field.labels ?? []).map(label => label.textContent ?? '').join(' ')).trim().replace(/\s+/g, ' ').slice(0, 160)
      const anchor = selector.startsWith('#') ? selector.split(' > ')[0] : null
      const formScope = field.form ? inputSelector(field.form) : null
      inputFontSamples.push({ ...sample, identity: JSON.stringify([anchor, el.tagName, el.getAttribute('type'), el.getAttribute('name'),
        el.getAttribute('autocomplete'), label, formScope?.startsWith('#') ? formScope : null,
        field.form?.getAttribute('name') ?? null, field.form?.getAttribute('action') ?? null]), formScope })
      if (fontSize < 16) inputsBelow16px.push(sample)
    }

    const MOBILE_FOLD_RATIO = 0.85
    const foldLine = Math.round(window.innerHeight * MOBILE_FOLD_RATIO)

    type CtaCandidate = { score: number; top: number; text: string }

    function scoreCtaElement(action: typeof renderedActions[number]): CtaCandidate | null {
      const el = action.element, tag = action.tag, href = action.href ?? '', text = action.text
      const buttonLike = tag === 'button' || tag === 'input' && ['button', 'submit'].includes(action.inputType ?? '') || action.role === 'button'
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
        buttonLike &&
        /\b(?:get started|sign up|signup|start(?: now| free| trial)?|try(?: free)?|demo|contact|register|join|learn more|explore|shop|browse|watch|find|claim|reserve|see how|get access)\b/i.test(
          text
        )
      )
        score = 85
      else if (
        buttonLike &&
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
    const styleSamples: CtaStyleSample[] = []
    let stylesComplete = actionsComplete
    let styleCandidates = 0
    function color(value: string): number[] | null {
      const match = /^rgba?\(([\d.,\s]+)\)$/.exec(value)
      if (!match) return null
      const channels = match[1].split(',').map(Number)
      return channels.length === 3 ? [...channels, 1] : channels.length === 4 ? channels : null
    }
    function distinct(first: number[], second: number[]) {
      return Math.max(...first.slice(0, 3).map((channel, index) => Math.abs(channel - second[index]))) >= 32
    }
    function actionStyle(element: Element, label: string): CtaStyleSample | null {
      const style = getComputedStyle(element), fill = color(style.backgroundColor)
      const fontSize = parseFloat(style.fontSize), fontWeight = parseInt(style.fontWeight, 10)
      if (!fill || !Number.isFinite(fontSize) || !Number.isFinite(fontWeight) || fill[3] !== 0 && fill[3] !== 1) return null
      let backdrop = [255, 255, 255, 1], foundBackdrop = false
      for (let node: Element | null = element; node; node = node.parentElement) {
        const paint = getComputedStyle(node)
        if (paint.backgroundImage !== 'none' || paint.filter !== 'none' || paint.backdropFilter !== 'none' ||
          paint.mixBlendMode !== 'normal' || Number(paint.opacity) !== 1) return null
        if (node === element || foundBackdrop) continue
        const background = color(paint.backgroundColor)
        if (!background || background[3] !== 0 && background[3] !== 1) return null
        if (background[3] === 1) { backdrop = background; foundBackdrop = true }
      }
      // An implicit dark canvas or complex paint cannot supply a solid backdrop.
      if (!foundBackdrop && getComputedStyle(document.documentElement).colorScheme.includes('dark')) return null
      const filled = fill[3] === 1 && distinct(fill, backdrop)
      let outlined = false
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        if (parseFloat(style[`border${side}Width`]) <= 0 || ['none', 'hidden'].includes(style[`border${side}Style`])) continue
        const border = color(style[`border${side}Color`])
        if (!border) return null
        outlined ||= border[3] > 0 && distinct(border, filled ? fill : backdrop)
      }
      return { label, surface: filled ? 'filled' : outlined ? 'outlined' : 'text', fontSize, fontWeight,
        height: Math.round(element.getBoundingClientRect().height * 10) / 10 }
    }

    // Top-document only: page.evaluate runs in the main frame, so cross-origin
    // iframe content (YouTube player buttons, etc.) is never collected here.
    for (const action of renderedActions) {
      const el = action.element
      if (shouldSkipNavHeader(el)) continue
      const candidate = scoreCtaElement(action)
      if (!candidate) continue
      candidates.push(candidate)

      const rect = el.getBoundingClientRect()
      if (candidate.score >= 85 && candidate.top >= 0 && candidate.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth && !el.closest('[inert]')) {
        const sample = ++styleCandidates <= 40 ? actionStyle(el, candidate.text || 'cta') : null
        if (sample) styleSamples.push(sample)
        else stylesComplete = false
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
            renderedActions.find(action => action.element === submitBtn)?.text ?? ''
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
              renderedActions.find(action => action.element === submitBtn)?.text ?? ''
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

    const bestTop = actionsComplete ? selected?.top ?? null : null
    const bestText = actionsComplete ? selected?.text ?? null : null
    // Surface treatment establishes the primary tier. Within it, compare type
    // and control height, avoiding width differences caused by label length.
    const tier = { filled: 2, outlined: 1, text: 0 }
    const strongest = [...styleSamples].sort((a, b) => tier[b.surface] - tier[a.surface] || b.fontSize - a.fontSize || b.height - a.height || b.fontWeight - a.fontWeight)[0]
    const competingLabels = [...new Set(styleSamples.filter(sample => strongest && sample.surface === strongest.surface &&
      sample.fontSize >= strongest.fontSize * 0.8 && sample.height >= strongest.height * 0.75 && sample.fontWeight >= strongest.fontWeight - 200)
      .map(sample => sample.label))]
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
      competingPrimaryCtaSamples: styleSamples,
      competingPrimaryCtaComplete: stylesComplete,
      mobileViewportHeight: window.innerHeight,
      mobileScrollY: Math.round(scrollY),
      mobileDocumentHeight: Math.round(documentHeight),
      uniqueFontFamilies: fontSet.size,
      fontFamilySample: [...fontSet].slice(0, 6),
      buttonBorderRadii: [...radii].sort((a, b) => a - b),
      buttonBorderRadiiComplete: actionsComplete,
      inputsBelow16px,
      inputFontSamples,
      inputFontsComplete,
    }
  }, { actions, complete: inventory.complete, pageUrl: inventory.pageUrl })

  const identities = new Map<string, number>()
  for (const sample of base.inputFontSamples) identities.set(sample.identity, (identities.get(sample.identity) ?? 0) + 1)
  return {
    ...base,
    // Font changes are the repair. Ambiguous controls cannot borrow another
    // field's recovery, and values and raw identities never enter the snapshot.
    inputFontSamples: base.inputFontSamples.map(({ selector, fontSize, identity, formScope }) => ({ selector, fontSize,
      context: identities.get(identity) === 1 ? 'mobile-input:' + createHash('sha256')
        .update(JSON.stringify(['input-control-v1', selector, identity, formScope])).digest('hex') : 'mobile-input:unknown' })),
    stuckLoadingIndicator: loading.loadingVisible,
    stuckLoadingLabel: loading.loadingLabel,
    ...(scope && content ? { loadingObservation: { version: 1 as const, device: 'mobile' as const,
      scope: { ...scope, finalUrl: content.pageUrl }, contentVisible: content.content === true,
      ready: loading.readyState === 'complete', restricted: documentEvidenceWithheld(restrictions) } } : {}),
    motionIgnoresReducedPreference: motion.motionIgnoresReducedPreference,
    motionSampleLabel: motion.motionSampleLabel,
    motionComplete: motion.motionComplete,
  }
}
