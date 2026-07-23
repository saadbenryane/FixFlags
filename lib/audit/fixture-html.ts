import { readFileSync } from 'node:fs'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAllChecks } from '@/lib/audit/checks'
import { ACCURACY_FIXTURE_DIR, type AccuracyHtmlFixture } from '@/lib/audit/accuracy-corpus'

const NO_CONSOLE: Array<{ type: string; text: string }> = []
const NO_HEADERS: Record<string, string> = {}

const DEMO_BROKEN_URLS = new Set([
  'https://fixflags.com/contact',
  'https://fixflags.com/get-started',
  'https://fixflags.com/og.png',
])

export function runAccuracyFixtureChecks(fixture: Pick<AccuracyHtmlFixture, 'file' | 'url' | 'brokenLinks'>) {
  const html = readFileSync(`${ACCURACY_FIXTURE_DIR}/${fixture.file}`, 'utf-8')
  const meta = parseMetadataFromHtml(html, fixture.url)
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const requestedUrl = new URL(input instanceof Request ? input.url : input.toString())
    const status =
      fixture.brokenLinks && DEMO_BROKEN_URLS.has(requestedUrl.toString()) ? 404 : 200
    return new Response('', { status })
  }) as typeof fetch

  return runAllChecks(
    fixture.url,
    meta,
    null,
    null,
    NO_CONSOLE,
    undefined,
    undefined,
    NO_HEADERS
  ).finally(() => {
    globalThis.fetch = originalFetch
  })
}
