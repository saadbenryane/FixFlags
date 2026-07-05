import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { mergeRuntimeHeadMetadata, parseMetadataFromHtml } from '@/lib/audit/metadata'
import { ALL_CHECK_IDS, CHECK_ID_COUNT } from '@/lib/audit/check-ids'

const BASE_URL = 'https://example.com'

describe('parseMetadataFromHtml', () => {
  it('extracts head tags, landmarks, and CTA text from HTML', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>FixFlags - Finish what your AI started</title>
  <meta name="description" content="Paste any public URL and get Flags across message, experience, and reach, with copy-ready fix prompts for your AI coding agent." />
  <meta property="og:title" content="FixFlags" />
  <meta property="og:description" content="Audits in 60 seconds" />
  <meta property="og:image" content="https://example.com/og.png" />
  <link rel="canonical" href="https://example.com/" />
  <link rel="icon" href="/favicon.ico" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script type="application/ld+json">{"@type":"WebSite"}</script>
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <nav><a href="/">Home</a></nav>
  <main id="main">
    <h1>Finish what your AI started</h1>
    <button>Get started free</button>
    <img src="/hero.png" alt="Screenshot" />
    <img src="/decorative.png" alt="" />
    <a href="https://external.com">Partner</a>
    <a href="/privacy">Privacy policy</a>
    <a href="mailto:hello@example.com">Email us</a>
  </main>
</body>
</html>`

    const meta = parseMetadataFromHtml(html, BASE_URL)

    assert.equal(meta.title, 'FixFlags - Finish what your AI started')
    assert.ok((meta.description?.length ?? 0) >= 50)
    assert.equal(meta.ogImage, 'https://example.com/og.png')
    assert.equal(meta.hasFavicon, true)
    assert.equal(meta.hasSkipLink, true)
    assert.equal(meta.navLandmarkCount, 1)
    assert.equal(meta.h1s.length, 1)
    assert.equal(meta.hasStructuredData, true)
    assert.equal(meta.hasPrivacyPolicy, true)
    assert.equal(meta.hasContactInfo, true)
    assert.equal(meta.imagesWithoutAlt, 0)
    assert.ok(meta.ctaTexts.some((t) => t.toLowerCase().includes('get started')))
  })

  it('detects missing favicon, skip link, and accessibility gaps', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Welcome home page title here</title></head>
<body>
  <nav><a href="/">Home</a><a href="/about">About</a></nav>
  <h1>Welcome to our site</h1>
  <img src="/logo.png" />
  <input type="email" />
  <button aria-label="Menu"></button>
  <a href="https://other.com"></a>
  <iframe src="https://embed.com"></iframe>
  <div tabindex="5">Bad tab order</div>
</body>
</html>`

    const meta = parseMetadataFromHtml(html, BASE_URL)

    assert.equal(meta.hasFavicon, false)
    assert.equal(meta.hasSkipLink, false)
    assert.equal(meta.navLandmarkCount, 1)
    assert.equal(meta.lang, null)
    assert.equal(meta.imagesWithoutAlt, 1)
    assert.equal(meta.inputsWithoutLabel, 1)
    assert.equal(meta.linksWithoutText, 1)
    assert.equal(meta.iframesWithoutTitle, 1)
    assert.equal(meta.positiveTabindex, 1)
    assert.equal(meta.externalLinksWithoutNoopener, 1)
    assert.equal(meta.ctaTexts.length, 0)
  })

  it('detects analytics without cookie consent', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Analytics test page title here</title></head>
<body>
  <script>gtag('config', 'G-123');</script>
  <a href="/privacy">Privacy</a>
  contact@example.com
</body>
</html>`

    const meta = parseMetadataFromHtml(html, BASE_URL)
    assert.equal(meta.hasAnalytics, true)
    assert.equal(meta.hasCookieConsent, false)
    assert.equal(meta.hasPrivacyPolicy, true)
  })

  it('detects search/URL input fields as CTAs on tool landing pages', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Website Analyzer</title></head>
<body>
  <main>
    <h1>Analyze your site</h1>
    <form>
      <input type="url" placeholder="Enter your website URL" />
      <button type="submit">Analyze</button>
    </form>
    <a href="/pricing">Pricing</a>
  </main>
</body>
</html>`

    const meta = parseMetadataFromHtml(html, BASE_URL)
    assert.ok(meta.ctaTexts.some((t) => t.toLowerCase().includes('enter your website url')))
  })

  it('uses runtime head metadata when client rendering fills a missing title', () => {
    const html = `<!DOCTYPE html>
<html>
<head><meta name="description" content="Server description that should remain available." /></head>
<body><h1>Loaded app</h1></body>
</html>`

    const meta = mergeRuntimeHeadMetadata(parseMetadataFromHtml(html, BASE_URL), {
      title: 'Runtime title from the hydrated app',
      hasFavicon: true,
    })

    assert.equal(meta.title, 'Runtime title from the hydrated app')
    assert.equal(meta.description, 'Server description that should remain available.')
    assert.equal(meta.hasFavicon, true)
  })
})

describe('check registry parity', () => {
  it('matches exported check id count', () => {
    assert.equal(ALL_CHECK_IDS.length, CHECK_ID_COUNT)
    assert.equal(new Set(ALL_CHECK_IDS).size, CHECK_ID_COUNT)
  })
})
