import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { auditDemoFixturesOffline } from '@/lib/demo/audit-fixture-offline'

describe('demo v1 fixture audit (offline)', () => {
  it('original keeps intentional flaws and v1 clears them', async () => {
    const results = await auditDemoFixturesOffline('https://fixflags.com')
    const baseline = results.original ?? []
    const fixed = results.v1 ?? []

    assert.ok(baseline.length >= 8, `expected ≥8 baseline flags, got ${baseline.length}`)
    assert.equal(fixed.length, 0, `expected v1 flags = 0, got: ${fixed.map((f) => f.checkId).join(', ')}`)
  })
})
