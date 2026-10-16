import { z } from 'zod'
import type { Page } from 'playwright'
import type { PublicDocument } from './contracts'

const sectionSchema = z.object({ html: z.string().max(260_000), complete: z.boolean(),
  reason: z.string().nullable(), observed: z.number().int().nonnegative(), limit: z.number().int().positive() }).strict()
export const renderedSearchSnapshotSchema = z.object({
  version: z.literal(1), contract: z.literal('rendered-search-v1'), finalUrl: z.string().url(),
  documentBaseUrl: z.string().url().optional(),
  collectedAt: z.string().datetime(), language: z.string().max(128),
  sections: z.object({ metadata: sectionSchema, indexing: sectionSchema, canonical: sectionSchema,
    structured: sectionSchema, links: sectionSchema, text: sectionSchema }).strict(),
}).strict()
export type RenderedSearchSnapshot = z.infer<typeof renderedSearchSnapshotSchema>
export type SearchSection = keyof RenderedSearchSnapshot['sections']

/** Each section has its own resource budget. Hydration scripts are never collected. */
export async function collectRenderedSearchSnapshot(page: Page): Promise<RenderedSearchSnapshot> {
  return renderedSearchSnapshotSchema.parse(await page.evaluate(() => {
    const sections = {} as Record<string, { html: string; complete: boolean; reason: string | null; observed: number; limit: number }>
    const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const collect = (key: string, selector: string, limit: number, bytes: number, serialize: (node: Element) => string | { html: string; complete: boolean }) => {
      const nodes = document.querySelectorAll(selector)
      let html = '', used = 0, complete = nodes.length <= limit
      for (let index = 0; index < Math.min(nodes.length, limit); index++) {
        const value = serialize(nodes[index])
        const fragment = typeof value === 'string' ? value : value.html
        if (typeof value !== 'string' && !value.complete) complete = false
        const size = new TextEncoder().encode(fragment).byteLength
        if (used + size > bytes) { complete = false; break }
        html += fragment; used += size
      }
      sections[key] = { html, complete, reason: complete ? null : 'section_limit', observed: nodes.length, limit }
    }
    collect('metadata', 'head title, head meta', 256, 32_000, node => node.outerHTML)
    collect('indexing', 'meta[name="robots" i], meta[name="googlebot" i]', 64, 16_000, node => node.outerHTML)
    collect('canonical', 'link[rel~="canonical" i]', 64, 16_000, node => node.outerHTML)
    collect('structured', 'script[type="application/ld+json" i], [itemscope], [typeof], [vocab]', 100, 250_000, node => {
      // Embedded markup needs its descendants. Nested roots are already included.
      if (node.parentElement?.closest('[itemscope], [typeof], [vocab]')) return ''
      const clone = node.cloneNode(true) as Element
      clone.querySelectorAll('script:not([type="application/ld+json" i]), style, template, noscript').forEach(item => item.remove())
      return clone.outerHTML
    })
    collect('links', 'a[href]', 2000, 128_000, node => `<a href="${escape(node.getAttribute('href') ?? '')}">${escape((node.textContent ?? '').slice(0, 256))}</a>`)
    collect('text', 'h1, article h2, button, footer, [aria-label*="breadcrumb" i]', 256, 64_000, node => {
      const clone = node.cloneNode(true) as Element
      clone.querySelectorAll('script, style, template, noscript, [hidden], [aria-hidden="true"]').forEach(item => item.remove())
      const text = clone.textContent ?? ''
      const tag = node.tagName.toLowerCase()
      const content = `<${tag}>${escape(text.slice(0, 8000))}</${tag}>`
      const html = node.matches('article h2') ? `<article>${content}</article>` : node.hasAttribute('aria-label') ? `<nav aria-label="breadcrumb">${Array.from(node.querySelectorAll('a[href]')).slice(0, 100).map(item => `<a href="${escape(item.getAttribute('href') ?? '')}">${escape(item.textContent ?? '')}</a>`).join('')}</nav>` : content
      return { html, complete: text.length <= 8000 && node.querySelectorAll('a[href]').length <= 100 }
    })
    return { version: 1, contract: 'rendered-search-v1', finalUrl: location.href, documentBaseUrl: document.baseURI, collectedAt: new Date().toISOString(),
      language: (document.documentElement.lang ?? '').slice(0, 128), sections }
  }))
}

/** A bounded section is never promoted to a complete whole-document capture. */
export function searchSectionBody(document: PublicDocument, section: SearchSection): string | null {
  if (document.status == null || document.status < 200 || document.status >= 300) return null
  if (!document.searchSnapshot) return document.complete ? document.body : null
  const snapshot = document.searchSnapshot, selected = snapshot.sections[section]
  if (!selected.complete) return null
  // Historical isolated canonical sections did not retain the base required for relative declarations.
  if (section === 'canonical' && !snapshot.documentBaseUrl) return document.complete ? document.body : null
  const language = snapshot.language.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const base = snapshot.documentBaseUrl ? '<base href="' + snapshot.documentBaseUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' : ''
  return ['metadata', 'indexing', 'canonical'].includes(section)
    ? `<html lang="${language}"><head>${base}${selected.html}</head></html>`
    : `<html lang="${language}"><head>${base}</head><body>${selected.html}</body></html>`
}
