import type { Page } from 'playwright'
import { z } from 'zod'
import { publishedTrustSignals } from '../metadata'
import { analyticsMarkupSignals, ANALYTICS_CONFIGURATION_ATTRIBUTES, ANALYTICS_INLINE_DECLARATION, ANALYTICS_RESOURCE_DECLARATION,
  METADATA_MARKUP_TOKENS } from '../metadata-markup-signals'
import { auditPageObservation, captureObservationScopeSchema, captureObservationKey, type CaptureObservationScope } from './observation-scope'
import { documentEvidenceWithheld } from './document-evidence'
import type { RenderedCopy } from './rendered-copy'

export const publicPageSignalsSchema = z.object({ version: z.literal(1), pageUrl: z.string().url(), collectedAt: z.string().datetime(),
  // Historical v1 trust snapshots did not record general analytics markup.
  hasAnalytics: z.boolean().nullable().optional(),
  hasPrivacyPolicy: z.boolean().nullable(), hasContactInfo: z.boolean().nullable(), hasCookieBasedAnalytics: z.boolean().nullable(),
  scope: captureObservationScopeSchema.optional(),
}).strict()
export type PublicPageSignals = z.infer<typeof publicPageSignalsSchema>

/** Landing and reached documents share the published-signal predicate. Limits
 * leave uninspected absence unknown; independently observed presence survives. */
