import assert from 'node:assert/strict'
import { describe, it, beforeEach, vi } from 'vitest'
import { auditCache } from '../cache'
import { toStoredPageSpeedResult, type PageSpeedResult } from '../pagespeed'

const mockResult: PageSpeedResult = {
  strategy: 'desktop',
  score: 85,
  lcp: 2500,
  cls: 0.1,
  fcp: 1200,
  tbt: 200,
  inp: 100,
  opportunities: [],
  failedAccessibilityAudits: [],
  diagnostics: {},
  raw: { someRawData: true },
}

describe('toStoredPageSpeedResult', () => {
  it('strips the raw field', () => {
    const stored = toStoredPageSpeedResult(mockResult)
    assert.equal((stored as Record<string, unknown>).raw, undefined)
    assert.equal(stored.score, 85)
  })
})

describe('fetchPageSpeedData cache interaction', () => {
  beforeEach(() => {
    auditCache.clear()
  })

  it('returns cached desktop result on cache hit', async () => {
    auditCache.set('pagespeed:https://example.com:desktop:desktop', mockResult, 60_000)
    auditCache.set('pagespeed:https://example.com:mobile:mobile', mockResult, 60_000)
    assert.equal(auditCache.get<PageSpeedResult>('pagespeed:https://example.com:desktop:desktop')?.score, 85)
  })

  it('returns cached mobile result on cache hit', async () => {
    auditCache.set('pagespeed:https://example.com:desktop:desktop', mockResult, 60_000)
    auditCache.set('pagespeed:https://example.com:mobile:mobile', {
      ...mockResult,
      strategy: 'mobile',
    }, 60_000)
    assert.equal(auditCache.get<PageSpeedResult>('pagespeed:https://example.com:mobile:mobile')?.strategy, 'mobile')
  })

  it('returns null for uncached keys', () => {
    const cached = auditCache.get<PageSpeedResult>('pagespeed:https://other.com:desktop:desktop')
    assert.equal(cached, null)
  })
})
