import { z } from 'zod'
import { createHash } from 'node:crypto'
import { captureObservationKey, captureObservationScopeSchema, capturePageKey, type CaptureObservationScope } from '../browser/observation-scope'
import type { CheckAssertion } from './assertion'
import { runOverlayBlockerChecks } from './overlay'
import type { DeterministicFlag } from '../flag-types'
import { checkReceiptSchema } from './receipt'

export const INITIAL_OVERLAY_VERIFICATION_RULE = 'Initial control overlay observation v1'
export const OVERLAY_VERIFICATION_RULE = 'Control overlay observation v2'
export const scopedOverlayRule = (rule: unknown) => rule === OVERLAY_VERIFICATION_RULE || rule === INITIAL_OVERLAY_VERIFICATION_RULE
export const OVERLAY_CONTEXT_PATTERN = /^overlay:[a-f0-9]{64}:[a-f0-9]{64}:(page_load|primary_action(?:_after)?|pricing_navigation(?:_after)?|(?:flow_)?form_validation(?:_after)?|journey_[a-z0-9_-]+):(nav|cta|form):[a-f0-9]{64}$/
export const OVERLAY_CHECKS = { nav: 'overlay-blocks-nav', cta: 'overlay-blocks-cta', form: 'overlay-blocks-form' } as const
export const overlayTargetSchema = z.object({ kind: z.enum(['nav', 'cta', 'form']), selector: z.string().min(1).max(2000),
  label: z.string().min(1).max(160), context: z.string().regex(OVERLAY_CONTEXT_PATTERN) }).strict()
const blockerSchema = z.object({ tag: z.string(), id: z.string().nullable(), className: z.string(), role: z.string().nullable(), text: z.string(), zIndex: z.string(),
  coverageFraction: z.number().min(0).max(1).optional(), persisted: z.boolean().optional(), looksLikeOverlay: z.boolean().optional(), looksLikeConsentChrome: z.boolean().optional() }).strict()
export const overlayObservationSchema = z.object({ version: z.literal(1), device: z.enum(['desktop', 'mobile']), scope: captureObservationScopeSchema,
  phase: z.string().regex(/^(page_load|primary_action(?:_after)?|pricing_navigation(?:_after)?|(?:flow_)?form_validation(?:_after)?|journey_[a-z0-9_-]+)$/).max(160).optional(),
  complete: z.boolean(), contentVisible: z.boolean(), restricted: z.boolean(),
  controls: z.array(overlayTargetSchema.extend({ disposition: z.enum(['passed', 'failed', 'unknown']),
    reason: z.enum(['clear', 'consent_chrome', 'small_cover', 'persistent_overlay', 'unavailable', 'changed', 'unclassified_cover']),
    blocker: blockerSchema.nullable() }).strict()).max(100) }).strict()