export type PublicSignalCollection = 'all' | 'trust' | 'analytics'
export async function readPublicPageSignals(page: Page, collection: PublicSignalCollection = 'all'): Promise<PublicPageSignals | null> {
  const url = page.url(), original = auditPageObservation(page)
  if (original?.restricted) return null
  const parts = await page.evaluate(({ textLimit, anchorLimit, jsonLimit, markers, collectTrust, collectAnalytics, inline, resources, attributes }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
    const published = (element: Element) => !element.closest('noscript,template')
    const nodes = collectTrust ? [...document.querySelectorAll('a')].filter(published) : []
    const anchors: Array<{ text: string; href: string }> = []
    let privacyInLongAnchor = false
    for (const anchor of nodes.slice(0, anchorLimit)) {
      const text = anchor.textContent ?? '', href = anchor.getAttribute('href') ?? ''
      if (text.length > 2000 || href.length > 2000) {
        if (text.toLowerCase().includes('privacy') || href.toLowerCase().includes('privacy')) privacyInLongAnchor = true
        continue
      }
      anchors.push({ text, href })
    }
    if (!document.body) return null
    const contactExcluded = 'script,style,template,noscript,[hidden]'
    const contactWalker = collectTrust ? document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT) : null, textParts: string[] = []
    let textOverflow = false, textLength = 0, textVisited = 0, textNode: Node | null
    while (contactWalker && (textNode = contactWalker.nextNode())) {
      if (++textVisited > 20_000) { textOverflow = true; break }
      if (textNode.parentElement?.closest(contactExcluded)) continue
      const value = textNode.nodeValue ?? '', remaining = textLimit - textLength
      textParts.push(value.slice(0, Math.max(0, remaining))); textLength += value.length
      if (textLength > textLimit) { textOverflow = true; break }
    }
    const hrefs = nodes.filter(anchor => anchor.hasAttribute('href') && !anchor.closest(contactExcluded))
    const publishedHrefs = hrefs.slice(0, anchorLimit).map(anchor => (anchor.getAttribute('href') ?? '').slice(0, 2000))
    const jsonLd: unknown[] = []
    let jsonOverflow = false, jsonBytes = 0, jsonCount = 0
    for (const script of collectTrust ? [...document.querySelectorAll('script[type="application/ld+json"]')].filter(published) : []) {
      const raw = script.textContent ?? ''
      if (++jsonCount > 100 || jsonBytes + raw.length > jsonLimit) { jsonOverflow = true; continue }
      jsonBytes += raw.length
      try { jsonLd.push(JSON.parse(raw || '{}')) } catch { /* Match the HTML parser's unreadable-markup policy. */ }
    }
    // Only candidate declarations spend this budget. Read explicit declarations
    // first so a large inline candidate cannot obscure independently known tags.
    const found = new Set<string>(), scripts: Element[] = []
    const candidates = collectAnalytics ? document.querySelectorAll([
      inline, resources, 'template', ...attributes.map(attribute => `[${attribute}]`),
    ].join(',')) : []
    const candidateLimit = 20_000
    let markupComplete = collectAnalytics && candidates.length <= candidateLimit, remaining = textLimit
    function observe(value: string) {
      if (!value) return
      if (value.length > remaining) markupComplete = false
      if (remaining === 0) return
      const sample = value.slice(0, remaining)
      remaining -= sample.length
      const lower = sample.toLowerCase()
      for (const marker of markers) if (lower.includes(marker)) found.add(marker)
    }
    for (let index = 0; index < Math.min(candidates.length, candidateLimit); index++) {
      const node = candidates[index]
      if (node.parentElement?.closest('noscript,template')) continue
      if (node instanceof HTMLTemplateElement && node.content.childNodes.length) markupComplete = false
      if (node.matches(resources)) observe(node.getAttribute('src') ?? node.getAttribute('href') ?? '')
      for (const attribute of attributes) observe(node.getAttribute(attribute) ?? '')
      if (node.matches(inline)) scripts.push(node)
    }
    for (const script of scripts) {
      if (!script.hasChildNodes()) continue
      if (remaining === 0) { markupComplete = false; break }
      observe(script.textContent ?? '')
    }
    return { anchors, privacyInLongAnchor, publishedText: textParts.join(''), publishedHrefs, jsonLd,
      anchorOverflow: nodes.length > anchorLimit || hrefs.length > anchorLimit,
      hrefOverflow: hrefs.some(anchor => (anchor.getAttribute('href') ?? '').length > 2000), textOverflow, jsonOverflow, markupComplete, markers: [...found] }
  }, { textLimit: 500_000, anchorLimit: 5000, jsonLimit: 100_000, markers: [...METADATA_MARKUP_TOKENS],
    inline: ANALYTICS_INLINE_DECLARATION, resources: ANALYTICS_RESOURCE_DECLARATION, attributes: [...ANALYTICS_CONFIGURATION_ATTRIBUTES],
    collectTrust: collection !== 'analytics', collectAnalytics: collection !== 'trust' }).catch(() => null)
  const observed = auditPageObservation(page)
  if (!parts || page.url() !== url || observed?.restricted || original && (!observed || captureObservationKey(original.scope) !== captureObservationKey(observed.scope))) return null
  const signals = publishedTrustSignals(parts), analytics = analyticsMarkupSignals(parts.markers.join(' '))
  return publicPageSignalsSchema.parse({ version: 1, pageUrl: url, collectedAt: new Date().toISOString(),
    hasAnalytics: analytics.hasAnalytics ? true : parts.markupComplete ? false : null,
    hasPrivacyPolicy: collection === 'analytics' ? null : signals.hasPrivacyPolicy || parts.privacyInLongAnchor ? true : parts.anchorOverflow ? null : false,
    hasContactInfo: collection === 'analytics' ? null : signals.hasContactInfo ? true : parts.anchorOverflow || parts.hrefOverflow || parts.textOverflow || parts.jsonOverflow ? null : false,
    hasCookieBasedAnalytics: analytics.hasCookieBasedAnalytics ? true : parts.markupComplete ? false : null,
    ...(observed ? { scope: observed.scope } : {}) })
}

/** Raw native facts and consent controls retain their own recorded capture.
 * A changed document or read restriction cannot borrow another window's scope. */
export function capturedPublicPageSignals(capture: { publicTrustSignals?: PublicPageSignals | null; collectionRestrictions?: readonly string[] | null;
  desktopFinalUrl?: string; desktopHttpStatus?: number | null;
  renderedCopy?: RenderedCopy | null; renderedCopyScope?: CaptureObservationScope | null } | null | undefined) {
  const signals = capture?.publicTrustSignals
  if (!capture || !signals?.scope || signals.pageUrl !== signals.scope.finalUrl ||
    capture.desktopFinalUrl && capture.desktopFinalUrl !== signals.pageUrl ||
    capture.desktopHttpStatus != null && (capture.desktopHttpStatus < 200 || capture.desktopHttpStatus >= 300) ||
    documentEvidenceWithheld(capture.collectionRestrictions))
    return { signals: null, scope: undefined, copy: null }
  const sameCopy = capture.renderedCopy?.pageUrl === signals.pageUrl && capture.renderedCopyScope &&
    captureObservationKey(capture.renderedCopyScope) === captureObservationKey(signals.scope)
  return { signals, scope: signals.scope, copy: sameCopy ? capture.renderedCopy ?? null : null }
}
