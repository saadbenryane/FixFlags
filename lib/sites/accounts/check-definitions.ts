import type { AccountObservation } from './contracts'
import { accountObservationContext } from './contracts'

export const accountCheckId = { signup: 'account-signup-failed', verification: 'account-verification-failed',
  signed_in: 'account-signed-in-page', deletion: 'account-deletion-failed' } as const
export const accountAssertion = { signup: 'signup-completion', verification: 'email-verification',
  signed_in: 'signed-in-page', deletion: 'account-deletion' } as const

/** Commit and later reads share one mapping. Unknown and unavailable are not success. */
export function accountCheckAssertion(item: Pick<AccountObservation, 'kind' | 'state' | 'detail' | 'pageUrl'>) {
  return { key: accountAssertion[item.kind], name: item.kind.replace('_', ' '),
    expected: 'The observed account behavior completes successfully.', observed: item.detail,
    passed: item.state === 'verified', complete: item.state === 'verified' || item.state === 'failed',
    context: accountObservationContext(item) }
}
export const ACCOUNT_CHECK_DEFINITIONS = Object.fromEntries(Object.values(accountCheckId).map(id => [id,
  { version: 1, area: 'conversion' as const, module: 'automatic-accounts', capabilities: ['automatic-account-checks'] as const }])) as Record<(typeof accountCheckId)[keyof typeof accountCheckId], { version: 1; area: 'conversion'; module: 'automatic-accounts'; capabilities: readonly ['automatic-account-checks'] }>
