import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { detectSocialProofSlop } from '@/lib/audit/checks/slop'

describe('detectSocialProofSlop', () => {
  it('flags unverifiable member counts', () => {
    assert.equal(
      detectSocialProofSlop('Trusted by 10,000+ teams worldwide'),
      'unverifiable member count'
    )
  })

  it('flags unverifiable customer counts', () => {
    assert.equal(
      detectSocialProofSlop('Join 10,000+ happy customers'),
      'unverifiable customer count'
    )
  })

  it('flags template testimonial attribution', () => {
    assert.equal(detectSocialProofSlop('CEO, Company Name'), 'template testimonial attribution')
  })

  it('passes clean copy', () => {
    assert.equal(detectSocialProofSlop('Used by teams at Acme Corp and Globex.'), null)
  })
})
