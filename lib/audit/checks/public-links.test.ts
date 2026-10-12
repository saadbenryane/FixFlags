import { describe, expect, it } from 'vitest'
import { publicLinkObservations, publicLinkUrls } from './public-links'
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
})
