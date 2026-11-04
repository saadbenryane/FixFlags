import { describe, expect, it } from 'vitest'
import { assessRequiredBindings } from '@/lib/sites/application/binding-assessment'

describe('required binding assessment', () => {
  const bindings = [
    { key: 'checkout', required: true },
    { key: 'notes', required: false },
  ]

  it('is Clear only when every required binding succeeded', () => {
    expect(assessRequiredBindings(bindings, [
      { key: 'checkout', disposition: 'SUCCEEDED', reason: 'checkout_reached' },
    ])).toMatchObject({ state: 'CLEAR', observedBindings: ['checkout'] })
  })

  it('is a Flag when a required binding reproduced a failure', () => {
    expect(assessRequiredBindings(bindings, [
      { key: 'checkout', disposition: 'FAILED', reason: 'add_to_cart_noop' },
    ]).state).toBe('FLAG')
  })

  it('is Couldn’t verify when required evidence is blocked or missing', () => {
    expect(assessRequiredBindings([
      { key: 'checkout', required: true },
      { key: 'signup', required: true },
    ], [
      { key: 'checkout', disposition: 'SUCCEEDED', reason: 'checkout_reached' },
      { key: 'signup', disposition: 'BLOCKED', reason: 'protected_or_irreversible' },
    ])).toMatchObject({ state: 'COULD_NOT_VERIFY', reason: 'protected_or_irreversible' })
  })

  it('does not treat an unbound Outcome as Clear', () => {
    expect(assessRequiredBindings([{ key: 'notes', required: false }], []).state).toBe('COULD_NOT_VERIFY')
  })
  it('never certifies a changed binding from an earlier version', () => {
    expect(assessRequiredBindings([{ key: 'checkout', required: true, version: 2 }], [{ key: 'checkout', disposition: 'SUCCEEDED', reason: 'checkout_reached', version: 1 }])).toMatchObject({ state: 'COULD_NOT_VERIFY', reason: 'binding_changed' })
  })
  it.each(['SUCCEEDED', 'FAILED'] as const)('does not attribute an unversioned %s observation to revision one', disposition => {
    expect(assessRequiredBindings([{ key: 'checkout', required: true, version: 1 }], [
      { key: 'checkout', disposition, reason: disposition === 'SUCCEEDED' ? 'checkout_reached' : 'add_to_cart_noop' },
    ])).toMatchObject({ state: 'COULD_NOT_VERIFY', reason: 'binding_changed', observedBindings: [] })
  })
  it('retains a comparable failure when another required binding has unversioned evidence', () => {
    expect(assessRequiredBindings([
      { key: 'checkout', required: true, version: 1 }, { key: 'signup', required: true, version: 1 },
    ], [
      { key: 'checkout', disposition: 'SUCCEEDED', reason: 'checkout_reached' },
      { key: 'signup', disposition: 'FAILED', reason: 'success_text_missing', version: 1 },
    ])).toMatchObject({ state: 'FLAG', reason: 'success_text_missing', observedBindings: ['signup'] })
  })
})
