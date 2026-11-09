import type { Page } from 'playwright'
import { readPublicPageSignals } from '../browser/public-page-signals'
import { observeRenderedCopy } from '../browser/rendered-copy'
import { collectRenderedActionInventory } from './discover-cta'
import { classifyCtaHref } from './link-scoring'
import type { PostClickMetrics } from './post-click-probes'

export interface DestinationUXQuality {
  controlsVersion?: 2 | 3
  contentComplete?: boolean
  controlsComplete?: boolean
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
    hasPrivacyPolicy: boolean | null
    hasContactInfo: boolean | null
    isHttps: boolean
  }
  mobileReadiness: {
    hasViewportMeta: boolean
    tapTargetsSmall: boolean
  }
  frictionSignals: {
    tooManyCTAs: boolean
    ctaCount: number
    /** Distinct high-intent conversion CTAs (deduped by label); drives tooManyCTAs. */
    distinctCtaCount: number
    hasDeadEnd: boolean
    formRequiredForValue: boolean
  }
  loadQuality: {
    timeToContentMs: number | null
    hadStuckLoading: boolean | null
    layoutShift: boolean | null
    version?: 2
    contentAbsentThroughMs?: number
  }
}
/** Inspect the actual reached document. Transport and load observations already
 * belong to the navigation; probing the destination never repeats either. */
export async function runDestinationUXProbes(
  page: Page,
  originCtaText: string | null,
  originCtaHref: string | null,
  postClick?: PostClickMetrics,
  { inspectContent = true } = {},
): Promise<DestinationUXQuality> {
  const url = page.url()
  const load = postClick?.version === 2 && postClick.pageUrl !== url ? undefined : postClick
  const [copy, controls, trust, pageData] = inspectContent ? await Promise.all([
    observeRenderedCopy(page).catch(() => null),
    collectRenderedActionInventory(page, true, false).catch(() => null),
    readPublicPageSignals(page, 'trust').catch(() => null),
    page.evaluate(() => ({ pageUrl: location.href, ready: document.readyState !== 'loading' && (document.readyState === 'complete' ||
      ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.domContentLoadedEventEnd ?? 0) > 0),
      hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
      hasFormForValue: Boolean(document.querySelector('form input[type="email"],form textarea,form input[required]')) })).catch(() => null),
  ]) : [null, null, null, null]
  const sameDocument = page.url() === url && pageData?.pageUrl === url && pageData.ready
  const contentComplete = sameDocument && copy?.pageUrl === url && copy.complete
  const controlsComplete = sameDocument && controls?.pageUrl === url && controls.complete
  const headline = contentComplete ? copy.h1s[0] ?? null : null
  const allControls = controls?.pageUrl === url ? controls.controls.filter(control => control.enabled && control.labelComplete) : []
  const ctas = allControls.filter(control => !control.inNavigation)
  const primaryCta = ctas.find(control => control.primary) ?? ctas[0] ?? null
  const actionableCtas = ctas.filter(control => control.tag === 'button' || control.role === 'button' ||
    Boolean(control.href && !classifyCtaHref(control.href, { baseUrl: url, resolvedHref: control.resolvedHref, hashTargetExists: control.hashTargetExists }).isPlaceholder &&
      control.resolvedHref && /^https?:/i.test(control.resolvedHref)))
  const CTA_TEXT = /\b(sign\s?up|log\s?in|get started|start (free|now|today|building|for free)|try (it|for free|free|now)|buy|book (a )?(demo|call)|subscribe|contact sales|download|request (a )?(demo|quote)|create (an )?account|join (now|free|us)?|get (a )?demo|start (a )?(free )?trial|add to cart|checkout|upgrade|get the app)\b/i
  const distinctCtaCount = new Set(actionableCtas.filter(control => CTA_TEXT.test(control.text))
    .map(control => control.text.toLowerCase().replace(/\s+/g, ' ').trim())).size
  const liveTrust = sameDocument && trust?.pageUrl === url ? trust : null
  const ctaPromisesMatch = (() => {
    if (!originCtaText || !headline) return true
    const ctaLower = originCtaText.toLowerCase(), heading = headline.toLowerCase()
    const genericWords = new Set(['get', 'start', 'free', 'try', 'your', 'now', 'for', 'the', 'and', 'our', 'with', 'more', 'learn', 'book', 'view', 'see', 'join', 'sign', 'up', 'log', 'in', 'click', 'here', 'out', 'all'])
    const words = ctaLower.split(' ').filter(word => word.length > 3 && !genericWords.has(word))
    if (words.length && words.every(word => heading.includes(word))) return true
    if (originCtaHref) {
      const meaningful = originCtaHref.toLowerCase().split(/[/-]/).filter(word => word.length > 4 && !genericWords.has(word))
      if (meaningful.some(word => heading.includes(word))) return true
    }
    return words.length === 0
  })()
  return {
    contentComplete, controlsComplete, controlsVersion: 3, hasClearHeadline: Boolean(headline && headline.length > 5), hasPrimaryCTA: primaryCta !== null,
    ctaText: primaryCta?.text ?? null, ctaPromisesMatch, headline, pageType: null,
    visibleCtaCount: ctas.length, actionableCtaCount: actionableCtas.length, primaryCtaHref: primaryCta?.resolvedHref ?? null,
    trustSignals: { hasPrivacyPolicy: liveTrust?.hasPrivacyPolicy ?? null, hasContactInfo: liveTrust?.hasContactInfo ?? null, isHttps: url.startsWith('https://') },
    mobileReadiness: { hasViewportMeta: pageData?.hasViewportMeta ?? false,
      tapTargetsSmall: allControls.some(control => control.width < 44 && control.height < 44) },
    frictionSignals: { tooManyCTAs: distinctCtaCount > 5, ctaCount: ctas.length, distinctCtaCount,
      hasDeadEnd: contentComplete && controlsComplete && !primaryCta && !headline, formRequiredForValue: pageData?.hasFormForValue ?? false },
    loadQuality: { timeToContentMs: load?.timeToFirstContentMs ?? null, hadStuckLoading: load?.stuckLoading ?? null, layoutShift: null,
      ...(load?.version === 2 ? { version: 2, contentAbsentThroughMs: load.contentAbsentThroughMs } : {}) },
  }
}
