import { load, type CheerioAPI } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'

/** Public scripting-enabled interpretation excludes dormant document fragments.
 * Keep the collected source intact and remove these only from the parsed view. */
export function parseActiveHtmlDocument(html: string): { document: CheerioAPI; source: string } {
  const document = load(html, { sourceCodeLocationInfo: true })
  const ranges = document('template, noscript').toArray().filter(element => !isInertHtmlNode(element))
    .map(element => {
      if (element.startIndex === null || element.endIndex === null) throw new Error('Inactive HTML scope is unavailable')
      return { start: element.startIndex, end: element.endIndex }
    }).sort((left, right) => left.start - right.start)
  // Embedded RDF parsers also need the original document or fragment shape.
  // DOM serialization adds implicit roots that can change the entity subject.
  const parts: string[] = []
  let offset = 0
  for (const range of ranges) {
    if (range.start < offset) continue
    parts.push(html.slice(offset, range.start)); offset = range.end
  }
  parts.push(html.slice(offset))
  document('template, noscript').remove()
  return { document, source: parts.join('') }
}

export function isInertHtmlNode(element: AnyNode): boolean {
  // Template document fragments retain a parent boundary outside Cheerio's selectors.
  for (let parent = element.parent; parent; parent = parent.parent) {
    if ('name' in parent && (parent.name === 'template' || parent.name === 'noscript')) return true
  }
  return false
}

/** HTML ID references are literal and resolve to the first active document
 * element. They are never CSS selectors, and template contents are not targets. */
export function htmlDocumentIds($: CheerioAPI): ReadonlyMap<string, Element> {
  const ids = new Map<string, Element>()
  $('[id]').each((_, element) => {
    const id = $(element).attr('id')!
    if (!isInertHtmlNode(element) && !ids.has(id)) ids.set(id, element)
  })
  return ids
}

/** Use the scripting-enabled document, before crawler fallback content is unwrapped. */
export function htmlDocumentBase($: CheerioAPI, pageUrl: string): string {
  const element = $('base[href]').toArray().find(element => !isInertHtmlNode(element))
  const declared = element ? $(element).attr('href') : undefined
  try { return declared ? new URL(declared, pageUrl).href : pageUrl }
  catch { return pageUrl }
}
