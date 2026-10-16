import type { Page } from 'playwright'
import { z } from 'zod'
import type { PageMetadata } from '../metadata'
import { MAX_RAW_TEXT } from '../page-text-limits'
import { normalizeHeadingText } from '../checks/utils'

export const renderedCopySchema = z.object({ version: z.literal(1), pageUrl: z.string().url(),
  pageText: z.string().max(MAX_RAW_TEXT), h1s: z.array(z.string().max(500)).max(100), h2s: z.array(z.string().max(500)).max(100),
  complete: z.boolean(), textTruncated: z.boolean(),
  headlineSupport: z.string().max(1200).optional(),
  proseBlocks: z.array(z.string().max(MAX_RAW_TEXT)).max(1000).optional(),
}).strict()
export type RenderedCopy = z.infer<typeof renderedCopySchema>
export const RENDERED_COPY_MODULES = new Set(['content', 'slop', 'messaging-clarity', 'conversion-friction', 'trust-psychology', 'visual-hierarchy'])
export const RENDERED_COPY_LIMITATION = `Copy observations sample up to ${MAX_RAW_TEXT} laid-out prose characters and 100 headings in the top document. Embedded content and later states are outside this observation.`

/** Preserve declared HTML facts separately from the prose a visitor can read. */
export function renderedContentMetadata<T extends Pick<PageMetadata, 'pageText' | 'h1s' | 'h2s' | 'renderedCopy'>>(metadata: T): T {
  const copy = metadata.renderedCopy
  if (!copy) return metadata
  const h1s: string[] = []
  for (const text of copy.h1s) {
    const normalized = normalizeHeadingText(text)
    if (!h1s.some(existing => existing === normalized || existing.includes(normalized) || normalized.includes(existing))) h1s.push(normalized)
  }
  return { ...metadata, pageText: copy.pageText, h1s, h2s: copy.h2s, headlineSupport: copy.headlineSupport ?? null }
}

export async function observeRenderedCopy(page: Page): Promise<RenderedCopy> {
  return renderedCopySchema.parse(await page.evaluate(({ textLimit }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
    const result = { version: 1 as const, pageUrl: location.href, pageText: '', h1s: [] as string[], h2s: [] as string[],
      complete: Boolean(document.body), textTruncated: false, headlineSupport: '', proseBlocks: [] as string[] }
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
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange(), headings = new Map<Element, string[]>()
    const parts: string[] = []
    const prose = new Map<Element, string[]>()
    let proseLength = 0
    const visibleHeadline = (heading: Element) => isPainted(heading) && getComputedStyle(heading).visibility === 'visible'
    const primaryHeadline = [...document.querySelectorAll('main h1')].find(visibleHeadline) ?? [...document.querySelectorAll('h1')].find(visibleHeadline)
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
        !parent.closest('nav,footer,aside') && result.headlineSupport.length < 1200) {
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
    result.proseBlocks = [...prose.values()].map(words => words.join(' '))
    for (const [heading, words] of headings) result[heading.tagName === 'H1' ? 'h1s' : 'h2s'].push(words.join(' ').slice(0, 500))
    return result
  }, { textLimit: MAX_RAW_TEXT }))
}
