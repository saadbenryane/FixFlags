import { OUTCOME_KIND_NAMES } from '@/lib/marketing/copy'

/**
 * Kinds a customer agreement may name. This module is deliberately safe to
 * import from the browser: execution bindings and persistence stay server-side.
 */
export const CONFIRMABLE_OUTCOME_KINDS = ['CHECKOUT', 'SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'AVAILABILITY'] as const
export type ConfirmableOutcomeKind = (typeof CONFIRMABLE_OUTCOME_KINDS)[number]

/**
 * The subset that has a complete, safe execution contract today. The server
 * independently validates the concrete binding before accepting a
 * confirmation; the contract test keeps this customer-facing list aligned.
 */
const WATCHABLE_OUTCOME_KINDS = ['CHECKOUT', 'AVAILABILITY'] as const satisfies readonly ConfirmableOutcomeKind[]

export function watchableOutcomeKinds(): ConfirmableOutcomeKind[] {
  return [...WATCHABLE_OUTCOME_KINDS]
}

export function nameForConfirmedOutcomeKind(kind: ConfirmableOutcomeKind): string {
  return OUTCOME_KIND_NAMES[kind]
}

export function expectationForKind(kind: ConfirmableOutcomeKind): string {
  if (kind === 'CHECKOUT') return 'The selected product appears in the cart and checkout opens.'
  if (kind === 'SIGNUP') return 'A person can complete the form when FixFlags has a safe, authorized fixture.'
  if (kind === 'LOGIN') return 'A person can sign in with valid credentials and reach their account.'
  if (kind === 'PASSWORD_RESET') return 'A person can request a password reset and receive the reset email.'
  return 'The public page responds successfully.'
}
