import { z } from 'zod'
import { readSupportingObservations } from '../flag-observations'
import { FORM_VERIFICATION_RULE } from './form-evidence'
import { PRIMARY_ACTION_VERIFICATION_RULE } from './primary-action-evidence'
import { PRICING_NAVIGATION_RULE, pricingNavigationTargetSchema } from './pricing-navigation-evidence'
import { POST_CLICK_VERIFICATION_RULE, postClickActionContext } from '../checks/flow-post-click'
import { DESTINATION_TRUST_VERIFICATION_RULE, destinationTrustActionContext } from '../checks/flow-destination-trust'
import { DESTINATION_CONTENT_VERIFICATION_RULE, destinationContentActionContext } from '../checks/flow-destination-content'
import { ENGAGEMENT_VERIFICATION_RULE, engagementActionContext } from '../network-engagement-evidence'

type Source = { pageUrl: string | null; verificationRule: string | null; evidenceTargets: unknown; supportingObservations?: unknown }

/** Preserve each original page's controls, including observations combined into
 * one Flag. A display representative cannot move another page's action scope. */
export function originalPageActionTargets(sources: Source[], pageUrl: string) {
  return sources.flatMap<Source>(source => readSupportingObservations(source.supportingObservations)?.items ?? [source])
    .filter(source => source.pageUrl === pageUrl).flatMap(source => !Array.isArray(source.evidenceTargets) ? [] : source.evidenceTargets.map(target => ({
      verificationRule: source.verificationRule, target,
    })))
}

export function originalPageActionContexts(sources: Source[], pageUrl: string): string[] {
  const contexts = originalPageActionTargets(sources, pageUrl).flatMap(({ verificationRule, target }) => {
    if (verificationRule === ENGAGEMENT_VERIFICATION_RULE) return engagementActionContext(target) ?? []
    if (verificationRule === POST_CLICK_VERIFICATION_RULE) return postClickActionContext(target) ?? []
    if (verificationRule === DESTINATION_TRUST_VERIFICATION_RULE) return destinationTrustActionContext(target) ?? []
    if (verificationRule === DESTINATION_CONTENT_VERIFICATION_RULE) return destinationContentActionContext(target) ?? []
    if (verificationRule === PRICING_NAVIGATION_RULE) {
      const parsed = pricingNavigationTargetSchema.safeParse(target)
      return parsed.success ? [parsed.data.context] : []
    }
    const parsed = z.object({ context: z.string().regex(verificationRule === FORM_VERIFICATION_RULE
      ? /^form:[a-f0-9]{64}$/ : /^flow:control:[a-f0-9]{64}$/) }).safeParse(target)
    return (verificationRule === FORM_VERIFICATION_RULE || verificationRule === PRIMARY_ACTION_VERIFICATION_RULE) && parsed.success ? [parsed.data.context] : []
  })
  return [...new Set(contexts)].sort()
}
