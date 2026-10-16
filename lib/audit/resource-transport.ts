import type { CheerioAPI } from 'cheerio'
import { z } from 'zod'
import { htmlDocumentBase, isInertHtmlNode } from './html-document'

const MAX_REFERENCES = 2000
const MAX_INSECURE = 200
export const resourceTransportSchema = z.object({
  version: z.literal(1), complete: z.boolean(), inspected: z.number().int().nonnegative().max(MAX_REFERENCES),
  insecure: z.array(z.object({ kind: z.string().max(40), url: z.string().url().max(2000) }).strict()).max(MAX_INSECURE),
}).strict()
export type ResourceTransport = z.infer<typeof resourceTransportSchema>
export const RESOURCE_TRANSPORT_SCOPE = 'Inspects resource URLs declared in this HTML, including responsive candidates. CSS contents, JavaScript-created requests, nested documents and actual browser delivery are outside this observation.'

/** Read URL tokens before descriptors. Commas inside data URLs are not separators. */
function srcsetUrls(value: string): string[] {
  const urls: string[] = []
  let position = 0
  while (position < value.length && urls.length <= MAX_REFERENCES) {
    while (/[\t\n\f\r ,]/.test(value[position] ?? '') && position < value.length) position++
    const start = position
    while (position < value.length && !/[\t\n\f\r ]/.test(value[position])) position++
    const url = value.slice(start, position)
    if (!url) break
    if (url.endsWith(',')) {
      urls.push(url.replace(/,+$/, ''))
      continue
    }
    const descriptorStart = position
    let parentheses = 0
    while (position < value.length) {
      const char = value[position]
      if (char === '(') parentheses++
      if (char === ')') parentheses = Math.max(0, parentheses - 1)
      if (char === ',' && parentheses === 0) break
      position++
    }
    const descriptors = value.slice(descriptorStart, position).trim().split(/\s+/).filter(Boolean)
    position++
    const valid = descriptors.length === 0 || descriptors.length === 1 &&
      (/^[1-9]\d*w$/.test(descriptors[0]) || /^(?:\d+(?:\.\d+)?|\.\d+)x$/.test(descriptors[0]) && parseFloat(descriptors[0]) > 0)
    if (valid) urls.push(url)
  }
  return urls
}

/** No fetches. Preserve a bounded, redacted inventory from the collected HTML. */
export function collectResourceTransport($: CheerioAPI, pageUrl: string): ResourceTransport {
  const result: ResourceTransport = { version: 1, complete: true, inspected: 0, insecure: [] }
  const base = htmlDocumentBase($, pageUrl)
  const seen = new Set<string>()
  const add = (value: string | undefined, kind: string) => {
    if (!value?.trim()) return
    if (result.inspected >= MAX_REFERENCES) { result.complete = false; return }
    result.inspected++
    let target: URL
    try { target = new URL(value, base) } catch { result.complete = false; return }
    if (target.protocol !== 'http:') return
    // Secure Contexts treats loopback and localhost URLs as potentially trustworthy.
    if (target.hostname === 'localhost' || target.hostname.endsWith('.localhost') ||
      /^127\./.test(target.hostname) || target.hostname === '[::1]') return
    target.username = ''; target.password = ''; target.search = ''; target.hash = ''
    const url = target.href
    if (url.length > 2000) { result.complete = false; return }
    const identity = kind + ':' + url
    if (seen.has(identity)) return
    seen.add(identity)
    if (result.insecure.length >= MAX_INSECURE) { result.complete = false; return }
    result.insecure.push({ kind, url })
  }
  $('script[src], link[href], link[imagesrcset], img, iframe[src], audio[src], video, source, track[src], embed[src], object[data], input[type="image"][src]').each((_, element) => {
    if (result.inspected >= MAX_REFERENCES) { result.complete = false; return false }
    const node = $(element)
    if (isInertHtmlNode(element)) return
    const tag = element.tagName.toLowerCase()
    if (tag === 'script' && node.attr('type') && !/^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attr('type')!.split(';')[0].trim())) return
    if (tag === 'source' && !node.parent().is('picture, audio, video')) return
    if (tag === 'link') {
      const rel = (node.attr('rel') ?? '').toLowerCase().split(/\s+/)
      if (!rel.some(token => ['stylesheet', 'icon', 'preload', 'modulepreload'].includes(token))) return
      add(node.attr('href'), rel.includes('stylesheet') ? 'stylesheet' : 'link-resource')
      if (rel.includes('preload')) for (const candidate of srcsetUrls(node.attr('imagesrcset') ?? '')) add(candidate, 'image-candidate')
    } else {
      add(node.attr(tag === 'object' ? 'data' : 'src'), tag)
      if (tag === 'video') add(node.attr('poster'), 'poster')
      if (tag === 'img' || tag === 'source' && node.parent().is('picture'))
        for (const candidate of srcsetUrls(node.attr('srcset') ?? '')) add(candidate, 'image-candidate')
    }
  })
  return result
}

/** Historical metadata can reveal an image failure, but cannot prove broad coverage. */
export function observedInsecureResources(metadata: { resourceTransport?: ResourceTransport; images: Array<{ src: string }> }, pageUrl: string) {
  if (metadata.resourceTransport) return metadata.resourceTransport.insecure
  return metadata.images.flatMap(image => {
    try {
      const target = new URL(image.src, pageUrl)
      if (target.protocol !== 'http:') return []
      target.username = ''; target.password = ''; target.search = ''; target.hash = ''
      return [{ kind: 'img', url: target.href }]
    } catch { return [] }
  })
}