export type OverlayTarget = z.infer<typeof overlayTargetSchema>
export type OverlayObservation = z.infer<typeof overlayObservationSchema>
export function overlayControlContext(scope: CaptureObservationScope, kind: OverlayTarget['kind'], identity: string, phase = 'page_load') {
  return 'overlay:' + capturePageKey(scope.pageUrl) + ':' + captureObservationKey(scope) + ':' + phase + ':' + kind + ':' + createHash('sha256').update(identity).digest('hex')
}
export function overlayAssertions(observation: OverlayObservation): CheckAssertion[] {
  const valid = captureObservationKey(observation.scope) !== 'unknown' && !observation.restricted && observation.contentVisible
  const prefix = 'overlay:' + capturePageKey(observation.scope.pageUrl) + ':' + captureObservationKey(observation.scope) + ':' + (observation.phase ?? 'page_load') + ':'
  const assertions: CheckAssertion[] = observation.controls.map(control => ({ key: 'overlay-' + control.kind, name: 'Persistent overlay on ' + control.kind,
    expected: 'The original visible enabled control has no persistent reportable overlay', observed: control.reason.replaceAll('_', ' ') + ': ' + control.label,
    passed: valid && control.context.startsWith(prefix + control.kind + ':') && control.disposition === 'passed',
    complete: valid && control.context.startsWith(prefix + control.kind + ':') && control.disposition !== 'unknown', context: control.context,
    targets: [{ selector: control.selector, label: control.label }] }))
  assertions.push({ key: 'overlay-scope', name: 'Control observation coverage', expected: 'Useful rendered content and the bounded control cohort were observed without scanner restrictions',
    observed: `${observation.controls.length} controls observed on ${observation.device} during ${observation.phase ?? 'page_load'}. Overlay observations do not establish completed business outcomes.`,
    passed: valid && observation.complete, complete: valid && observation.complete })
  return assertions
}
export function runObservedOverlayChecks(observation: OverlayObservation) {
  if (captureObservationKey(observation.scope) === 'unknown' || observation.restricted || !observation.contentVisible) return []
  const assertions = overlayAssertions(observation)
  return (Object.keys(OVERLAY_CHECKS) as Array<OverlayTarget['kind']>).flatMap(kind => {
    const failed = observation.controls.filter(control => control.kind === kind && control.disposition === 'failed' && control.blocker &&
      assertions.some(assertion => assertion.context === control.context && assertion.complete === true && !assertion.passed))
    const flags = failed.flatMap(control => runOverlayBlockerChecks(kind, control.blocker, control.label))
    if (!flags.length) return []
    const strongest = flags.find(flag => flag.severity === 'CRITICAL') ?? flags[0]
    return [{ ...strongest, verificationRule: OVERLAY_VERIFICATION_RULE, pageUrl: observation.scope.pageUrl,
      evidence: flags.map(flag => flag.evidence).join(' ').slice(0, 4000),
      evidenceTargets: failed.map(control => ({ kind: 'element' as const, source: 'measured' as const, device: observation.device,
        selector: control.selector, label: control.label, context: control.context })) }]
  })
}
/** Associate proof at the producing probe, never by a later matching title. */
export function scopedOverlayResult(kind: OverlayTarget['kind'], blocker: Parameters<typeof runOverlayBlockerChecks>[1], label?: string, observation?: OverlayObservation) {
  const scoped = observation ? runObservedOverlayChecks(observation).filter(flag => flag.checkId === OVERLAY_CHECKS[kind]) : []
  return scoped.length ? scoped : runOverlayBlockerChecks(kind, blocker, label)
}
export function overlayCheckReceipts(observations: OverlayObservation[], execution: { auditId: string; taskId: string; collectedAt: string }) {
  return observations.map(observation => {
    const assertions = overlayAssertions(observation)
    return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'overlays', pageUrl: observation.scope.pageUrl,
      applicable: true, assertions, complete: assertions.every(item => item.complete === true), passed: assertions.every(item => item.passed),
      limitation: 'Recorded control and interaction phase only. Overlay recovery does not establish a completed business outcome.',
      execution: { ...execution, checkVersion: 1, source: 'rendered-dom' } })
  })
}
export function overlayReceiptScope(receipt: ReturnType<typeof overlayCheckReceipts>[number]) {
  return ':control:' + receipt.assertions.find(assertion => assertion.context?.startsWith('overlay:'))?.context
}

/** Keep later walkthrough failures visible without letting a fresh initial
 * viewport observation certify an unrecorded interaction condition. */
export function preserveUnscopedOverlayFailures(flags: DeterministicFlag[]): DeterministicFlag[] {
  return flags.map(flag => Object.values(OVERLAY_CHECKS).some(id => id === flag.checkId.split('::page:')[0]) && !scopedOverlayRule(flag.verificationRule)
    ? { ...flag, evidenceTargets: [...flag.evidenceTargets ?? [], { kind: 'page', source: 'measured', device: 'desktop',
      label: 'Walkthrough cover with unavailable original control scope', context: 'overlay:unscoped:walkthrough' }] } : flag)
}
