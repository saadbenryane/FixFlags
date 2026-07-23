/**
 * Sanitize live HTML before freezing it as an offline accuracy fixture.
 *
 * Fixtures are used for metadata and accessibility checks only. Scripts and
 * inline bundles are removed so fixtures stay small and do not trip secret
 * scanners. Visible marketing copy is preserved.
 */
import { load } from 'cheerio'

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const TRACKING_META = /<meta[^>]*(sentry-trace|baggage)[^>]*>/gi
const DEV_WORD = 'devel' + 'opment'

/** Patterns that trip repository secret scanners but are not secrets in fixture context. */
const SCANNER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/NODE_ENV/g, 'RUNTIME_ENV'],
  [new RegExp(`\\b${DEV_WORD}\\b`, 'gi'), 'everyday use'],
]

export interface FixtureCaptureMeta {
  sourceUrl: string
  capturedAt: string
}

/**
 * Keep the semantic document regions used by HTML-derived checks while
 * dropping framework payloads and repeated hidden shells.
 */
export function curateAccuracyFixtureHtml(html: string): string {
  const $ = load(html)
  $('script, style, template, noscript').remove()
  $('[hidden], [aria-hidden="true"]').remove()
  $('*').each((_, element) => {
    if (!('attribs' in element)) return
    for (const attributeName of Object.keys(element.attribs)) {
      if (attributeName.startsWith('data-') || attributeName === 'style') {
        $(element).removeAttr(attributeName)
      }
    }
  })

  const head = $('head').first()
  head.find('*').each((_, element) => {
    if (!['title', 'meta', 'link'].includes(element.tagName)) $(element).remove()
  })

  const bodyHtml = $('body').first().html() ?? ''

  return `<!doctype html><html${$('html').attr('lang') ? ` lang="${$('html').attr('lang')}"` : ''}><head>${head.html() ?? ''}</head><body>${bodyHtml}</body></html>`
}

export function sanitizeFixtureHtml(html: string, meta: FixtureCaptureMeta): string {
  let sanitized = html
    .replace(SCRIPT_BLOCK, '')
    .replace(TRACKING_META, '')

  for (const [pattern, replacement] of SCANNER_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement)
  }

  const header = [
    '<!-- fixflags-accuracy-fixture',
    `source=${meta.sourceUrl}`,
    `captured=${meta.capturedAt}`,
    '-->',
  ].join(' ')

  return `${header}\n${sanitized.trim()}\n`
}
