import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { isSameSiteOrigin, normalizeSiteHost } from '@/lib/audit/flow/link-scoring'

describe('isSameSiteOrigin', () => {
  it('treats www and apex as the same site', () => {
    assert.equal(
      isSameSiteOrigin('https://1health.ae', 'https://www.1health.ae/pricing'),
      true
    )
    assert.equal(
      isSameSiteOrigin('https://www.example.com', 'https://example.com/signup'),
      true
    )
  })

  it('returns false for different registrable domains', () => {
    assert.equal(isSameSiteOrigin('https://example.com', 'https://other.com'), false)
  })
})

describe('normalizeSiteHost', () => {
  it('strips www prefix', () => {
    assert.equal(normalizeSiteHost('WWW.Example.COM'), 'example.com')
  })
})
