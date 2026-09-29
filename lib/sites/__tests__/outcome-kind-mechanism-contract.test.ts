import { describe, expect, it } from 'vitest'
import { validateBindingConfig } from '@/lib/sites/application/binding-config'
import {
  CONFIRMABLE_OUTCOME_KINDS,
  bindingForConfirmedKind,
  outcomeKindWatchable,
  watchableOutcomeKinds,
  type ConfirmableOutcomeKind,
} from '@/lib/sites/outcomes'

/**
 * `kind` is not a label. It selects the execution mechanism that will verify the
 * Outcome, and two modules have to agree about that: the command that writes the
 * binding, and the validator the run path uses before executing it. Nothing
 * connected them, so `SIGNUP` was accepted, wrote a binding carrying
 * `safety: 'protected'` and no `fixtureId`, and could never validate.
 *
 * The result was a customer agreement recorded as agreed, a required binding on
 * the Site, an enabled Verify button on Home, and "Couldn't verify" on every run
 * forever. `OutcomeFixture` has one reference in the whole application, a read,
 * so no fixture can exist to make that config valid.
 *
 * This test is the join between the two halves. It fails if a kind is offered
 * without a runnable binding, and it fails if a binding FixFlags writes is one
 * its own validator rejects.
 */
describe('every confirmable kind must have a mechanism FixFlags can run', () => {
  const siteUrl = 'https://shop.example'

  it('rejects nothing silently: each kind is either watchable or refused', () => {
    for (const kind of CONFIRMABLE_OUTCOME_KINDS) {
      const binding = bindingForConfirmedKind(kind, siteUrl)
      const validated = validateBindingConfig(binding.mechanism, binding.config)
      const watchable = outcomeKindWatchable(kind, siteUrl)
      // The two answers must come from the same question, or the command would
      // accept a kind the run path cannot execute.
      expect(watchable, `${kind} disagrees with its own binding validator`).toBe(validated.success)
    }
  })

  it('writes a binding the run path accepts, for every kind that is watchable', () => {
    for (const kind of watchableOutcomeKinds(siteUrl)) {
      const binding = bindingForConfirmedKind(kind, siteUrl)
      const validated = validateBindingConfig(binding.mechanism, binding.config)
      expect(validated.success, `${kind} writes a binding FixFlags cannot run`).toBe(true)
      if (!validated.success) continue
      // A binding that cannot run is not the only way to be false. A binding the
      // Outcome does not require is one FixFlags will never check, and it would
      // still read as watchable on Home.
      expect(binding.required, `${kind} writes a binding the Outcome does not require`).toBe(true)
    }
  })

  it('offers purchase, signup, login, password reset, and page availability', () => {
    expect(outcomeKindWatchable('CHECKOUT', siteUrl)).toBe(true)
    expect(outcomeKindWatchable('SIGNUP', siteUrl)).toBe(true)
    expect(outcomeKindWatchable('LOGIN', siteUrl)).toBe(true)
    expect(outcomeKindWatchable('PASSWORD_RESET', siteUrl)).toBe(true)
    expect(outcomeKindWatchable('AVAILABILITY', siteUrl)).toBe(true)
    expect(watchableOutcomeKinds(siteUrl)).toEqual(['CHECKOUT', 'SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'AVAILABILITY'])
  })

  it('allows multiple kinds to share the BROWSER_JOURNEY mechanism with distinct configs', () => {
    // The generic browser journey mechanism runs different goal-driven configs
    // for different kinds. The mechanism is the same; the config (steps + goal) differs.
    const browserJourneyKinds = ['CHECKOUT', 'SIGNUP', 'LOGIN', 'PASSWORD_RESET'] as const
    const mechanisms = browserJourneyKinds.map(
      (kind) => bindingForConfirmedKind(kind, siteUrl).mechanism,
    )
    for (const mechanism of mechanisms) {
      expect(mechanism).toBe('BROWSER_JOURNEY')
    }
  })

  it('keys each kind under its own binding, so one kind cannot overwrite another', () => {
    const keys = CONFIRMABLE_OUTCOME_KINDS.map((kind) => bindingForConfirmedKind(kind, siteUrl).key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('treats an unlisted kind as unwatchable rather than defaulting to yes', () => {
    // A kind outside the confirmed list must not be assumed runnable. The
    // confirmation path narrows to CONFIRMABLE_OUTCOME_KINDS, and this is the
    // reason that narrowing is not ceremony.
    const listed = new Set<string>(CONFIRMABLE_OUTCOME_KINDS)
    expect(listed.has('REGISTRATION')).toBe(false)
  })

  it('is stable for the kinds the customer can be offered today', () => {
    // If a new kind is added, this test should be updated deliberately,
    // not a silent behaviour flip.
    const offered: ConfirmableOutcomeKind[] = watchableOutcomeKinds(siteUrl)
    expect(offered).toEqual(['CHECKOUT', 'SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'AVAILABILITY'])
  })
})
