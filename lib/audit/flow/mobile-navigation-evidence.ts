import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { CheckAssertion } from '../checks/assertion'
import type { DeterministicFlag } from '../flag-types'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'

export const MOBILE_NAVIGATION_RULE = 'Mobile navigation observation v1'
export const mobileNavigationObservationSchema = z.object({
  context: z.string().regex(/^mobile-nav:[a-f0-9]{64}$/), selector: z.string().min(1).max(2000), label: z.string().min(1).max(160),
  complete: z.boolean(), opened: z.boolean(), reason: z.string().min(1).max(160),
  links: z.array(z.object({ identity: z.string().regex(/^[a-f0-9]{64}$/), selector: z.string().min(1).max(2000), label: z.string().min(1).max(160),
    reachable: z.boolean() }).strict()).max(40),
}).strict()
export type MobileNavigationObservation = z.infer<typeof mobileNavigationObservationSchema>
export function mobileNavigationContext(scope: CaptureObservationScope, selector: string) {
  return 'mobile-nav:' + createHash('sha256').update(JSON.stringify([captureObservationKey(scope), selector])).digest('hex')
}
export function mobileLinkIdentity(href: string, label: string) {
  return createHash('sha256').update(JSON.stringify([href, label])).digest('hex')
}
export const mobileNavigationTargetSchema = z.object({
  selector: z.string().min(1).max(2000), label: z.string().min(1).max(160), context: z.string().max(4200),
}).passthrough()
export function readMobileNavigationTarget(value: unknown) {
  const parsed = mobileNavigationTargetSchema.safeParse(value)
  if (!parsed.success) return undefined
  const parts = /^(mobile-nav:[a-f0-9]{64}):(.*)$/.exec(parsed.data.context)
  if (!parts) return undefined
  try {
    const members = z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(40).safeParse(JSON.parse(parts[2]))
    return members.success ? { ...parsed.data, context: parts[1], members: members.data } : undefined
  } catch { return undefined }
}
export function mobileNavigationAssertions(observations: MobileNavigationObservation[]): CheckAssertion[] {
  const reasons: Record<string, string> = {
    navigation_observed: 'Navigation was observed', compact_navigation_visible: 'The compact navigation stays visible',
    mobile_menu_control_missing: 'This navigation has no usable menu button', mobile_menu_control_disabled: 'The menu button is disabled',
    declared_navigation_already_open: 'The menu is already open', original_navigation_links_visible: 'The menu shows its navigation links',
    declared_menu_did_not_reveal_links_within_1500ms: 'The menu did not show its links within 1.5 seconds',
    navigation_evidence_unavailable: 'This navigation could not be observed completely', menu_activation_unavailable: 'The menu button could not be activated',
    original_navigation_missing: 'The original navigation is no longer present', undeclared_navigation_scope: 'The button does not identify which navigation it opens',
    scanner_boundary_or_page_change: 'The page changed or the browser could not continue this observation safely',
  }
  return observations.map(observation => ({ key: 'mobile-navigation', name: 'Mobile navigation opens',
    expected: 'Navigation links are visible at phone width, inside a working menu when needed',
    observed: `${reasons[observation.reason] ?? 'Navigation was observed'}. ${observation.links.filter(link => link.reachable).length} of ${observation.links.length} navigation links are visible at phone width (375px).`,
    context: observation.context, passed: observation.opened && observation.links.length > 0 && observation.links.every(link => link.reachable),
    complete: observation.complete, targets: observation.links.map(link => ({ selector: link.selector, label: link.label,
      context: 'mobile-nav-link:' + link.identity + ':' + (link.reachable ? 'reachable' : 'hidden') })) }))
}
export function mobileNavigationFlags(observations: MobileNavigationObservation[], pageUrl: string): DeterministicFlag[] {
  return observations.flatMap(observation => {
    const assertion = mobileNavigationAssertions([observation])[0]
    return assertion.complete && !assertion.passed ? [{ checkId: 'flow-mobile-menu-broken', rubric: 'EXPERIENCE' as const,
      impactTag: 'CONVERSION', severity: 'IMPORTANT' as const, problem: 'Mobile navigation needs a working menu',
      evidence: assertion.observed, fix: '1. Provide a working menu control at 375px width\n2. Keep the original navigation links visible and usable inside the open menu\n3. Recheck the menu after the change',
      confidence: 0.9, source: 'DETERMINISTIC' as const, pageUrl, verificationRule: MOBILE_NAVIGATION_RULE,
      evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'mobile' as const, selector: observation.selector,
        label: observation.label, context: observation.context + ':' + JSON.stringify(observation.links.map(link => link.identity)) }] }] : []
  })
}
