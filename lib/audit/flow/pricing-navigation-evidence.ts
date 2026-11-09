import { z } from 'zod'
import type { CheckAssertion } from '../checks/assertion'
import { pricingNavigationContextSchema } from './action-context'

export const PRICING_NAVIGATION_RULE = 'Public pricing navigation v1: independently exercise the original rendered navigation control under the same page, capture and access conditions.'
export const pricingNavigationEvidenceSchema = z.object({
  context: pricingNavigationContextSchema, complete: z.boolean(), passed: z.boolean(),
  reason: z.enum(['visible-section', 'page-reached', 'missing-section', 'disabled', 'no-advance', 'http-error', 'unavailable', 'unexpected-destination', 'original-missing']),
}).strict()
export type PricingNavigationEvidence = z.infer<typeof pricingNavigationEvidenceSchema>
export const pricingNavigationTargetSchema = z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('desktop'), context: pricingNavigationContextSchema }).passthrough()
export function pricingNavigationAssertions(evidence?: PricingNavigationEvidence): CheckAssertion[] {
  if (!evidence) return []
  const reasons: Record<PricingNavigationEvidence['reason'], string> = {
    'visible-section': 'The original pricing link reached a visible section.', 'page-reached': 'The original pricing link reached a useful successful page.',
    'missing-section': 'The original link did not reveal its declared section.', disabled: 'The original pricing control is disabled.',
    'no-advance': 'The completed click did not advance within the observation window.', 'http-error': 'The original pricing link reached a failed main-frame response.',
    unavailable: 'The pricing navigation could not be completely observed.', 'unexpected-destination': 'The reached page could not establish the declared pricing destination.',
    'original-missing': 'The original pricing control is no longer available in this capture.',
  }
  return [{ key: 'pricing-navigation', name: 'Pricing navigation', expected: 'The original public pricing control reaches its visible section or a useful successful page.',
    observed: reasons[evidence.reason], passed: evidence.passed, complete: evidence.complete, context: evidence.context }]
}
