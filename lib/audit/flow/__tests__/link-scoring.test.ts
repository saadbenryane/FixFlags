import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { isSameSiteOrigin, normalizeSiteHost, scoreCtaLink } from '@/lib/audit/flow/link-scoring'
import { scoreCtaCandidates } from '@/lib/audit/flow/score-cta-candidates'

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

it('recognizes visible purchase actions as primary controls rather than declaring no CTA', () => {
  assert.equal(scoreCtaLink('/checkout', 'Buy now'), 95)
  assert.equal(scoreCtaLink('', 'Add to cart'), 95)
})

it('discovers subscription entry links and buttons without selecting unsubscribe or mail actions', () => {
  const candidates = scoreCtaCandidates('https://example.com/', [
    { idx: 0, tag: 'a', text: 'Subscribe', href: '/offer' },
    { idx: 1, tag: 'button', text: 'Subscribe', href: null },
    { idx: 2, tag: 'a', text: 'Unsubscribe', href: '/preferences' },
    { idx: 3, tag: 'a', text: 'Subscribe', href: 'mailto:help@example.com' },
  ])
  assert.deepEqual(candidates.map(({ idx, score }) => ({ idx, score })), [{ idx: 0, score: 95 }, { idx: 1, score: 95 }])
})
