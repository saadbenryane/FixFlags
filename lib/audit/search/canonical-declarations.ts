import type { CheerioAPI } from 'cheerio'
import { htmlDocumentBase, isInertHtmlNode } from '../html-document'
import { CANONICAL_HEAD_SELECTOR } from './definitions'

function* linkValues(header: string) {
  let start = 0, inTarget = false, quoted = false
  for (let index = 0; index < header.length; index++) {
    const character = header[index]
    if (inTarget) {
      if (character === '>') inTarget = false
    } else if (quoted) {
      if (character === '\\') index++
      else if (character === '"') quoted = false
    } else if (character === '<') inTarget = true
    else if (character === '"') quoted = true
    else if (character === ',') { yield header.slice(start, index); start = index + 1 }
  }
  yield header.slice(start)
}

function linkParameters(value: string) {
  const parameters = new Map<string, string | null>()
  const parameter = /[ \t]*;[ \t]*([!#$%&'*+.^_\x60|~0-9A-Za-z-]+)[ \t]*(?:=[ \t]*(?:([!#$%&'*+.^_\x60|~0-9A-Za-z-]+)|"((?:[^"\\\r\n]|\\[^\r\n])*)"))?[ \t]*/y
  while (parameter.lastIndex < value.length) {
    const match = parameter.exec(value)
    if (!match) return null
    const name = match[1].toLowerCase()
    const parsed = match[2] ?? match[3]?.replace(/\\(.)/g, '$1') ?? null
    if (name === 'anchor' && parameters.has(name) && parameters.get(name) !== parsed) return null
    if (!parameters.has(name)) parameters.set(name, parsed)
  }
  return parameters
}

/** HTML declarations use the active document base. HTTP Link headers use the response URL. */
export function canonicalDeclarations($: CheerioAPI | null, pageUrl: string, linkHeader?: string) {
  const values: Array<{ raw: string; base: string; source: 'html' | 'http' }> = []
  if ($) {
    const base = htmlDocumentBase($, pageUrl)
    $(CANONICAL_HEAD_SELECTOR).each((_, node) => {
      if (!isInertHtmlNode(node)) values.push({ raw: $(node).attr('href') ?? '', base, source: 'html' })
    })
  }
  let headersComplete = true
  for (const member of linkValues(linkHeader ?? '')) {
    const value = member.trim()
    if (!value) continue
    const match = /^<([^<>]*)>[ \t]*(.*)$/.exec(value)
    const parameters = match ? linkParameters(match[2]) : null
    if (!match || !parameters) { headersComplete = false; continue }
    if (!parameters.get('rel')?.toLowerCase().split(/[ \t]+/).includes('canonical')) continue
    const anchor = parameters.get('anchor')
    if (anchor !== undefined) {
      try {
        if (anchor === null || /[ \t]/.test(anchor)) throw new Error('invalid anchor')
        if (new URL(anchor, pageUrl).href !== new URL(pageUrl).href) continue
      } catch { headersComplete = false; continue }
    }
    values.push({ raw: match[1], base: pageUrl, source: 'http' })
  }
  const declarations = values.map(({ raw, base, source }) => {
    try {
      if (source === 'html' ? !raw.trim() : /[ \t]/.test(raw)) throw new Error('invalid canonical reference')
      const target = new URL(raw, base)
      if (!['http:', 'https:'].includes(target.protocol) || target.hash || target.username || target.password) throw new Error('invalid canonical')
      return { raw, url: target.href }
    } catch { return { raw, url: null } }
  })
  return { declarations, headersComplete }
}
