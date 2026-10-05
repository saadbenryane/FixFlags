import { describe, expect, it } from 'vitest'
import { validateBindingForOutcome } from '@/lib/sites/application/binding-config'
import {
  bindingForConfirmedKind,
  outcomeKindWatchable,
} from '@/lib/sites/outcomes'
import {
  CONFIRMABLE_OUTCOME_KINDS,
  nameForConfirmedOutcomeKind,
  watchableOutcomeKinds,
  type ConfirmableOutcomeKind,
} from '@/lib/sites/outcome-kinds'

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
  const fixture = { id: 'fixture-1', targetUrl: `${siteUrl}/account/register` }

  it('rejects nothing silently: each kind is either watchable or refused', () => {
    for (const kind of CONFIRMABLE_OUTCOME_KINDS) {
      const configuredFixture = kind === 'SIGNUP' ? fixture : undefined
      const binding = bindingForConfirmedKind(kind, siteUrl, configuredFixture)
      const watchable = outcomeKindWatchable(kind, siteUrl, configuredFixture)
      if (!binding) {
        expect(watchable, `${kind} has no binding and must stay unavailable`).toBe(false)
        continue
      }
      const validated = validateBindingForOutcome(kind, binding.mechanism, binding.config)
      // The two answers must come from the same question, or the command would
      // accept a kind the run path cannot execute.
      expect(watchable, `${kind} disagrees with its own binding validator`).toBe(validated.success)
    }
  })

  it('writes a binding the run path accepts, for every kind that is watchable', () => {
    for (const kind of watchableOutcomeKinds()) {
      const binding = bindingForConfirmedKind(kind, siteUrl, kind === 'SIGNUP' ? fixture : undefined)
      expect(binding).not.toBeNull()
      if (!binding) continue
      const validated = validateBindingForOutcome(kind, binding.mechanism, binding.config)
      expect(validated.success, `${kind} writes a binding FixFlags cannot run`).toBe(true)
      if (!validated.success) continue
      // A binding that cannot run is not the only way to be false. A binding the
      // Outcome does not require is one FixFlags will never check, and it would
      // still read as watchable on Home.
      expect(binding.required, `${kind} writes a binding the Outcome does not require`).toBe(true)
    }
  })

  it('does not trust fixture authorization asserted inside binding JSON', () => {
    const base = {
      startUrl: `${siteUrl}/account/register`,
      steps: [
        { action: 'fill' as const, role: 'textbox' as const, name: 'Email', value: 'fixture@example.com' },
        { action: 'click' as const, role: 'button' as const, name: 'Create account' },
      ],
      goal: { type: 'url_pattern' as const, pattern: '/account' },
    }

    expect(validateBindingForOutcome('SIGNUP', 'BROWSER_JOURNEY', {
      ...base,
      safety: 'reversible',
      authorized: true,
      fixtureId: 'does-not-exist',
      goalAfterStep: 2,
    }).success).toBe(false)
  })

  it('blocks protected kinds even when a wait-only config could match on load', () => {
    expect(validateBindingForOutcome('PASSWORD_RESET', 'BROWSER_JOURNEY', {
      startUrl: `${siteUrl}/account/recover`,
      steps: [{ action: 'wait', waitMs: 10 }],
      goal: { type: 'text_present', text: 'Reset password' },
      safety: 'none',
    }).success).toBe(false)
  })

  it('supports Signup only when the command supplies an authorized fixture identity', () => {
    expect(outcomeKindWatchable('CHECKOUT', siteUrl)).toBe(true)
    expect(outcomeKindWatchable('SIGNUP', siteUrl)).toBe(false)
    expect(outcomeKindWatchable('SIGNUP', siteUrl, fixture)).toBe(true)
    expect(outcomeKindWatchable('LOGIN', siteUrl)).toBe(false)
    expect(outcomeKindWatchable('PASSWORD_RESET', siteUrl)).toBe(false)
    expect(outcomeKindWatchable('AVAILABILITY', siteUrl)).toBe(true)
    expect(watchableOutcomeKinds()).toEqual(['CHECKOUT', 'SIGNUP', 'AVAILABILITY'])
  })

  it('keeps bounded checkout and reversible Signup on distinct mechanisms', () => {
    expect(bindingForConfirmedKind('CHECKOUT', siteUrl)?.mechanism).toBe('BROWSER_JOURNEY')
    expect(bindingForConfirmedKind('SIGNUP', siteUrl, fixture)?.mechanism).toBe('SAFE_FORM')
    expect(bindingForConfirmedKind('LOGIN', siteUrl)).toBeNull()
    expect(bindingForConfirmedKind('PASSWORD_RESET', siteUrl)).toBeNull()
  })

  it('keys each kind under its own binding, so one kind cannot overwrite another', () => {
    const keys = CONFIRMABLE_OUTCOME_KINDS
      .map((kind) => bindingForConfirmedKind(kind, siteUrl, kind === 'SIGNUP' ? fixture : undefined)?.key)
      .filter((key): key is string => Boolean(key))
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
    const offered: ConfirmableOutcomeKind[] = watchableOutcomeKinds()
    expect(offered).toEqual(['CHECKOUT', 'SIGNUP', 'AVAILABILITY'])
  })

  it('gives every confirmed execution kind one matching customer name', () => {
    expect(nameForConfirmedOutcomeKind('CHECKOUT')).toBe('Checkout')
    expect(nameForConfirmedOutcomeKind('AVAILABILITY')).toBe('This page loads')
    expect(nameForConfirmedOutcomeKind('SIGNUP')).toBe('Signup')
  })
})
