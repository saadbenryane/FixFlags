import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { CheckAssertion } from '../checks/assertion'
import type { DeterministicFlag } from '../flag-types'
import { PRIMARY_ACTION_ASSERTIONS } from '../checks/definitions'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'
import { primaryActionControlKey } from './action-context'

export const PRIMARY_ACTION_VERIFICATION_RULE = 'Public primary action: independently exercise the same observed page and control; missing or changed action scope cannot establish repair.'
export const PRIMARY_ACTION_CHECKS = Object.values(PRIMARY_ACTION_ASSERTIONS).flat()
export const primaryActionEvidenceSchema = z.object({
  version: z.literal(1), pageContext: z.string().regex(/^flow:page:[a-f0-9]{64}$/),
  controlContext: z.string().regex(/^flow:control:[a-f0-9]{64}$/).nullable(),
  candidateCount: z.number().int().min(0).max(10000), clicked: z.boolean(), clickBlocked: z.boolean(),
  candidateComplete: z.boolean().optional(), presenceVersion: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  navigation: z.enum(['changed', 'same', 'unknown']),
  samePageProgress: z.enum(['declared-panel', 'semantic-panel', 'rendered-route']).optional(),
  response: z.enum(['healthy', 'error', 'restricted', 'challenge', 'unknown']),
  responseExpected: z.boolean(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  destinationContentObserved: z.boolean().optional(),
  responseDestinationKey: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
}).strict()
export type PrimaryActionEvidence = z.infer<typeof primaryActionEvidenceSchema>
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function primaryPageContext(requested: string, observed: string, viewport: { width: number; height: number } | null, scope?: CaptureObservationScope) {
  return 'flow:page:' + hash([requested, observed, viewport, ...(scope ? [captureObservationKey(scope)] : [])])
}
export function primaryControlContext(input: { pageContext: string; identity: string; label: string; href: string | null; controls: string | null }) {
  return 'flow:control:' + hash([input.pageContext, input.identity, input.label.trim().replace(/\s+/g, ' '), input.href, input.controls])
}

export function primaryActionResponseDestinationKey(url: string) {
  return hash(url)
}

export function primaryActionAssertions(evidence: PrimaryActionEvidence | undefined, actionRequired: boolean | null = true): CheckAssertion[] {
  if (!evidence) return []
  const base = { expected: 'An applicable primary action is visible in the inspected viewport',
    observed: `${evidence.candidateCount} applicable visible controls recorded. This does not establish completed signup, payment or other business outcomes.` }
  const assertions: CheckAssertion[] = [{ key: 'primary-action-presence', name: 'Visible primary action', ...base,
    passed: evidence.candidateCount > 0, complete: evidence.candidateComplete !== false && (actionRequired !== null || evidence.candidateCount > 0),
    context: evidence.presenceVersion ? 'flow:page:' + hash([evidence.pageContext, 'rendered-action-presence-v' + evidence.presenceVersion]) : evidence.pageContext,
    ...(actionRequired === false && evidence.candidateCount === 0 ? { disposition: 'observed' as const } : {}) }]
  if (!evidence.controlContext) return assertions
  assertions.push({ key: 'primary-action-click', name: 'Primary control receives a click',
    expected: 'The same visible primary control receives the browser click',
    observed: evidence.clicked ? 'The browser completed the click on this control.' : evidence.clickBlocked ? 'The recorded control was disabled or covered at click time.' : 'The click could not be conclusively observed.',
    passed: evidence.clicked, complete: evidence.clicked || evidence.clickBlocked, context: evidence.controlContext })
  const restricted = evidence.response === 'restricted' || evidence.response === 'challenge'
  const destinationIncomplete = evidence.destinationContentObserved === false
  const responseScopeMissing = evidence.responseExpected && evidence.responseDestinationKey === null
  const responseContext = evidence.responseDestinationKey
    ? `flow:response:v1:${primaryActionControlKey(evidence.controlContext)}:${evidence.responseDestinationKey}`
    : evidence.controlContext
  const navigationIncomplete = destinationIncomplete && evidence.navigation === 'changed' && !evidence.samePageProgress
  assertions.push({ key: 'primary-action-navigation', name: 'Primary action advances',
    expected: 'The original action reaches a page or opens an observed next step',
    observed: restricted ? 'The action reached an access restriction; its intended destination remains unknown.'
      : navigationIncomplete ? 'The browser URL changed, but usable destination content could not be confirmed.' : evidence.navigation === 'changed'
      ? evidence.samePageProgress === 'rendered-route' ? 'The declared browser route rendered different page content and a new heading after the click.'
        : evidence.samePageProgress === 'semantic-panel' ? 'A visible dialog or form with an available next step appeared after the click.'
        : evidence.samePageProgress === 'declared-panel' ? 'The click opened the control’s declared panel.' : 'The click changed the browser URL.' : evidence.navigation === 'same'
        ? 'The declared navigation completed its observation window without advancing.' : 'No conclusive action advancement was recorded.',
    passed: !restricted && !navigationIncomplete && evidence.navigation === 'changed',
    complete: !restricted && !navigationIncomplete && evidence.navigation !== 'unknown', context: evidence.controlContext })
  assertions.push({ key: 'primary-action-response', name: 'Primary action destination response',
    expected: 'The same action reaches a normal successful main-frame response',
    observed: !evidence.responseExpected ? 'This declared on-page action does not require a main-frame HTTP navigation.'
      : evidence.httpStatus === null ? 'No comparable main-frame HTTP response was observed.'
        : destinationIncomplete ? `Main-frame HTTP ${evidence.httpStatus} was observed, but usable destination content could not be confirmed.`
          : `Main-frame HTTP ${evidence.httpStatus}: ${evidence.response}.`,
    passed: !evidence.responseExpected || !responseScopeMissing && !destinationIncomplete && evidence.response === 'healthy',
    complete: !evidence.responseExpected || !responseScopeMissing && !destinationIncomplete && ['healthy', 'error'].includes(evidence.response),
    ...(!evidence.responseExpected ? { disposition: 'observed' as const } : {}), context: responseContext })
  return assertions
}

const assertionKeys: Record<string, string> = Object.fromEntries(Object.entries(PRIMARY_ACTION_ASSERTIONS).flatMap(([key, ids]) => ids.map(id => [id, key])))
/** Keep historical findings intact. Current findings retain only observed failures
 * and bind their repair to the same recorded page or control. */
export function scopePrimaryActionFlags(flags: DeterministicFlag[], evidence: PrimaryActionEvidence | undefined) {
  if (!evidence) return flags
  const assertions = primaryActionAssertions(evidence)
  return flags.flatMap(flag => {
    const key = assertionKeys[flag.checkId]
    if (!key) return [flag]
    const assertion = assertions.find(item => item.key === key && item.complete && !item.passed)
    return assertion ? [{ ...flag, verificationRule: PRIMARY_ACTION_VERIFICATION_RULE,
      evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const,
        label: flag.checkId === 'flow-no-cta-found' ? 'Primary action viewport' : 'Primary action', context: assertion.context }] }] : []
  })
}
