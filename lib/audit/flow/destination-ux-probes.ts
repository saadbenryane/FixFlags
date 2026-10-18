import type { Page } from 'playwright'
import { parseMetadataFromHtml, publishedTrustSignals } from '@/lib/audit/metadata'
import { collectRenderedHtml } from '../browser/rendered-html'
import { observeRenderedCopy } from '../browser/rendered-copy'
import { collectRenderedActionInventory } from './discover-cta'
import { classifyCtaHref } from './link-scoring'
import type { PostClickMetrics } from './post-click-probes'

export interface DestinationUXQuality {
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
const TRUST_TEXT_LIMIT = 500_000
const TRUST_ANCHOR_LIMIT = 5_000
const TRUST_JSON_LIMIT = 100_000

/** Saved HTML can exceed the metadata bound while the open document still
 * shows its privacy link and contact details. Unread text stays unknown. */
async function readLiveTrustSignals(page: Page) {
  const url = page.url()
  const parts = await page.evaluate(({ textLimit, anchorLimit, jsonLimit }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
    const published = (element: Element) => !element.closest('noscript,template')
    const nodes = [...document.querySelectorAll('a')].filter(published)
    if (nodes.length > anchorLimit) return { anchorOverflow: true as const }
    let privacyInLongAnchor = false
    const anchors: { text: string; href: string }[] = []
    for (const anchor of nodes) {
      const text = anchor.textContent ?? ''
      const href = anchor.getAttribute('href') ?? ''
      if (text.length > 2_000 || href.length > 2_000) {
        if (text.toLowerCase().includes('privacy') || href.toLowerCase().includes('privacy')) privacyInLongAnchor = true
        continue
      }
      anchors.push({ text, href })
    }
    const body = document.body?.cloneNode(true) as HTMLElement | undefined
    if (!body) return { anchorOverflow: true as const }
    body.querySelectorAll('script,style,template,[hidden]').forEach(node => node.remove())
    const text = body.textContent ?? ''
    const textOverflow = text.length > textLimit
    const publishedHrefs = [...body.querySelectorAll('a[href]')].map(anchor => anchor.getAttribute('href') ?? '')
    const jsonLd: unknown[] = []
    let jsonOverflow = false
    for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')].filter(published)) {
      const raw = script.textContent ?? ''
      if (raw.length > jsonLimit) { jsonOverflow = true; continue }
      try { jsonLd.push(JSON.parse(raw || '{}')) } catch { /* Ignore the same unreadable script the HTML parser ignores. */ }
    }
    return { anchorOverflow: false as const, privacyInLongAnchor, anchors, publishedText: textOverflow ? '' : text, publishedHrefs, jsonLd, textOverflow, jsonOverflow }
  }, { textLimit: TRUST_TEXT_LIMIT, anchorLimit: TRUST_ANCHOR_LIMIT, jsonLimit: TRUST_JSON_LIMIT }).catch(() => null)
  if (!parts || parts.anchorOverflow || page.url() !== url) return null
  const signals = publishedTrustSignals(parts)
  return {
    hasPrivacyPolicy: signals.hasPrivacyPolicy || parts.privacyInLongAnchor,
    hasContactInfo: (parts.textOverflow || parts.jsonOverflow) && !signals.hasContactInfo ? null : signals.hasContactInfo,
  }
}

/** Inspect the actual reached document. Transport and load observations already
 * belong to the navigation; probing the destination never repeats either. */
