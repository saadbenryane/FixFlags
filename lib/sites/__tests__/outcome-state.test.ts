import { describe, expect, it } from 'vitest'
import { checkoutResultCopy, currentOutcomeState } from '@/lib/sites/outcome-state'

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
    expect(checkoutResultCopy('bot_wall').problem).toBe('')
    expect(checkoutResultCopy('no_buy_control').summary).toMatch(/could not find/i)
    expect(checkoutResultCopy('add_to_cart_noop').problem).toMatch(/Cart did not contain/i)
  })
})
