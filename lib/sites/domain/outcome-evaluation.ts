/** Recorded evaluator identity is separate from customer configuration revisions. */
export const CHECKOUT_ENTRY_EVALUATOR = 'checkout-entry-v2'

export function bindingEvaluator(kind: string | undefined, mechanism: string): string | undefined {
  return kind === 'CHECKOUT' && mechanism === 'BROWSER_JOURNEY' ? CHECKOUT_ENTRY_EVALUATOR : undefined
}

export function recordedBindingEvaluator(detail: unknown): string | undefined {
  const evaluator = detail && typeof detail === 'object' && !Array.isArray(detail) && 'evaluator' in detail ? detail.evaluator : null
  return typeof evaluator === 'string' ? evaluator : undefined
}

export function hasCurrentCheckoutEvidence(coverage: unknown): boolean {
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage) || !('bindings' in coverage) || !Array.isArray(coverage.bindings)) return false
  const browser = coverage.bindings.filter(binding => binding && typeof binding === 'object' && binding.mechanism === 'BROWSER_JOURNEY')
  return browser.length > 0 && browser.every(binding => recordedBindingEvaluator(binding) === CHECKOUT_ENTRY_EVALUATOR)
}
