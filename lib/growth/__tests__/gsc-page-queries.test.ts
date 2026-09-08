import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  FOCUS_DISCOVERY_PATHS,
  focusPageQueryRows,
  isFocusDiscoveryUrl,
  pageUrlPath,
  toPageQueryRecord,
} from '@/lib/growth/gsc-page-queries'

describe('GSC page×query mapping', () => {
  it('normalizes homepage, trailing slashes, and www hosts', () => {
    assert.equal(pageUrlPath('https://fixflags.com/'), '/')
    assert.equal(pageUrlPath('https://www.fixflags.com/pricing/'), '/pricing')
    assert.equal(pageUrlPath('https://fixflags.com/partners'), '/partners')
  })

  it('treats homepage, pricing, and partners as focus discovery URLs', () => {
    assert.deepEqual([...FOCUS_DISCOVERY_PATHS], ['/', '/pricing', '/partners'])
    assert.equal(isFocusDiscoveryUrl('https://www.fixflags.com/'), true)
    assert.equal(isFocusDiscoveryUrl('https://fixflags.com/pricing'), true)
    assert.equal(isFocusDiscoveryUrl('https://fixflags.com/docs'), false)
  })

  it('maps API rows with page then query keys and keeps the focus subset', () => {
    const rows = [
      toPageQueryRecord({
        keys: ['https://fixflags.com/pricing', 'fixflags pricing'],
        clicks: 0,
        impressions: 12,
        ctr: 0,
        position: 7,
      }),
      toPageQueryRecord({
        keys: ['https://fixflags.com/docs', 'fixflags docs'],
        clicks: 0,
        impressions: 1,
        ctr: 0,
        position: 10,
      }),
    ]
    assert.equal(rows[0]?.query, 'fixflags pricing')
    const focus = focusPageQueryRows(rows)
    assert.equal(focus.length, 1)
    assert.equal(focus[0]?.page, 'https://fixflags.com/pricing')
  })
})
