import { describe, expect, it } from 'vitest'
import { document, PAGE } from '../search/__tests__/fixtures'
import { readPublicPagePreview } from './public-page-preview'

describe('public link preview head', () => {
  it('reads the first declared head value and ignores dormant and body metadata', () => {
    const html = '<head><template><meta property="og:title" content="Dormant"></template>' +
      '<meta property="OG:TITLE" content="One &amp; two"><meta property="og:title" content="Later"></head>' +
      '<body><meta property="og:description" content="Body copy"></body>'
    expect(readPublicPagePreview(document(html))).toMatchObject({
      scope: { pageUrl: PAGE, finalUrl: PAGE, access: 'public' }, ogTitle: 'One & two', ogDescription: null,
    })
  })

  it('accepts a closed head from a truncated response, but not a closing tag inside a script', () => {
    const head = '<head><meta property="og:title" content="Public title">'
    expect(readPublicPagePreview(document(head + '</head><body>', { complete: false }))).toMatchObject({ ogTitle: 'Public title' })
    expect(readPublicPagePreview(document(head + '<script>const tag = "</head>";', { complete: false }))).toBeUndefined()
    expect(readPublicPagePreview(document(head + '<script>/*' + 'x'.repeat(70_000) + '*/</script></head>'))).toBeUndefined()
  })

  it('keeps an oversized first value unknown without losing its sibling', () => {
    const html = `<head><meta property="og:title" content="${'x'.repeat(8001)}"><meta property="og:title" content="Later">` +
      '<meta property="og:description" content="Observed description"></head>'
    expect(readPublicPagePreview(document(html))).toMatchObject({ ogTitle: undefined, ogDescription: 'Observed description' })
  })

  it('keeps the first image declaration across aliases and resolves its base from the response head', () => {
    const html = '<head><base href="/assets/"><meta property="og:image:url" content="first.png?key=a&amp;mode=2">' +
      '<meta property="og:image:secure_url" content="https://example.com/other.png">' +
      '<meta property="og:image" content="later.png"></head><body><base href="/body/"></body>'
    expect(readPublicPagePreview(document(html, { finalUrl: PAGE + 'canonical/' }))).toMatchObject({
      scope: { pageUrl: PAGE, finalUrl: PAGE + 'canonical/' }, ogImage: 'first.png?key=a&mode=2', linkBaseUrl: PAGE + 'assets/',
    })
  })

  it('refuses non-HTML, partial statuses, challenges and sign-in', () => {
    const html = '<head><meta property="og:title" content="Unqualified response"></head>'
    for (const overrides of [{ status: 206 }, { status: 503 }, { reason: 'public_sign_in_redirect' },
      { headers: { 'content-type': 'text/html', 'cf-mitigated': 'challenge' } }, { headers: { 'content-type': 'text/plain' } }]) {
      expect(readPublicPagePreview(document(html, overrides))).toBeUndefined()
    }
  })
})
