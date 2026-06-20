import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runFlowChecks } from '@/lib/audit/checks/flow'

describe('multi-step flow checks', () => {
  it('flags broken pricing nav probe', () => {
    const flags = runFlowChecks({
      status: 'success',
      steps: [],
      finalUrl: 'https://example.com',
      multiStep: {
        pricingNav: 'broken',
        pricingNavLabel: 'Pricing',
        pricingNavHref: '#pricing',
        mobileMenu: 'skipped',
      },
    })
    assert.equal(flags.length, 1)
    assert.equal(flags[0].checkId, 'flow-pricing-nav-broken')
    assert.match(flags[0].evidence, /Pricing/)
  })

  it('flags broken mobile menu probe', () => {
    const flags = runFlowChecks({
      status: 'success',
      steps: [],
      finalUrl: 'https://example.com',
      multiStep: {
        pricingNav: 'skipped',
        mobileMenu: 'broken',
      },
    })
    assert.equal(flags.length, 1)
    assert.equal(flags[0].checkId, 'flow-mobile-menu-broken')
  })

  it('skips when probes pass or are not applicable', () => {
    const flags = runFlowChecks({
      status: 'success',
      steps: [],
      finalUrl: 'https://example.com',
      multiStep: {
        pricingNav: 'ok',
        mobileMenu: 'skipped',
      },
    })
    assert.equal(flags.length, 0)
  })
})
