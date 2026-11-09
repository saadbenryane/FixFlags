import { z } from 'zod'
import type { Page } from 'playwright'
import type { PublicDocument } from './contracts'
import { isSuccessfulPublicGetStatus } from '../http-evidence'
import { CANONICAL_HEAD_SELECTOR } from './definitions'

const sectionSchema = z.object({ html: z.string().max(260_000), complete: z.boolean(),
  reason: z.string().nullable(), observed: z.number().int().nonnegative(), limit: z.number().int().positive() }).strict()
export const renderedSearchSnapshotSchema = z.object({
  version: z.literal(1), contract: z.literal('rendered-search-v1'), finalUrl: z.string().url(),
  documentBaseUrl: z.string().url().optional(),
  canonicalHeadScoped: z.literal(true).optional(),
  collectedAt: z.string().datetime(), language: z.string().max(128),
  sectionLinks: z.object({ complete: z.boolean(),
    links: z.array(z.object({ href: z.string().max(8192), text: z.string().max(256) }).strict()).max(2000),
    elementIds: z.array(z.string().max(8192)).max(300), anchorNames: z.array(z.string().max(8192)).max(300),
  }).strict().optional(),
  sections: z.object({ metadata: sectionSchema, indexing: sectionSchema, canonical: sectionSchema,
    structured: sectionSchema, links: sectionSchema.extend({ labelsComplete: z.boolean().optional() }), text: sectionSchema }).strict(),
}).strict()
export type RenderedSearchSnapshot = z.infer<typeof renderedSearchSnapshotSchema>
export type SearchSection = keyof RenderedSearchSnapshot['sections']

