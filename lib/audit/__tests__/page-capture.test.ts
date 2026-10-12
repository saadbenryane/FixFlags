import { describe, expect, it } from 'vitest'
import { isBotInterstitialPage, isBotInterstitialDocument, pageCaptureFailureFromError, PageCaptureError } from '@/lib/audit/browser/page-capture'

describe('isBotInterstitialPage', () => {
  it('treats Cloudflare challenge headers as a block', () => {
    expect(isBotInterstitialPage({ cfMitigated: 'challenge' })).toBe(true)
    expect(isBotInterstitialPage({ cfMitigated: ' Challenge ' })).toBe(true)
  })

  it('treats Cloudflare interstitial titles as a block', () => {
    expect(isBotInterstitialPage({ title: 'Just a moment...' })).toBe(true)
    expect(isBotInterstitialPage({ title: 'Attention Required! | Cloudflare' })).toBe(true)
  })

  it('does not treat a real Product page with Turnstile as a block', () => {
    expect(
      isBotInterstitialPage({
        title: 'Saad Benryane | I build products, brands, and companies',
      })
    ).toBe(false)
    expect(isBotInterstitialPage({ title: '', cfMitigated: null })).toBe(false)
  })
})

describe('public document challenge evidence', () => {
  it('does not confuse ordinary Cloudflare, CAPTCHA resources or quoted examples with a wall', () => {
    expect(isBotInterstitialDocument({ status: 200, headers: { server: 'cloudflare' }, body:
      '<title>Sign up</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>' +
      '<script>const example="<h1>Access denied</h1>"</script><main><h1>Sign up</h1><p>Our CAPTCHA prevents spam.</p><div class="cf-turnstile"></div></main>' })).toBe(false)
  })
  it('recognizes explicit mitigation headers and challenge documents at HTTP 200', () => {
    for (const body of ['<title>Just a moment...</title>', '<h1>Verify you are human</h1>'])
      expect(isBotInterstitialDocument({ status: 200, headers: {}, body })).toBe(true)
    expect(isBotInterstitialDocument({ status: 200, headers: { 'cf-mitigated': 'challenge' }, body: '' })).toBe(true)
  })
  it('keeps real server errors distinct from access challenge responses', () => {
    expect(isBotInterstitialDocument({ status: 503, headers: {}, body: '<h1>Service unavailable</h1><footer>Cloudflare</footer>' })).toBe(false)
    expect(isBotInterstitialDocument({ status: 403, headers: {}, body: 'Checking your browser before accessing' })).toBe(true)
    expect(isBotInterstitialDocument({ status: 403, headers: {}, body: 'Forbidden' })).toBe(false)
  })
})

describe('pageCaptureFailureFromError', () => {
  it('preserves structured PageCaptureError codes', () => {
    const err = new PageCaptureError('blocked', {
      code: 'HTTP_FORBIDDEN',
      httpStatus: 403,
      finalUrl: 'https://example.com',
    })
    expect(pageCaptureFailureFromError('desktop', err)).toMatchObject({
      device: 'desktop',
      code: 'HTTP_FORBIDDEN',
      httpStatus: 403,
    })
  })
})
