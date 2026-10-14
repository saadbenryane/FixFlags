import { describe, expect, it } from 'vitest'
import { publicResearchEntryHref, readPublicEntrySurface, withCampaignTags } from '../entry-surface'

describe('public entry surface attribution', () => {
  it('marks an internal surface without inventing an acquisition channel or campaign', () => {
    expect(publicResearchEntryHref('issue_page')).toBe('/?ff_entry=issue_page')
    expect(withCampaignTags('/issues/security-headers-missing')).toBe('/issues/security-headers-missing')
  })

  it('carries only existing campaign values and encodes them without overwriting the internal surface', () => {
    const href = publicResearchEntryHref('issue_page', {
      utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'quality & care',
      ff_entry: 'tool_page', gclid: 'private-ad-id', token: 'private-token', url: 'https://customer.example/private',
    })
    const query = new URL(href, 'https://fixflags.example').searchParams
    expect(Object.fromEntries(query)).toEqual({ ff_entry: 'issue_page', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'quality & care' })
    expect(href).not.toContain('private')
  })

  it('does not choose an ambiguous, blank, oversized or control-character campaign tag', () => {
    expect(withCampaignTags('/issues/example', {
      utm_source: ['paid', 'organic'], utm_medium: ' ', utm_campaign: 'x'.repeat(201),
    })).toBe('/issues/example')
    expect(withCampaignTags('/issues/example', { utm_source: 'email\nprivate' })).toBe('/issues/example')
  })

  it('accepts only a single known public marker and ignores arbitrary or privileged values', () => {
    for (const surface of ['issue_page', 'tool_page', 'benchmark_page']) {
      expect(readPublicEntrySurface(new URLSearchParams(`ff_entry=${surface}`))).toBe(surface)
    }
    for (const query of ['', 'ff_entry=mcp', 'ff_entry=seed', 'ff_entry=other', 'ff_entry=issue_page&ff_entry=tool_page']) {
      expect(readPublicEntrySurface(new URLSearchParams(query))).toBeNull()
    }
  })
})
