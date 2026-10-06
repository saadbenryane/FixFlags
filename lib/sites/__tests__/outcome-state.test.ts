import { describe, expect, it } from 'vitest'
import { checkoutResultCopy, currentOutcomeState, customerMechanismLabel, flagMatchesOutcome, outcomeCoverageLabel, outcomeFreshnessDisclosure, outcomeStatusLabel } from '@/lib/sites/outcome-state'

describe('Outcome state', () => {
  it('keeps a fresh completed conclusion and derives stale from its validity window', () => {
    const now = new Date('2026-09-21T12:00:00.000Z')
    expect(
      currentOutcomeState(
        { state: 'CLEAR', validUntil: new Date('2026-09-22T12:00:00.000Z') },
        now,
      ),
    ).toBe('CLEAR')
    expect(
      currentOutcomeState({ state: 'FLAG', validUntil: new Date('2026-09-21T11:59:59.000Z') }, now),
    ).toBe('STALE')
  })

  it('does not turn blocked or unsupported execution into a Flag', () => {
    expect(currentOutcomeState({
      state: 'COULD_NOT_VERIFY',
      validUntil: new Date('2026-09-20T00:00:00.000Z'),
    }, new Date('2026-09-21T00:00:00.000Z'))).toBe('COULD_NOT_VERIFY')
    expect(checkoutResultCopy('bot_wall').problem).toBe('')
    expect(checkoutResultCopy('no_buy_control').summary).toMatch(/could not find/i)
    expect(checkoutResultCopy('add_to_cart_noop').problem).toMatch(/Cart did not contain/i)
  })

  it('names required coverage in customer language', () => {
    expect(outcomeCoverageLabel('production', [
      { key: 'checkout-browser-v1', required: true },
      { key: 'signup-form-v1', required: true },
      { key: 'notes', required: false },
    ])).toBe('Production · purchase path, form')
    expect(outcomeCoverageLabel('production', [])).toBe('Not configured for independent verification')
    expect(outcomeStatusLabel('COULD_NOT_VERIFY')).toBe('Couldn’t verify')
    expect(outcomeStatusLabel('STALE')).toBe('Stale')
    expect(outcomeStatusLabel('CLEAR', true)).toBe('Verifying')
    expect(outcomeFreshnessDisclosure('CLEAR', 11520)).toBe('A result stays current for 8 days.')
    expect(outcomeFreshnessDisclosure('STALE', 11520)).toBe('A result stays current for 8 days. This result is past that window.')
    expect(outcomeFreshnessDisclosure('CLEAR', 120)).toBe('A result stays current for 2 hours.')
    expect(outcomeFreshnessDisclosure('STALE', 90)).toBe('A result stays current for 90 minutes. This result is past that window.')
  })

  it('names a verification method without the mechanism enum', () => {
    expect(customerMechanismLabel('BROWSER_JOURNEY', 'checkout-browser-v1')).toBe('Purchase path')
    expect(customerMechanismLabel('SAFE_FORM', 'signup-safe-form-v1')).toBe('Form')
    expect(customerMechanismLabel('HTTP_AVAILABILITY', 'page-availability-v1')).toBe('Page availability')
    expect(customerMechanismLabel('HTTP_AVAILABILITY', 'supporting-observation-v1')).toBe('Page availability')
    expect(customerMechanismLabel('BROWSER_JOURNEY', 'notes-v1')).toBe('Check')
    expect(customerMechanismLabel('CUSTOM_SIGNAL', 'notes-v1')).toBe('Check')
  })

  it('shows only the Flag independently linked to the Outcome', () => {
    const outcome = { flagId: 'improvement-1', pageUrls: ['https://walk.example/products/tote'], kind: 'CHECKOUT' }
    expect(flagMatchesOutcome({
      id: 'flag-1',
      improvementId: 'improvement-1',
      checkId: 'journey-checkout-failed-add_to_cart_noop',
      pageUrl: 'https://walk.example/products/tote',
    }, outcome)).toBe(true)
    expect(flagMatchesOutcome({
      id: 'flag-2',
      checkId: 'security-header',
      pageUrl: 'https://walk.example/products/tote',
    }, outcome)).toBe(false)
    expect(flagMatchesOutcome({
      id: 'flag-3',
      improvementId: 'improvement-2',
      checkId: 'journey-checkout-failed-add_to_cart_noop',
      pageUrl: 'https://walk.example/products/tote',
    }, outcome)).toBe(false)
    expect(flagMatchesOutcome({
      id: 'flag-4',
      checkId: 'journey-checkout-failed-add_to_cart_noop',
      pageUrl: 'https://walk.example/products/tote',
    }, { ...outcome, flagId: null })).toBe(false)
    expect(flagMatchesOutcome({
      id: 'flag-1',
      improvementId: 'improvement-1',
      checkId: null,
      pageUrl: null,
    }, outcome)).toBe(true)
    expect(flagMatchesOutcome({
      id: 'flag-5',
      outcomeId: 'outcome-1',
      checkId: null,
      pageUrl: null,
    }, { ...outcome, id: 'outcome-1', flagId: null })).toBe(true)
    expect(flagMatchesOutcome({
      id: 'flag-5',
      outcomeId: 'outcome-2',
      checkId: null,
      pageUrl: null,
    }, { ...outcome, id: 'outcome-1' })).toBe(false)
  })
})
