import { readFileSync } from 'node:fs'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAllChecks } from '@/lib/audit/checks'
import { ACCURACY_FIXTURE_DIR, type AccuracyHtmlFixture } from '@/lib/audit/accuracy-corpus'
import { classifyPublicGet } from './open-check'
import { previewImageResponse } from './checks/preview-image-response'

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
  const document = (url: string) => {
    const requestedUrl = new URL(url)
    const status =
      fixture.brokenLinks && DEMO_BROKEN_URLS.has(requestedUrl.toString()) ? 404 : 200
    const image = requestedUrl.toString() === new URL(meta.ogImage ?? '/missing-image', fixture.url).toString()
    return { statusCode: status, body: status === 404 ? 'Fixture destination missing' : image
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>'
      : '<html><body><p>Recorded fixture destination</p></body></html>',
      complete: true, headers: { 'content-type': image && status === 200 ? 'image/svg+xml' : 'text/html' } }
  }

  return runAllChecks(
    fixture.url,
    meta,
    null,
    null,
    NO_CONSOLE,
    undefined,
    undefined,
    NO_HEADERS,
    undefined, false, undefined, { destinations: {
      openDestination: async (url, options) => {
        const response = document(url)
        return { url, status: response.statusCode, ...classifyPublicGet({ status: response.statusCode,
          finalUrl: url, requestedUrl: url, html: response.body, wwwAuthenticate: null, cfMitigated: null,
          httpErrorsOnly: options?.httpErrorsOnly }) }
      },
      observeImage: async url => previewImageResponse(document(url)),
    } },
  )
}
