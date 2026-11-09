import { z } from 'zod'
import { canonicalIntent, type ExecutionSpec } from './execution-spec'
import { bindingEvaluator } from './outcome-evaluation'

const scopeKeySchema = z.string().regex(/^[a-f0-9]{64}$/)
const checkoutScopeSchema = z.object({ checkoutDestinationKey: scopeKeySchema.nullable().optional(), purchaseControlKey: scopeKeySchema.optional() })

export function recordedCheckoutScope(detail: unknown) {
  const scope = checkoutScopeSchema.safeParse(detail)
  return scope.success ? scope.data : {}
}

export function admittedOutcomeCoverage(spec: ExecutionSpec, outcome: ExecutionSpec['outcomes'][number]) {
  const required = outcome.bindings.filter(binding => binding.required)
  return { environment: spec.environment, policy: outcome.bindingPolicy,
    requiredBindings: required.map(binding => binding.key),
    scope: outcome.kind === 'CHECKOUT' ? required.find(binding => binding.mechanism === 'BROWSER_JOURNEY')?.scope ?? null : null,
    bindings: required.map(binding => ({ key: binding.key, version: binding.version, mechanism: binding.mechanism,
      evaluator: bindingEvaluator(outcome.kind, binding.mechanism, binding.config),
      config: binding.config, scope: binding.scope ?? null, ...(binding.fixture ? { fixture: binding.fixture } : {}) })),
  }
}

const coverageSchema = z.object({ environment: z.string().min(1), policy: z.string().optional(),
  requiredBindings: z.array(z.string().min(1)).min(1).max(100), observedBindings: z.array(z.string()).max(100).optional(),
  bindings: z.array(z.object({ key: z.string().min(1), version: z.number().int().positive(), mechanism: z.string().min(1),
    evaluator: z.string().optional(),
    result: z.enum(['SUCCEEDED', 'FAILED']).optional(),
    ...checkoutScopeSchema.shape,
    config: z.record(z.string(), z.unknown()), scope: z.unknown().optional(),
    fixture: z.object({ id: z.string(), version: z.number().int().positive() }).optional() })).min(1).max(100),
  scope: z.unknown().optional(),
})

/** Compare the admitted responsibility, including its target and configuration.
 * Historical receipts without that scope remain evidence, not repair proof. */
export function comparableOutcomeCoverage(source: unknown, observed: unknown): boolean {
  const before = coverageSchema.safeParse(source), after = coverageSchema.safeParse(observed)
  if (!before.success || !after.success) return false
  const normalized = (coverage: z.infer<typeof coverageSchema>) => {
    const keys = [...coverage.requiredBindings].sort()
    if (new Set(keys).size !== keys.length || coverage.bindings.length !== keys.length ||
      new Set(coverage.bindings.map(binding => binding.key)).size !== keys.length ||
      coverage.bindings.some(binding => !keys.includes(binding.key))) return null
    return canonicalIntent({ environment: coverage.environment, policy: coverage.policy ?? 'ALL_REQUIRED',
      requiredBindings: keys, scope: coverage.scope ?? null,
      // A stricter success evaluator can still independently recover an actual
      // failure under the same responsibility. It cannot recertify old success.
      bindings: coverage.bindings.map(binding => {
        const identity = { ...binding, scope: binding.scope ?? null }
        delete identity.evaluator
        delete identity.result
        delete identity.checkoutDestinationKey
        delete identity.purchaseControlKey
        return identity
      })
        .sort((left, right) => left.key.localeCompare(right.key)) })
  }
  const identity = normalized(before.data)
  return identity !== null && identity === normalized(after.data)
}

export type CheckoutScopeGap = 'checkout_destination_changed' | 'checkout_purchase_control_changed'

export function recordedCheckoutFailureScope(coverage: unknown, bindingKey: string) {
  const source = coverageSchema.safeParse(coverage)
  if (!source.success || !source.data.observedBindings?.includes(bindingKey)) return undefined
  const binding = source.data.bindings.find(binding => binding.key === bindingKey &&
    binding.mechanism === 'BROWSER_JOURNEY' && binding.result === 'FAILED')
  if (binding?.checkoutDestinationKey === undefined || !(binding.checkoutDestinationKey || binding.purchaseControlKey)) return undefined
  return { checkoutDestinationKey: binding.checkoutDestinationKey, purchaseControlKey: binding.purchaseControlKey }
}

/** Match the observed purchase path. A failure before checkout has no
 * destination to match, but its observed purchase control still matters. */
export function checkoutScopeGaps(source: unknown, observed: unknown): Map<string, CheckoutScopeGap> {
  const gaps = new Map<string, CheckoutScopeGap>()
  const before = coverageSchema.safeParse(source), after = coverageSchema.safeParse(observed)
  if (!before.success || !after.success) return gaps
  for (const binding of before.data.bindings) {
    if (binding.mechanism !== 'BROWSER_JOURNEY' || binding.result !== 'FAILED' || !before.data.observedBindings?.includes(binding.key)) continue
    const later = after.data.bindings.find(candidate => candidate.key === binding.key)
    if (binding.checkoutDestinationKey && binding.checkoutDestinationKey !== later?.checkoutDestinationKey)
      gaps.set(binding.key, 'checkout_destination_changed')
    else if (binding.purchaseControlKey && binding.purchaseControlKey !== later?.purchaseControlKey)
      gaps.set(binding.key, 'checkout_purchase_control_changed')
  }
  return gaps
}

/** Only independently completed bindings can certify their own result. */
export function recordedOutcomeBindingResults(coverage: unknown, kind: string | undefined) {
  const result = new Map<string, 'SUCCEEDED' | 'FAILED'>()
  const parsed = coverageSchema.safeParse(coverage)
  if (!parsed.success || !comparableOutcomeCoverage(coverage, coverage)) return result
  for (const binding of parsed.data.bindings) {
    if (!binding.result || !parsed.data.observedBindings?.includes(binding.key)) continue
    if (binding.result === 'SUCCEEDED' && binding.evaluator !== bindingEvaluator(kind, binding.mechanism, binding.config)) continue
    result.set(binding.key, binding.result)
  }
  return result
}

export function completeOutcomeEvidence(coverage: unknown, evidence: unknown): boolean {
  const parsed = coverageSchema.safeParse(coverage)
  return Boolean(parsed.success && comparableOutcomeCoverage(coverage, coverage) &&
    parsed.data.requiredBindings.every(key => parsed.data.observedBindings?.includes(key)) &&
    evidence && !Array.isArray(evidence) && typeof evidence === 'object' && Object.keys(evidence).length)
}
