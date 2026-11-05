import { describe, expect, it } from 'vitest'
import { journeyPlanProviderSchema, journeyPlanSchema, JOURNEY_PLAN_PARAMETERS } from '../planner-schema'

const plan = (action: string) => ({ goal: 'Inspect the recorded public page', confidence: 1, estimatedDurationMs: 5000,
  steps: [{ stepNumber: 1, action, target: 'Create account', expectedResult: 'Unverified destination intention', evidence: [] }] })
describe('executable planner provider contract', () => {
  it.each(['fill', 'submit', 'scroll'])('retains historical %s plans without admitting them as new executable plans', action => {
    expect(journeyPlanSchema.safeParse(plan(action)).success).toBe(true)
    expect(journeyPlanProviderSchema.safeParse(plan(action)).success).toBe(false)
    expect(JSON.stringify(JOURNEY_PLAN_PARAMETERS)).not.toContain('"' + action + '"')
  })
  it.each(['navigate', 'click', 'evaluate'])('admits the implemented %s action', action => {
    expect(journeyPlanProviderSchema.safeParse(plan(action)).success).toBe(true)
  })
})
