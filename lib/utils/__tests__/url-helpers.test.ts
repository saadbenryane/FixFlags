import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { displayEvidenceUrl, displaySiteAddress } from '@/lib/utils/url-helpers'

describe('displayEvidenceUrl', () => {
  it('hides chrome-error and chrome URLs from customers', () => {
    assert.equal(displayEvidenceUrl('chrome-error://chromewebdata/'), 'Could not load destination')
    assert.equal(displayEvidenceUrl('chrome://crash'), 'Could not load destination')
    assert.equal(displayEvidenceUrl('about:blank'), 'Could not load destination')
  })

  it('passes through normal destinations', () => {
    assert.equal(displayEvidenceUrl('https://example.com/pricing'), 'https://example.com/pricing')
  })

  it('returns null for empty input', () => {
    assert.equal(displayEvidenceUrl(null), null)
    assert.equal(displayEvidenceUrl(''), null)
  })
})

describe('displaySiteAddress', () => {
  it('keeps the reviewed path so a sub-page never reads as the root domain', () => {
    assert.equal(displaySiteAddress('https://fixflags.com/demo'), 'fixflags.com/demo')
    assert.equal(displaySiteAddress('https://www.example.com/pricing/'), 'example.com/pricing')
  })

  it('shows the bare host for a root review', () => {
    assert.equal(displaySiteAddress('https://example.com/'), 'example.com')
  })

  it('falls back to the raw input when the URL cannot be parsed', () => {
    assert.equal(displaySiteAddress('not a url'), 'not a url')
  })
})
