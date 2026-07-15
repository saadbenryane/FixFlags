import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { planLabel, PLAN_DEFINITIONS } from '@/lib/billing/plans'

describe('planLabel', () => {
  // Paying customers must always see the name they bought. The internal enum
  // codes (BUILDER, TEAM) are not customer-facing: rendering "Builder plan" or
  // "Team plan" reads as a billing bug to someone who paid for "Pro" / "Agency".
  it('maps internal plan codes to customer-facing names', () => {
    assert.equal(planLabel('FREE'), 'Free')
    assert.equal(planLabel('BUILDER'), 'Pro')
    assert.equal(planLabel('TEAM'), 'Agency')
  })

  it('never leaks a raw enum code as a label', () => {
    for (const plan of Object.keys(PLAN_DEFINITIONS)) {
      const label = planLabel(plan)
      assert.notEqual(label, plan, `label for ${plan} must not be the raw code`)
      assert.doesNotMatch(label, /builder|team/i, `label for ${plan} leaks an internal code`)
    }
  })

  it('falls back to Free for an unknown plan instead of throwing', () => {
    assert.equal(planLabel('SOMETHING_ELSE'), 'Free')
  })
})
