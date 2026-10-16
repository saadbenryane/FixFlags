import type { CheerioAPI } from 'cheerio'
import { htmlDocumentBase, isInertHtmlNode } from '../html-document'

/** HTML declarations use the active document base. HTTP Link headers use the response URL. */
export function canonicalDeclarations($: CheerioAPI, pageUrl: string, linkHeader?: string) {
  const base = htmlDocumentBase($, pageUrl)
  const values: Array<{ raw: string; base: string }> = []
  $('link[rel]').each((_, node) => {
    if (!isInertHtmlNode(node) && ($(node).attr('rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'))
      values.push({ raw: $(node).attr('href') ?? '', base })
  })
  for (const match of (linkHeader ?? '').matchAll(/<([^>]+)>\s*;[^,]*?rel\s*=\s*"?canonical"?/gi))
    values.push({ raw: match[1], base: pageUrl })
  return values.map(({ raw, base }) => {
    try {
      if (!raw.trim()) throw new Error('empty canonical')
      const target = new URL(raw, base)
      if (!['http:', 'https:'].includes(target.protocol) || target.hash || target.username || target.password) throw new Error('invalid canonical')
      return { raw, url: target.href }
    } catch { return { raw, url: null } }
  })
}