/** Each section has its own resource budget. Hydration scripts are never collected. */
export async function collectRenderedSearchSnapshot(page: Page): Promise<RenderedSearchSnapshot> {
  return renderedSearchSnapshotSchema.parse(await page.evaluate(canonicalSelector => {
    const sections = {} as Record<string, { html: string; complete: boolean; reason: string | null; observed: number; limit: number; labelsComplete?: boolean }>
    const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const collect = (key: string, selector: string, limit: number, bytes: number, serialize: (node: Element) => string | { html: string; complete: boolean }) => {
      const nodes = Array.from(document.querySelectorAll(selector)).filter(node => !node.closest('template,noscript'))
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
      return nodes
    }
    collect('metadata', 'head title, head meta', 256, 32_000, node => node.outerHTML)
    collect('indexing', 'meta[name="robots" i], meta[name="googlebot" i]', 64, 16_000, node => node.outerHTML)
    collect('canonical', canonicalSelector, 64, 16_000, node => node.outerHTML)
    collect('structured', 'script[type="application/ld+json" i], [itemscope], [typeof], [vocab]', 100, 250_000, node => {
      // Embedded markup needs its descendants. Nested roots are already included.
      if (node.parentElement?.closest('[itemscope], [typeof], [vocab]')) return ''
      const clone = node.cloneNode(true) as Element
      clone.querySelectorAll('script:not([type="application/ld+json" i]), style, template, noscript').forEach(item => item.remove())
      return clone.outerHTML
    })
    let linkLabelsComplete = true
    const activeLinks = collect('links', 'a[href]', 2000, 128_000, node => {
      const text = node.textContent ?? ''
      if (text.length > 256) linkLabelsComplete = false
      return `<a href="${escape(node.getAttribute('href') ?? '')}"${text.length > 256 ? ' data-label-truncated=""' : ''}>${escape(text.slice(0, 256))}</a>`
    })
    sections.links.labelsComplete = linkLabelsComplete
    const sectionLinks = { complete: activeLinks.length <= 2000, links: [] as Array<{ href: string; text: string }>, elementIds: [] as string[], anchorNames: [] as string[] }
    const fragments = new Set<string>(), ids = new Set<string>(), names = new Set<string>()
    const documentUrl = new URL(location.href); documentUrl.hash = ''
    let sectionBytes = 0
    for (let index = 0; index < Math.min(activeLinks.length, 2000); index++) {
      const node = activeLinks[index], href = node.getAttribute('href') ?? ''
      let destination: URL
      try { destination = new URL(href, document.baseURI) } catch { continue }
      if (!destination.hash) continue
      const fragment = destination.hash.slice(1); destination.hash = ''
      if (destination.href !== documentUrl.href) continue
      if (href.length > 8192 || !fragments.has(fragment) && fragments.size >= 300) { sectionLinks.complete = false; continue }
      const text = (node.textContent ?? '').slice(0, 256)
      const bytes = new TextEncoder().encode(href + text).byteLength
      if (sectionBytes + bytes > 128_000) { sectionLinks.complete = false; break }
      sectionBytes += bytes; sectionLinks.links.push({ href, text })
      if (fragments.has(fragment)) continue
      fragments.add(fragment)
      let target: string
      try { target = decodeURIComponent(fragment) } catch { target = fragment }
      const first = document.getElementById(target)
      // A dormant duplicate cannot hide a later active target with the same id.
      if (first && (!first.closest('template,noscript') || Array.from(document.querySelectorAll('[id]')).some(item =>
        item.id === target && !item.closest('template,noscript')))) ids.add(target)
      for (const item of document.getElementsByName(target)) if (item.tagName === 'A' && !item.closest('template,noscript')) { names.add(target); break }
    }
    sectionLinks.elementIds = [...ids]; sectionLinks.anchorNames = [...names]
    collect('text', 'h1, article h2, button, footer, [aria-label*="breadcrumb" i]', 256, 64_000, node => {
      const clone = node.cloneNode(true) as Element
      clone.querySelectorAll('script, style, template, noscript, [hidden], [aria-hidden="true"]').forEach(item => item.remove())
      const text = clone.textContent ?? ''
      const tag = node.tagName.toLowerCase()
      const content = `<${tag}>${escape(text.slice(0, 8000))}</${tag}>`
      const html = node.matches('article h2') ? `<article>${content}</article>` : node.hasAttribute('aria-label') ? `<nav aria-label="breadcrumb">${Array.from(node.querySelectorAll('a[href]')).slice(0, 100).map(item => `<a href="${escape(item.getAttribute('href') ?? '')}">${escape(item.textContent ?? '')}</a>`).join('')}</nav>` : content
      return { html, complete: text.length <= 8000 && node.querySelectorAll('a[href]').length <= 100 }
    })
    return { version: 1, contract: 'rendered-search-v1', finalUrl: location.href, documentBaseUrl: document.baseURI, canonicalHeadScoped: true, collectedAt: new Date().toISOString(),
      language: (document.documentElement.lang ?? '').slice(0, 128), sections, sectionLinks }
  }, CANONICAL_HEAD_SELECTOR))
}

/** A bounded section is never promoted to a complete whole-document capture. */
export function searchSectionBody(document: PublicDocument, section: SearchSection): string | null {
  if (document.status == null || !isSuccessfulPublicGetStatus(document.status)) return null
  if (!document.searchSnapshot) return document.complete ? document.body : null
  const snapshot = document.searchSnapshot, selected = snapshot.sections[section]
  // A section limit does not erase a complete document already collected in
  // this same observation. Partial document bytes still cannot cover the gap.
  if (!selected.complete) return document.complete ? document.body : null
  // Earlier isolated sections combined head and body links without recording placement.
  if (section === 'canonical' && !snapshot.canonicalHeadScoped) return document.complete ? document.body : null
  // Older isolated sections may lack the base needed to resolve relative URLs.
  if ((section === 'canonical' || section === 'links') && !snapshot.documentBaseUrl) return document.complete ? document.body : null
  const language = snapshot.language.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const base = snapshot.documentBaseUrl ? '<base href="' + snapshot.documentBaseUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' : ''
  return ['metadata', 'indexing', 'canonical'].includes(section)
    ? `<html lang="${language}"><head>${base}${selected.html}</head></html>`
    : `<html lang="${language}"><head>${base}</head><body>${selected.html}</body></html>`
}
