import { createHash } from 'node:crypto'
import type { CheckAssertion } from './assertion'
import type { DeterministicFlag } from '../flag-types'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'

export const RENDERED_PAGE_VERIFICATION_RULE = 'Rendered page observation: repeat the same page, redirect, browser profile and access conditions.'
export const RENDERED_PAGE_CONTEXT = /^rendered-page:[a-f0-9]{64}$/
// These page-level observations do not have a more specific control or transport contract.
const modules = new Set(['metadata', 'trust', 'content', 'slop', 'measurement', 'messaging-clarity',
  'conversion-friction', 'trust-psychology', 'layout', 'cta-focus', 'visual-polish', 'visual-hierarchy', 'mobile-ux-quality'])
const mobileMetrics = new Set(['layout', 'cta-focus', 'visual-polish', 'visual-hierarchy', 'mobile-ux-quality'])
export function hasRenderedPageResponsibility(module: string) { return modules.has(module) }

/** Detection survives missing scope; independent recovery requires the original native conditions. */
export function scopeRenderedPageEvidence(input: { module: string; flags: DeterministicFlag[]; assertions: CheckAssertion[];
  desktop?: CaptureObservationScope; mobile?: CaptureObservationScope }) {
  if (!modules.has(input.module)) return { flags: input.flags, assertions: input.assertions }
  // Mobile input, action and loading measurements own their mobile window.
  // A bounded desktop document is a separate source, not their comparison gate.
  const scopes = input.module === 'mobile-ux-quality' ? [input.mobile]
    : mobileMetrics.has(input.module) ? [input.desktop, input.mobile] : [input.desktop]
  const keys = scopes.map(scope => scope ? captureObservationKey(scope) : 'unknown')
  const complete = keys.every(key => key !== 'unknown')
  const context = 'rendered-page:' + (complete ? createHash('sha256').update(JSON.stringify([input.module, keys])).digest('hex') : 'unknown')
  const inputControl = (source?: string) => input.module === 'mobile-ux-quality' && source?.startsWith('mobile-input:')
  const targetContext = (source?: string) => inputControl(source)
    ? 'rendered-page:' + (complete && /^mobile-input:[a-f0-9]{64}$/.test(source!)
      ? createHash('sha256').update(JSON.stringify([input.module, keys, source])).digest('hex') : 'unknown') : context
  return {
    flags: input.flags.map(flag => flag.verificationRule ? flag : { ...flag, verificationRule: RENDERED_PAGE_VERIFICATION_RULE,
      evidenceTargets: flag.evidenceTargets?.length ? flag.evidenceTargets.map(target => ({ ...target, context: targetContext(target.context) }))
        : [{ kind: 'page' as const, source: 'measured' as const, device: mobileMetrics.has(input.module) ? 'mobile' as const : 'desktop' as const,
          label: 'Observed page', context }] }),
    assertions: input.assertions.map(assertion => {
      if (assertion.context && !inputControl(assertion.context)) return assertion
      const scoped = targetContext(assertion.context)
      return { ...assertion, context: scoped,
        ...(assertion.targets ? { targets: assertion.targets.map(target => inputControl(target.context)
          ? { ...target, context: targetContext(target.context) } : target) } : {}),
        ...(scoped === 'rendered-page:unknown' ? { complete: false } : {}) }
    }),
  }
}
