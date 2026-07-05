import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { urlsMeaningfullyChanged, isSamePageHashHref } from '../flow-url'

describe('urlsMeaningfullyChanged', () => {
  it('detects a cross-origin navigation even when the path coincidentally matches', () => {
    // Regression test: before this fix, urlsMeaningfullyChanged only compared
    // pathname/search/hash, so a CTA click that navigated to a totally different
    // domain sharing the same path (e.g. both sites happen to use "/" or
    // "/pricing") was reported as "no meaningful change" - silently skipping
    // destination-trust and destination-UX probing for a real cross-origin jump.
    assert.equal(urlsMeaningfullyChanged('https://example.com/', 'https://partner.com/'), true)
    assert.equal(
      urlsMeaningfullyChanged('https://example.com/pricing', 'https://other.com/pricing'),
      true
    )
  })

  it('detects a pathname change on the same origin', () => {
    assert.equal(
      urlsMeaningfullyChanged('https://example.com/', 'https://example.com/signup'),
      true
    )
  })

  it('detects a query-string change on the same origin and path', () => {
    assert.equal(
      urlsMeaningfullyChanged('https://example.com/search', 'https://example.com/search?q=x'),
      true
    )
  })

  it('detects a hash change on the same origin and path', () => {
    assert.equal(
      urlsMeaningfullyChanged('https://example.com/#top', 'https://example.com/#pricing'),
      true
    )
  })

  it('reports no meaningful change for an identical URL', () => {
    assert.equal(
      urlsMeaningfullyChanged('https://example.com/pricing', 'https://example.com/pricing'),
      false
    )
  })

  it('falls back to strict string comparison when either URL fails to parse', () => {
    assert.equal(urlsMeaningfullyChanged('not-a-url', 'not-a-url'), false)
    assert.equal(urlsMeaningfullyChanged('not-a-url', 'still-not-a-url'), true)
  })
})

describe('isSamePageHashHref', () => {
  it('accepts a real hash fragment', () => {
    assert.equal(isSamePageHashHref('#pricing'), true)
  })

  it('rejects a bare hash, null, undefined, or a full URL', () => {
    assert.equal(isSamePageHashHref('#'), false)
    assert.equal(isSamePageHashHref(null), false)
    assert.equal(isSamePageHashHref(undefined), false)
    assert.equal(isSamePageHashHref('https://example.com/#pricing'), false)
  })
})
