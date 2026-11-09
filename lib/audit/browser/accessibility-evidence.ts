import { z } from 'zod'
import type { AxeResults } from 'axe-core'
import type { AxeViolation } from '../checks/accessibility'
import { AXE_DOCUMENT_SCOPE_CONTEXT } from '../checks/accessibility-rules'
import { captureObservationScopeSchema, type CaptureObservationScope } from './observation-scope'

export const accessibilityEvidenceSchema = z.object({
  documentScope: z.literal(AXE_DOCUMENT_SCOPE_CONTEXT).optional(),
  scope: captureObservationScopeSchema, engine: z.string().min(1).max(100),
  rules: z.array(z.object({ id: z.string().min(1).max(160), state: z.enum(['passed', 'failed', 'incomplete', 'inapplicable']),
    nodes: z.number().int().nonnegative() }).strict()).max(300),
  embeddedScopes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).optional(),
}).strict()
export type AccessibilityEvidence = z.infer<typeof accessibilityEvidenceSchema>
export type MobileAccessibilityCapture = { evidence?: AccessibilityEvidence; violations?: AxeViolation[] }

/** Engine internals include transient undefined fields, which are not durable
 * JSON evidence. Keep the exact contract consumed by findings and fix prompts. */
export function recordedAxeViolations(results: AxeResults): AxeViolation[] {
  return results.violations.map(violation => ({ id: violation.id, impact: violation.impact as AxeViolation['impact'],
    description: violation.description, help: violation.help, helpUrl: violation.helpUrl,
    nodes: violation.nodes.map(node => ({ html: node.html, target: node.target.map(part => typeof part === 'string' ? part : [...part]),
      failureSummary: node.failureSummary ?? 'The automated rule reported this element as failing.' })) }))
}

/** Project the configured same-origin collector without reinterpreting frame ownership.
 * Retain positive and unresolved outcomes without persisting the full axe trace. */
export function summarizeAccessibility(results: AxeResults, scope: CaptureObservationScope): AccessibilityEvidence {
  const rules = new Map<string, AccessibilityEvidence['rules'][number]>()
  const weights = { inapplicable: 0, passed: 1, incomplete: 2, failed: 3 }
  for (const [bucket, state] of [['inapplicable', 'inapplicable'], ['passes', 'passed'], ['incomplete', 'incomplete'], ['violations', 'failed']] as const) {
    for (const result of results[bucket]) {
      const nodes = result.nodes.length
      const observed = nodes ? state : 'inapplicable'
      const prior = rules.get(result.id)
      rules.set(result.id, { id: result.id, state: weights[observed] > weights[prior?.state ?? 'inapplicable'] ? observed : prior?.state ?? observed,
        nodes: nodes + (prior?.nodes ?? 0) })
    }
  }
  return accessibilityEvidenceSchema.parse({ documentScope: AXE_DOCUMENT_SCOPE_CONTEXT, scope, engine: results.testEngine.version, rules: [...rules.values()].sort((a, b) => a.id.localeCompare(b.id)) })
}
