import { z } from 'zod'
import type { AxeResults } from 'axe-core'
import { isIframeAxeTarget, type AxeViolation } from '../checks/accessibility'
import { captureObservationScopeSchema, type CaptureObservationScope } from './observation-scope'

export const accessibilityEvidenceSchema = z.object({
  scope: captureObservationScopeSchema, engine: z.string().min(1).max(100),
  rules: z.array(z.object({ id: z.string().min(1).max(160), state: z.enum(['passed', 'failed', 'incomplete', 'inapplicable']),
    nodes: z.number().int().nonnegative() }).strict()).max(300),
}).strict()
export type AccessibilityEvidence = z.infer<typeof accessibilityEvidenceSchema>

/** Engine internals include transient undefined fields, which are not durable
 * JSON evidence. Keep the exact contract consumed by findings and fix prompts. */
export function recordedAxeViolations(results: AxeResults): AxeViolation[] {
  return results.violations.map(violation => ({ id: violation.id, impact: violation.impact as AxeViolation['impact'],
    description: violation.description, help: violation.help, helpUrl: violation.helpUrl,
    nodes: violation.nodes.map(node => ({ html: node.html, target: node.target as string[],
      failureSummary: node.failureSummary ?? 'The automated rule reported this element as failing.' })) }))
}

/** Retain real positive and unresolved outcomes without persisting the full axe trace. */
export function summarizeAccessibility(results: AxeResults, scope: CaptureObservationScope): AccessibilityEvidence {
  const rules = new Map<string, AccessibilityEvidence['rules'][number]>()
  const weights = { inapplicable: 0, passed: 1, incomplete: 2, failed: 3 }
  for (const [bucket, state] of [['inapplicable', 'inapplicable'], ['passes', 'passed'], ['incomplete', 'incomplete'], ['violations', 'failed']] as const) {
    for (const result of results[bucket]) {
      const nodes = result.nodes.filter(node => !isIframeAxeTarget(node.target as string[])).length
      const observed = nodes ? state : 'inapplicable'
      const prior = rules.get(result.id)
      rules.set(result.id, { id: result.id, state: weights[observed] > weights[prior?.state ?? 'inapplicable'] ? observed : prior?.state ?? observed,
        nodes: nodes + (prior?.nodes ?? 0) })
    }
  }
  return accessibilityEvidenceSchema.parse({ scope, engine: results.testEngine.version, rules: [...rules.values()].sort((a, b) => a.id.localeCompare(b.id)) })
}
