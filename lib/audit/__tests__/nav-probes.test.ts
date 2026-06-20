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
        formValidation: 'skipped',
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
        formValidation: 'skipped',
      },
    })
    assert.equal(flags.length, 1)
    assert.equal(flags[0].checkId, 'flow-mobile-menu-broken')
  })

  it('flags broken form validation probe', () => {
    const flags = runFlowChecks({
      status: 'success',
      steps: [],
      finalUrl: 'https://example.com',
      multiStep: {
        pricingNav: 'skipped',
        mobileMenu: 'skipped',
        formValidation: 'broken',
        formLabel: 'Newsletter',
      },
    })
    assert.equal(flags.length, 1)
    assert.equal(flags[0].checkId, 'flow-form-no-validation')
  })
})
