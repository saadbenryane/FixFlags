import { z } from 'zod'
import { canonicalIntent, type ExecutionSpec } from './execution-spec'
import { bindingEvaluator } from './outcome-evaluation'

export function admittedOutcomeCoverage(spec: ExecutionSpec, outcome: ExecutionSpec['outcomes'][number]) {
  const required = outcome.bindings.filter(binding => binding.required)
  return { environment: spec.environment, policy: outcome.bindingPolicy,
    requiredBindings: required.map(binding => binding.key),
    scope: outcome.kind === 'CHECKOUT' ? required.find(binding => binding.mechanism === 'BROWSER_JOURNEY')?.scope ?? null : null,
    bindings: required.map(binding => ({ key: binding.key, version: binding.version, mechanism: binding.mechanism,
      ...(bindingEvaluator(outcome.kind, binding.mechanism) ? { evaluator: bindingEvaluator(outcome.kind, binding.mechanism) } : {}),
      config: binding.config, scope: binding.scope ?? null, ...(binding.fixture ? { fixture: binding.fixture } : {}) })),
  }
}

const coverageSchema = z.object({ environment: z.string().min(1), policy: z.string().optional(),
  requiredBindings: z.array(z.string().min(1)).min(1).max(100), observedBindings: z.array(z.string()).max(100).optional(),
  bindings: z.array(z.object({ key: z.string().min(1), version: z.number().int().positive(), mechanism: z.string().min(1),
    evaluator: z.string().optional(),
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
      bindings: coverage.bindings.map(binding => { const identity = { ...binding }; delete identity.evaluator; return identity })
        .sort((left, right) => left.key.localeCompare(right.key)) })
  }
  const identity = normalized(before.data)
  return identity !== null && identity === normalized(after.data)
}

export function completeOutcomeEvidence(coverage: unknown, evidence: unknown): boolean {
  const parsed = coverageSchema.safeParse(coverage)
  return Boolean(parsed.success && comparableOutcomeCoverage(coverage, coverage) &&
    parsed.data.requiredBindings.every(key => parsed.data.observedBindings?.includes(key)) &&
    evidence && !Array.isArray(evidence) && typeof evidence === 'object' && Object.keys(evidence).length)
}
