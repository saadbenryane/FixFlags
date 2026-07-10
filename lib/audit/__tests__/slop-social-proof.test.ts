import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { detectSocialProofSlop } from '@/lib/audit/checks/slop'

describe('detectSocialProofSlop', () => {
  it('flags unverifiable member counts', () => {
    assert.deepEqual(
      detectSocialProofSlop('Trusted by 10,000+ teams worldwide'),
      { label: 'unverifiable member count', matched: 'Trusted by 10,000+ teams' }
    )
  })

  it('flags unverifiable customer counts', () => {
    assert.deepEqual(
      detectSocialProofSlop('Join 10,000+ happy customers'),
      { label: 'unverifiable customer count', matched: '10,000+ happy customers' }
    )
  })

  it('flags template testimonial attribution', () => {
    assert.deepEqual(
      detectSocialProofSlop('CEO, Company Name'),
      { label: 'template testimonial attribution', matched: 'CEO, Company Name' }
    )
  })

  it('passes clean copy', () => {
    assert.equal(detectSocialProofSlop('Used by teams at Acme Corp and Globex.'), null)
  })
})
