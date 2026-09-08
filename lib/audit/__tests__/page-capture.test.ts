import { describe, expect, it } from 'vitest'
import { isBotInterstitialPage, pageCaptureFailureFromError, PageCaptureError } from '@/lib/audit/browser/page-capture'

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
