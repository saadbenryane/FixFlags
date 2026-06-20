import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  compareDemoFixtures,
  isDemoDevServerRunning,
} from '@/lib/demo/audit-demo-fixtures'

describe('demo v1 fixture audit (offline)', () => {
  it('original keeps intentional flaws and v1 clears in-scope flags', async () => {
    const comparison = await compareDemoFixtures({ mode: 'offline' })
    const baseline = comparison.baseline.flags
    const fixed = comparison.fixed.flags

    assert.ok(baseline.length >= 8, `expected ≥8 baseline flags, got ${baseline.length}`)
    assert.equal(
      fixed.length,
      0,
      `expected v1 in-scope flags = 0, got: ${fixed.map((f) => f.checkId).join(', ')}`
    )
    assert.ok(comparison.clearedCheckIds.length >= 8)
  })
})

describe('demo v1 fixture audit (live localhost)', () => {
  it('v1 clears in-scope flags against rendered Next.js HTML', async (t) => {
    const running = await isDemoDevServerRunning()
    if (!running) {
      t.skip('dev server not running (npm run dev)')
      return
    }

    const comparison = await compareDemoFixtures({ mode: 'live' })
    assert.ok(comparison.baseline.flags.length >= 8)
    assert.equal(
      comparison.fixed.flags.length,
      0,
      `expected v1 in-scope flags = 0, got: ${comparison.fixed.flags.map((f) => f.checkId).join(', ')}`
    )
  })
})
