/** Recorded evaluator identity is separate from customer configuration revisions. */
export const CHECKOUT_ENTRY_EVALUATOR = 'checkout-entry-v2'
export const DEFAULT_AVAILABILITY_EVALUATOR = 'availability-rendered-page-v2'

export function usesDefaultAvailabilitySurface(config: unknown): boolean {
  return config !== null && typeof config === 'object' && 'startUrl' in config && typeof config.startUrl === 'string' &&
    (!('expectedText' in config) || config.expectedText === undefined) &&
    (!('expectedSelector' in config) || config.expectedSelector === undefined || config.expectedSelector === 'body')
}

export function bindingEvaluator(kind: string | undefined, mechanism: string, config?: unknown): string | undefined {
  if (kind === 'CHECKOUT' && mechanism === 'BROWSER_JOURNEY') return CHECKOUT_ENTRY_EVALUATOR
  if (kind === 'AVAILABILITY' && mechanism === 'HTTP_AVAILABILITY' && usesDefaultAvailabilitySurface(config))
    return DEFAULT_AVAILABILITY_EVALUATOR
}

export function recordedBindingEvaluator(detail: unknown): string | undefined {
  const evaluator = detail && typeof detail === 'object' && !Array.isArray(detail) && 'evaluator' in detail ? detail.evaluator : null
  return typeof evaluator === 'string' ? evaluator : undefined
}

export function hasCurrentOutcomeSuccess(kind: string, coverage: unknown): boolean {
  if (kind !== 'CHECKOUT' && kind !== 'AVAILABILITY') return true
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage) || !('bindings' in coverage) || !Array.isArray(coverage.bindings)) return false
  const mechanism = kind === 'CHECKOUT' ? 'BROWSER_JOURNEY' : 'HTTP_AVAILABILITY'
  const applicable = coverage.bindings.filter(binding => binding && typeof binding === 'object' && binding.mechanism === mechanism)
  return applicable.length > 0 && applicable.every(binding => recordedBindingEvaluator(binding) === bindingEvaluator(kind, mechanism, binding.config))
}
