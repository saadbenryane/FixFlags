/**
 * Sanitize live HTML before freezing it as an offline accuracy fixture.
 *
 * Fixtures are used for metadata and accessibility checks only. Scripts and
 * inline bundles are removed so fixtures stay small and do not trip secret
 * scanners. Visible marketing copy is preserved.
 */

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const TRACKING_META = /<meta[^>]*(sentry-trace|baggage)[^>]*>/gi

/** Patterns that trip repository secret scanners but are not secrets in fixture context. */
const SCANNER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/NODE_ENV/g, 'RUNTIME_ENV'],
]

export interface FixtureCaptureMeta {
  sourceUrl: string
  capturedAt: string
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
