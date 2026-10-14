import type { Page } from 'playwright'
import { METADATA_MARKUP_TOKENS } from '../metadata-markup-signals'

export const RENDERED_HTML_LIMIT = 1_000_000

/** Inspect the complete DOM within the existing transport/parser bound. Script
 * implementation text directly in head/body is inert to metadata parsing except for registered markup
 * signals. Preserve those signals, script attributes, styles and JSON-LD. */
export async function collectRenderedHtml(page: Page) {
  return page.evaluate(({ limit, tokens }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
    const encoder = new TextEncoder()
    const withinBudget = (html: string) => html.length <= limit && encoder.encode(html).byteLength <= limit
    const html = document.documentElement.outerHTML
    if (withinBudget(html)) return { html, truncated: false, compacted: false, finalUrl: location.href }
    const scripts = [...document.scripts].filter(script =>
      (script.parentElement === document.head || script.parentElement === document.body) &&
      script.getAttribute('type') !== 'application/ld+json')
    const removableBytes = scripts.reduce((total, script) => total + encoder.encode(script.textContent ?? '').byteLength, 0)
    // An oversized DOM cannot become complete by dropping script text. Do not
    // clone or emit a truncated page whose missing controls could look healthy.
    if (encoder.encode(html).byteLength - removableBytes > limit)
      return { html: null, truncated: true, compacted: false, finalUrl: location.href }
    // A document without a browsing context has no active custom-element
    // registry. Cloning live custom elements could execute their constructors.
    const inert = document.implementation.createHTMLDocument('')
    inert.documentElement.innerHTML = html
    for (const attribute of document.documentElement.attributes)
      inert.documentElement.setAttribute(attribute.name, attribute.value)
    const clone = inert.documentElement
    for (const script of clone.querySelectorAll('head > script, body > script')) {
      if (script.getAttribute('type') === 'application/ld+json') continue
      const content = (script.textContent ?? '').toLowerCase()
      script.textContent = tokens.filter(token => content.includes(token)).join('\n')
    }
    const compact = clone.outerHTML
    const complete = withinBudget(compact)
    return { html: complete ? compact : null, truncated: !complete, compacted: true, finalUrl: location.href }
  }, { limit: RENDERED_HTML_LIMIT, tokens: METADATA_MARKUP_TOKENS })
}
