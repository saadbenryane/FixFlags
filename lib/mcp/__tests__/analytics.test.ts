import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  computeSuccessRate,
  computeToolUsagePct,
} from '@/lib/mcp/analytics'

describe('MCP analytics helpers', () => {
  it('computes success rate', () => {
    assert.equal(computeSuccessRate(8, 2), 80)
    assert.equal(computeSuccessRate(0, 0), 0)
  })

  it('computes tool usage percentages against max', () => {
    assert.equal(computeToolUsagePct(5, 10), 50)
    assert.equal(computeToolUsagePct(0, 0), 0)
  })
})
