import type { CheerioAPI } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'

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
