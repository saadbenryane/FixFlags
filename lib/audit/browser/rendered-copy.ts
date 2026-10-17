import type { Page } from 'playwright'
import { z } from 'zod'
import type { PageMetadata } from '../metadata'
import { CONSENT_CONTEXT_SELECTOR, CONSENT_CONTROL_PATTERN, CONSENT_CHOICE_PATTERN } from '../consent-controls'
import { MAX_RAW_TEXT } from '../page-text-limits'
import { normalizeHeadingText } from '../checks/utils'

export const renderedCopySchema = z.object({ version: z.literal(1), pageUrl: z.string().url(),
  pageText: z.string().max(MAX_RAW_TEXT), h1s: z.array(z.string().max(500)).max(100), h2s: z.array(z.string().max(500)).max(100),
  complete: z.boolean(), textTruncated: z.boolean(),
  consentControls: z.array(z.object({ name: z.string().max(500), context: z.string().max(2000) }).strict()).max(1000).optional(),
  consentControlsComplete: z.boolean().optional(),
  headlineSupport: z.string().max(1200).optional(),
  testimonialBlocks: z.array(z.object({ quote: z.string().max(MAX_RAW_TEXT), attribution: z.string().max(1200).nullable() }).strict()).max(1000).optional(),
  proseBlocks: z.array(z.string().max(MAX_RAW_TEXT)).max(1000).optional(),
}).strict()
export type RenderedCopy = z.infer<typeof renderedCopySchema>
export const RENDERED_COPY_MODULES = new Set(['content', 'slop', 'messaging-clarity', 'conversion-friction', 'trust-psychology', 'visual-hierarchy'])
export const RENDERED_COPY_LIMITATION = `Copy observations sample up to ${MAX_RAW_TEXT} laid-out prose characters and 100 headings in the top document. Embedded content and later states are outside this observation.`

/** Preserve declared HTML facts separately from the prose a visitor can read. */
export function renderedContentMetadata<T extends Pick<PageMetadata, 'pageText' | 'h1s' | 'h2s' | 'renderedCopy' | 'testimonialBlocks'>>(metadata: T): T {
  const copy = metadata.renderedCopy
  if (!copy) return metadata
  const h1s: string[] = []
  for (const text of copy.h1s) {
    const normalized = normalizeHeadingText(text)
    if (!h1s.some(existing => existing === normalized || existing.includes(normalized) || normalized.includes(existing))) h1s.push(normalized)
  }
  return { ...metadata, pageText: copy.pageText, h1s, h2s: copy.h2s, headlineSupport: copy.headlineSupport ?? null, testimonialBlocks: copy.testimonialBlocks ?? metadata.testimonialBlocks }
}

