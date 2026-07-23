import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { sanitizeFixtureHtml } from '../fixture-sanitize'

describe('sanitizeFixtureHtml', () => {
  it('strips scripts and tracking meta while preserving body copy', () => {
    const html = `<html><head>
      <meta name="sentry-trace" content="abc" />
      <script>window.NODE_ENV="production"</script>
    </head><body><h1>Hello</h1></body></html>`
    const out = sanitizeFixtureHtml(html, {
      sourceUrl: 'https://example.com',
      capturedAt: '2026-07-23T00:00:00.000Z',
    })

    assert.match(out, /fixflags-accuracy-fixture/)
    assert.match(out, /source=https:\/\/example\.com/)
    assert.doesNotMatch(out, /<script/i)
    assert.doesNotMatch(out, /sentry-trace/)
    assert.match(out, /<h1>Hello<\/h1>/)
  })
})
