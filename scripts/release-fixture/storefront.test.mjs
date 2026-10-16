import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pricingResponse, storefrontContent } from './storefront.mjs'

describe('controlled published repair website', () => {
  it('defaults to a labelled, nonmutating search and reachable pricing', () => {
    const content = storefrontContent({})
    assert.match(content, /<label>Find equipment<input type="search"/)
    assert.match(content, /<button type="submit">Search equipment<\/button>/)
    assert.match(content, /method="get" action="\/search"/)
    assert.equal(pricingResponse({}).status, 200)
  })
  it('independently exposes the declared accessibility and destination failures', () => {
    const content = storefrontContent({ unlabelledSearch: true })
    assert.match(content, /<input type="search" name="q" required><button type="submit"><\/button>/)
    assert.equal(pricingResponse({ brokenPricing: true }).status, 404)
    assert.equal(pricingResponse({ unlabelledSearch: true }).status, 200)
    assert.equal(storefrontContent({ brokenPricing: true }), storefrontContent({}))
  })
})