export async function runDestinationUXProbes(
  page: Page,
  originCtaText: string | null,
  originCtaHref: string | null,
  postClick?: PostClickMetrics,
): Promise<DestinationUXQuality> {
  const url = page.url()
  const load = postClick?.version === 2 && postClick.pageUrl !== url ? undefined : postClick
  const [copy, controls, rendered, pageData] = await Promise.all([
    observeRenderedCopy(page).catch(() => null),
    collectRenderedActionInventory(page, true, false).catch(() => null),
    collectRenderedHtml(page).catch(() => null),
    page.evaluate(() => ({ pageUrl: location.href, ready: document.readyState !== 'loading' && (document.readyState === 'complete' ||
      ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.domContentLoadedEventEnd ?? 0) > 0),
      hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
      hasFormForValue: Boolean(document.querySelector('form input[type="email"],form textarea,form input[required]')) })).catch(() => null),
  ])
  const sameDocument = page.url() === url && pageData?.pageUrl === url && pageData.ready
  const contentComplete = sameDocument && copy?.pageUrl === url && copy.complete
  const controlsComplete = sameDocument && controls?.pageUrl === url && controls.complete
  const headline = contentComplete ? copy.h1s[0] ?? null : null
  const allControls = controls?.pageUrl === url ? controls.controls.filter(control => control.enabled && control.labelComplete) : []
  const ctas = allControls.filter(control => !control.inNavigation)
  const primaryCta = ctas.find(control => control.primary) ?? ctas[0] ?? null
  const actionableCtas = ctas.filter(control => control.tag === 'button' || control.role === 'button' ||
    Boolean(control.href && !classifyCtaHref(control.href, { hashTargetExists: control.hashTargetExists }).isPlaceholder &&
      control.resolvedHref && /^https?:/i.test(control.resolvedHref)))
  const CTA_TEXT = /\b(sign\s?up|log\s?in|get started|start (free|now|today|building|for free)|try (it|for free|free|now)|buy|book (a )?(demo|call)|subscribe|contact sales|download|request (a )?(demo|quote)|create (an )?account|join (now|free|us)?|get (a )?demo|start (a )?(free )?trial|add to cart|checkout|upgrade|get the app)\b/i
  const distinctCtaCount = new Set(actionableCtas.filter(control => CTA_TEXT.test(control.text))
    .map(control => control.text.toLowerCase().replace(/\s+/g, ' ').trim())).size
  let metadata: ReturnType<typeof parseMetadataFromHtml> | null = null
  if (sameDocument && rendered?.finalUrl === url && rendered.html && !rendered.truncated) {
    try { metadata = parseMetadataFromHtml(rendered.html, url, 'rendered') } catch { /* Unavailable declarations remain unknown. */ }
  }
  const liveTrust = sameDocument && !metadata && page.url() === url ? await readLiveTrustSignals(page) : null
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
    contentComplete, controlsComplete, hasClearHeadline: Boolean(headline && headline.length > 5), hasPrimaryCTA: primaryCta !== null,
    ctaText: primaryCta?.text ?? null, ctaPromisesMatch, headline, pageType: null,
    visibleCtaCount: ctas.length, actionableCtaCount: actionableCtas.length, primaryCtaHref: primaryCta?.resolvedHref ?? null,
    trustSignals: { hasPrivacyPolicy: metadata?.hasPrivacyPolicy ?? liveTrust?.hasPrivacyPolicy ?? null, hasContactInfo: metadata?.hasContactInfo ?? liveTrust?.hasContactInfo ?? null, isHttps: url.startsWith('https://') },
    mobileReadiness: { hasViewportMeta: pageData?.hasViewportMeta ?? false,
      tapTargetsSmall: allControls.some(control => control.width < 44 && control.height < 44) },
    frictionSignals: { tooManyCTAs: distinctCtaCount > 5, ctaCount: ctas.length, distinctCtaCount,
      hasDeadEnd: contentComplete && controlsComplete && !primaryCta && !headline, formRequiredForValue: pageData?.hasFormForValue ?? false },
    loadQuality: { timeToContentMs: load?.timeToFirstContentMs ?? null, hadStuckLoading: load?.stuckLoading ?? null, layoutShift: null,
      ...(load?.version === 2 ? { version: 2, contentAbsentThroughMs: load.contentAbsentThroughMs } : {}) },
  }
}