export async function observeRenderedCopy(page: Page): Promise<RenderedCopy> {
  return renderedCopySchema.parse(await page.evaluate(({ textLimit, consentContextSelector, consentNamePattern, consentChoicePattern }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
    const result = { version: 1 as const, pageUrl: location.href, pageText: '', h1s: [] as string[], h2s: [] as string[],
      complete: Boolean(document.body), textTruncated: false, headlineSupport: '', proseBlocks: [] as string[], testimonialBlocks: [] as Array<{ quote: string; attribution: string | null }>, consentControls: [] as Array<{ name: string; context: string }>, consentControlsComplete: false }
    if (!document.body) return result
    const painted = new Map<Element, boolean>()
    function isPainted(element: Element): boolean {
      const cached = painted.get(element)
      if (cached !== undefined) return cached
      const style = getComputedStyle(element)
      const visible = style.display !== 'none' && style.contentVisibility !== 'hidden' && Number(style.opacity) !== 0 &&
        (!element.parentElement || isPainted(element.parentElement))
      painted.set(element, visible)
      return visible
    }
    const controls = [...document.querySelectorAll('button,a[href],[role="button"],input[type="button"],input[type="submit"]')]
    const consentName = new RegExp(consentNamePattern, 'i'), consentChoice = new RegExp(consentChoicePattern, 'i')
    let consentLength = 0
    result.consentControlsComplete = controls.length <= 10_000
    for (const control of controls.slice(0, 10_000)) {
      if (!isPainted(control) || getComputedStyle(control).visibility !== 'visible' || control.closest('[inert]')) continue
      if (![...control.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)) continue
      const labelled = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ')
      const name = (labelled.trim() || control.getAttribute('aria-label') || (control instanceof HTMLElement ? control.innerText : control.textContent) || control.getAttribute('value') || control.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 500)
      if (!consentName.test(name) && !consentChoice.test(name)) continue
      const surface = control.closest(consentContextSelector)
      const context = [surface?.getAttribute('aria-label'), surface instanceof HTMLElement ? surface.innerText : ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
      // Keep named controls and their local facts. Evaluation owns classification.
      if (consentLength + name.length + context.length > textLimit || result.consentControls.length >= 1000) { result.consentControlsComplete = false; break }
      result.consentControls.push({ name, context }); consentLength += name.length + context.length
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange(), headings = new Map<Element, string[]>()
    const parts: string[] = []
    const prose = new Map<Element, string[]>()
    const quotations = new Map<Element, { quote: string[]; attribution: string[] }>()
    let quotationLength = 0
    let proseLength = 0
    const visibleHeadline = (heading: Element) => isPainted(heading) && getComputedStyle(heading).visibility === 'visible'
    const primaryHeadline = [...document.querySelectorAll('main h1')].find(visibleHeadline) ?? [...document.querySelectorAll('h1')].find(visibleHeadline)
    const introductionScope = primaryHeadline?.closest('section,main,[role="main"]') ?? document.body
    let afterHeadline = false, introFinished = false
    let length = 0, visited = 0, node: Node | null
    while ((node = walker.nextNode())) {
      if (++visited > 20_000) { result.complete = false; break }
      const parent = node.parentElement
      if (!parent || parent.closest('script,style,noscript,pre,code,kbd,samp,template,iframe,canvas')) continue
      if (getComputedStyle(parent).visibility !== 'visible' || !isPainted(parent)) continue
      const raw = node.textContent ?? ''
      if (raw.length > 1_000_000) { result.complete = false; break }
      const text = raw.replace(/\s+/g, ' ').trim()
      if (!text) continue
      range.selectNodeContents(node)
      if (!Array.from(range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)) continue
      const directQuote = parent.closest('blockquote,[itemprop="review"]')
      const caption = parent.closest('figcaption,footer')
      const captionContainer = caption?.parentElement
      const associatedQuotes = captionContainer?.querySelectorAll(caption?.tagName === 'FIGCAPTION' ? 'blockquote,[itemprop="review"]' : ':scope > blockquote,:scope > [itemprop="review"]')
      const associatedQuote = associatedQuotes?.length === 1 ? associatedQuotes[0] : null
      const localCaption = caption?.tagName === 'FIGCAPTION' || Boolean(captionContainer && !captionContainer.matches('body,main,article,[role="main"]') && caption?.previousElementSibling === associatedQuote)
      const quote = directQuote ?? (localCaption ? associatedQuote : null)
      if (quote && quotationLength < textLimit && (quotations.has(quote) || quotations.size < 1000)) {
        const sampled = text.slice(0, textLimit - quotationLength)
        const words = quotations.get(quote) ?? { quote: [], attribution: [] }
        words[!directQuote || parent.closest('cite,footer') ? 'attribution' : 'quote'].push(sampled)
        quotations.set(quote, words); quotationLength += sampled.length + 1
      }
      const paragraph = parent.closest('p,blockquote,[role="paragraph"]')
      if (paragraph && !parent.closest('nav,header,footer,aside') && proseLength < textLimit && (prose.has(paragraph) || prose.size < 1000)) {
        const sampled = text.slice(0, textLimit - proseLength)
        const words = prose.get(paragraph) ?? []
        words.push(sampled)
        prose.set(paragraph, words)
        proseLength += sampled.length + 1
      }
      const heading = parent.closest('h1,h2')
      if (heading === primaryHeadline) afterHeadline = true
      else if (afterHeadline && heading) introFinished = true
      if (afterHeadline && !introFinished && !heading && parent.closest('p,[role="doc-subtitle"]') &&
        introductionScope.contains(parent) && !parent.closest('nav,footer,aside,dialog,[role="dialog"],[role="alertdialog"]') && result.headlineSupport.length < 1200) {
        result.headlineSupport = (result.headlineSupport + ' ' + text).trim().slice(0, 1200)
      }
      if (length < textLimit) {
        const sampled = text.slice(0, textLimit - length)
        parts.push(sampled); length += sampled.length + 1
        if (sampled.length < text.length) result.textTruncated = true
      } else result.textTruncated = true
      if (heading) {
        if (!headings.has(heading) && headings.size >= 100) { result.complete = false; continue }
        const words = headings.get(heading) ?? []
        if (words.join(' ').length < 500) words.push(text.slice(0, 500))
        headings.set(heading, words)
      }
    }
    result.pageText = parts.join(' ').slice(0, textLimit)
    result.testimonialBlocks = [...quotations.values()].map(words => ({ quote: words.quote.join(' '), attribution: words.attribution.join(' ').slice(0, 1200) || null })).filter(block => block.quote)
    result.proseBlocks = [...prose.values()].map(words => words.join(' '))
    for (const [heading, words] of headings) result[heading.tagName === 'H1' ? 'h1s' : 'h2s'].push(words.join(' ').slice(0, 500))
    return result
  }, { textLimit: MAX_RAW_TEXT, consentContextSelector: CONSENT_CONTEXT_SELECTOR, consentNamePattern: CONSENT_CONTROL_PATTERN.source, consentChoicePattern: CONSENT_CHOICE_PATTERN.source }))
}
