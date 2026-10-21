import { describe, expect, it } from 'vitest'
import { siteVerification } from '../site-verification'

describe('optional search ownership metadata', () => {
  it('keeps ownership metadata absent until supplied', () => {
    expect(siteVerification({})).toEqual({})
    expect(siteVerification({ GOOGLE_SITE_VERIFICATION: ' ', BING_SITE_VERIFICATION: 'bad\ntoken' })).toEqual({})
  })
  it('retains Google and Bing tokens independently', () => {
    expect(siteVerification({ GOOGLE_SITE_VERIFICATION: ' google-token ', BING_SITE_VERIFICATION: ' bing-token ' })).toEqual({
      google: 'google-token', other: { 'msvalidate.01': 'bing-token' },
    })
  })
})
