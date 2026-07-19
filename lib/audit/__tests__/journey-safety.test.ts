import { describe, expect, it } from 'vitest'
import { isBlockedPaymentUrl, isLikelyDownloadUrl } from '@/lib/audit/browser/journey-safety'

describe('journey-safety', () => {
  it('blocks payment hosts', () => {
    expect(isBlockedPaymentUrl('https://checkout.stripe.com/pay/cs_test')).toBe(true)
    expect(isBlockedPaymentUrl('https://example.com/pricing')).toBe(false)
  })

  it('blocks download URLs', () => {
    expect(isLikelyDownloadUrl('https://example.com/app.dmg')).toBe(true)
    expect(isLikelyDownloadUrl('https://example.com/pricing')).toBe(false)
  })
})
