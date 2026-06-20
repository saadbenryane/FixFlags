import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  extractAuditIdFromPageUrl,
  extractAuditIdFromPath,
} from '@/lib/live-support/extract-audit-id'

describe('resolve lead context - audit id extraction', () => {
  it('extracts audit id from report page URLs', () => {
    assert.equal(
      extractAuditIdFromPageUrl('https://fixflags.com/report/clxyz123'),
      'clxyz123'
    )
    assert.equal(
      extractAuditIdFromPageUrl('https://fixflags.com/audit/clxyz123?tab=flags'),
      'clxyz123'
    )
  })

  it('returns null for marketing pages (no bogus lead link)', () => {
    assert.equal(extractAuditIdFromPageUrl('https://fixflags.com/'), null)
    assert.equal(extractAuditIdFromPageUrl('https://fixflags.com/pricing'), null)
    assert.equal(extractAuditIdFromPath('/changelog'), null)
  })

  it('handles invalid URLs gracefully', () => {
    assert.equal(extractAuditIdFromPageUrl('not-a-url'), null)
    assert.equal(extractAuditIdFromPath(null), null)
  })
})
