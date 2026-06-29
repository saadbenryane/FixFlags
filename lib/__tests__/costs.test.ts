import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { estimateLlmCostUsd, computeInfraOverheadUsd, formatUsd } from '@/lib/billing/costs'

describe('estimateLlmCostUsd', () => {
  it('calculates cost for gpt-4o-mini', () => {
    const cost = estimateLlmCostUsd('gpt-4o-mini', 100_000, 10_000)
    assert.ok(cost > 0)
    assert.ok(cost < 0.1)
  })

  it('calculates cost for claude-sonnet-4-20250514', () => {
    const cost = estimateLlmCostUsd('claude-sonnet-4-20250514', 50_000, 5_000)
    assert.ok(cost > 0)
  })

  it('splits tokens evenly across comma-separated models', () => {
    const single = estimateLlmCostUsd('gpt-4o-mini', 100_000, 10_000)
    const multi = estimateLlmCostUsd('gpt-4o-mini,gpt-4o-mini', 100_000, 10_000)
    assert.equal(single, multi)
  })

  it('returns 0 for zero tokens', () => {
    assert.equal(estimateLlmCostUsd('gpt-4o-mini', 0, 0), 0)
  })
})

describe('computeInfraOverheadUsd', () => {
  it('computes pagespeed + browser cost', () => {
    const cost = computeInfraOverheadUsd(2, 30_000)
    assert.ok(cost > 0)
  })

  it('returns 0 for no usage', () => {
    assert.equal(computeInfraOverheadUsd(0, 0), 0)
  })
})

describe('formatUsd', () => {
  it('shows 4 decimals for values under $0.01', () => {
    assert.match(formatUsd(0.005), /0\.005\d$/)
  })

  it('shows 2 decimals for values at or above $0.01', () => {
    assert.equal(formatUsd(1.5), '$1.50')
    assert.equal(formatUsd(0.01), '$0.01')
  })
})
