import { describe, expect, it } from 'vitest'
import { capturedPageLinks, publicLinkObservations, publicLinkUrls } from './public-links'
import { parseMetadataFromHtml } from '../metadata'
import type { OpenCheckResult } from '../open-check'
import { destinationContext } from './destination-evidence'

const page = 'https://example.com/'
function response(url: string, overrides: Partial<OpenCheckResult> = {}): OpenCheckResult {
  return { url, canonicalUrl: url, status: 200, finalUrl: url, outcome: 'reachable', evidence: 'Observed GET', shouldFlagDead: false, ...overrides }
}
describe('public link observations', () => {
  it('retains independent successful responses while untested links remain unknown', () => {
    const result = publicLinkObservations(page, [page + 'ready', page + 'missing'], [response(page + 'ready')])
    expect(result.complete).toBe(false)
    expect(result.assertions.map(item => [item.passed, item.complete])).toEqual([[true, true], [false, false]])
    expect(result.flags).toEqual([])
  })
  it('does not confuse successful transport with a successful page after a soft 404', () => {
    const result = publicLinkObservations(page, [page + 'gone'], [response(page + 'gone', { outcome: 'render_error', shouldFlagDead: true })])
    expect(result.flags[0].checkId).toBe('broken-internal-links')
    expect(result.assertions[0]).toMatchObject({ passed: false, complete: true })
  })
  it('retains query identity in scoped proof while redacting signed values from findings', () => {
    const url = page + 'gone?token=PRIVATE_VALUE'
    const result = publicLinkObservations(page, [url], [response(url, { status: 404, outcome: 'not_found', shouldFlagDead: true })])
    expect(result.flags[0].evidenceTargets?.[0].context).toBe(destinationContext(page, url))
    expect(result.assertions[0].context).toBe(destinationContext(page, url))
    expect(JSON.stringify(result)).not.toContain('PRIVATE_VALUE')
  })
  it('never substitutes an inventory-equivalent URL for the requested response', () => {
    const result = publicLinkObservations(page, [page + 'en/gone'], [response(page + 'gone')])
    expect(result.assertions[0]).toMatchObject({ passed: false, complete: false })
    expect(result.complete).toBe(false)
  })
  it('resolves relative links against the observed document after a redirect', () => {
    const metadata = parseMetadataFromHtml('<a href="next">Details</a>', page + 'docs/index')
    expect(publicLinkUrls(page + 'old', metadata)).toEqual([page + 'docs/next'])
  })
  it('respects the published document base for relative navigation', () => {
    const metadata = parseMetadataFromHtml('<base href="/docs/"><a href="next">Details</a>', page)
    expect(publicLinkUrls(page, metadata)).toEqual([page + 'docs/next'])
  })
  it('excludes actual same-document sections after a redirect while retaining cross-document base destinations', () => {
    const source = page + 'old', reached = page + 'docs/'
    const metadata = parseMetadataFromHtml('<a href="#details">Details</a>', reached)
    expect(publicLinkUrls(source, metadata)).toEqual([])
    const inventory = capturedPageLinks({ renderedSearchSnapshot: { finalUrl: reached, documentBaseUrl: reached, sections: {
      links: { html: '<a href="#details">Details</a>', complete: true, observed: 1, limit: 2000, reason: null },
    } } }, null)!
    expect(publicLinkUrls(source, inventory)).toEqual([])
    expect(publicLinkUrls(source, { ...inventory, linkBaseUrl: page + 'plans/' })).toEqual([page + 'plans/'])
  })
  it('uses the bounded native inventory independently of whole-page metadata', () => {
    const inventory = capturedPageLinks({ renderedSearchSnapshot: { documentBaseUrl: page + 'docs/', sections: {
      links: { html: '<a href="next?a=1&amp;b=2">Plans &amp; prices</a>', complete: true, observed: 1, limit: 2000, reason: null },
    } } }, null)
    expect(inventory).toMatchObject({ complete: true, links: [{ href: 'next?a=1&b=2', text: 'Plans & prices' }] })
    expect(publicLinkUrls(page + 'redirected', inventory!)).toEqual([page + 'docs/next?a=1&b=2'])
  })
  it('keeps positive links and their GET proofs when the native inventory is incomplete', () => {
    const inventory = capturedPageLinks({ renderedSearchSnapshot: { documentBaseUrl: page, sections: {
      links: { html: '<a href="/ready">Details</a>', complete: false, observed: 2001, limit: 2000, reason: 'section_limit' },
    } } }, null)!
    const result = publicLinkObservations(page, publicLinkUrls(page, inventory), [response(page + 'ready')], inventory.complete)
    expect(result).toMatchObject({ complete: false, flags: [], assertions: [{ complete: true, passed: true }] })
    expect(result.limitation).toContain('inventory is incomplete')
  })
  it('retains the complete parsed inventory when the same native capture exhausts its link section', () => {
    const metadata = parseMetadataFromHtml('<a href="ready">Details</a><a href="more">More</a>', page + 'docs/')
    const inventory = capturedPageLinks({ renderedSearchSnapshot: { documentBaseUrl: page + 'docs/', sections: {
      links: { html: '<a href="ready">Details</a>', complete: false, observed: 2, limit: 2000, reason: 'section_limit' },
    } } }, metadata)!
    expect(inventory.complete).toBe(true)
    expect(publicLinkUrls(page, inventory)).toEqual([page + 'docs/ready', page + 'docs/more'])
  })
  it('does not invent a base for historical native sections or replace observed absence with fallback links', () => {
    const links = { html: '', complete: true, observed: 0, limit: 2000, reason: null }
    const legacy = parseMetadataFromHtml('<a href="next">Details</a>', page + 'docs/')
    expect(capturedPageLinks({ renderedSearchSnapshot: { sections: { links } } }, null)).toBeNull()
    expect(capturedPageLinks({ renderedSearchSnapshot: { sections: { links } } }, legacy)).toMatchObject({ links: legacy.links, complete: true })
    expect(capturedPageLinks({ renderedSearchSnapshot: { documentBaseUrl: page, sections: { links } } }, legacy))
      .toMatchObject({ links: [], complete: true })
    expect(capturedPageLinks({ collectionRestrictions: ['request_blocked'], renderedSearchSnapshot: { documentBaseUrl: page, sections: { links } } }, legacy))
      .toMatchObject({ links: [], complete: false })
  })
})
