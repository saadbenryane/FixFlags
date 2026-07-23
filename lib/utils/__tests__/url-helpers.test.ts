import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { displayEvidenceUrl } from '@/lib/utils/url-helpers'

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
