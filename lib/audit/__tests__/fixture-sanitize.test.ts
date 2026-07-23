import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { curateAccuracyFixtureHtml, sanitizeFixtureHtml } from '../fixture-sanitize'

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

describe('curateAccuracyFixtureHtml', () => {
  it('keeps semantic visible regions and removes executable or hidden payloads', () => {
    const curated = curateAccuracyFixtureHtml(`
      <html lang="en"><head><title>Product</title><script>secret()</script></head>
      <body>
        <div hidden><button>Hidden</button></div>
        <header><a href="/">Home</a></header>
        <main><h1>Ship better</h1><button aria-label="Start">Go</button></main>
        <script type="application/json">large payload</script>
      </body></html>
    `)

    assert.match(curated, /<title>Product<\/title>/)
    assert.match(curated, /<h1>Ship better<\/h1>/)
    assert.match(curated, /aria-label="Start"/)
    assert.doesNotMatch(curated, /secret\(\)/)
    assert.doesNotMatch(curated, /Hidden/)
    assert.doesNotMatch(curated, /large payload/)
  })
})
