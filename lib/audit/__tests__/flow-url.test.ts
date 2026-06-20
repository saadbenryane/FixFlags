import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSamePageHashHref, urlsMeaningfullyChanged } from '@/lib/audit/flow/flow-url'

describe('flow-url', () => {
  it('detects hash-only CTA hrefs', () => {
    assert.equal(isSamePageHashHref('#signup'), true)
    assert.equal(isSamePageHashHref('#'), false)
    assert.equal(isSamePageHashHref('/pricing'), false)
    assert.equal(isSamePageHashHref(null), false)
  })

  it('treats hash changes as meaningful navigation', () => {
    assert.equal(
      urlsMeaningfullyChanged('https://example.com/page', 'https://example.com/page#signup'),
      true
    )
  })
})
