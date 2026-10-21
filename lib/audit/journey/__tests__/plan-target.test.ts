import { describe, expect, it } from 'vitest'
import { resolveJourneyPlanTarget } from '../plan-target'

const origin = 'https://example.test'
const signup = { href: origin + '/signup', text: 'Create account', score: 90, category: 'primary-cta', selector: '#signup' }
describe('observed planner target selection', () => {
  it('selects an exact recorded label or URL without changing the control', () => {
    expect(resolveJourneyPlanTarget(' create   ACCOUNT ', [signup], origin)).toBe(signup)
    expect(resolveJourneyPlanTarget('/signup', [signup], origin)).toBe(signup)
  })
  it.each(['Create account', '/signup', 'https://example.test/signup', '', 'account'])('refuses an unobserved target: %s', target => {
    const pricing = { ...signup, href: origin + '/pricing', text: 'Equipment pricing' }
    expect(resolveJourneyPlanTarget(target, [pricing], origin + '/pricing')).toBeNull()
  })
  it('refuses a label shared by different destinations', () => {
    expect(resolveJourneyPlanTarget('Create account', [signup, { ...signup, href: origin + '/other' }], origin)).toBeNull()
  })
})
