import { z } from 'zod'
import { captureObservationKey, captureObservationScopeSchema } from '../browser/observation-scope'
import type { CaptureMetrics } from '../capture-metrics'
import type { CheckAssertion } from './assertion'
import type { DeterministicFlag } from '../flag-types'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'

export const MOTION_VERIFICATION_RULE = 'Initial reduced-motion observation v1'
export const MOTION_FAMILIES = ['css', 'transition', 'script'] as const
const targetSchema = z.object({ family: z.enum(MOTION_FAMILIES), selector: z.string().min(1).max(2000), label: z.string().min(1).max(160), sample: z.string().max(160) }).strict()
export const motionWindowSchema = z.object({ version: z.literal(1), pageUrl: z.string().url(), reduced: z.boolean(), targets: z.array(targetSchema).max(100),
  complete: z.boolean(), windowMs: z.number().finite().nonnegative(), observedMs: z.number().finite().nonnegative(), restricted: z.boolean(), contentVisible: z.boolean() }).strict()
export const motionObservationSchema = z.object({ version: z.literal(1), scope: captureObservationScopeSchema,
  before: motionWindowSchema, after: motionWindowSchema }).strict()
export type MotionObservation = z.infer<typeof motionObservationSchema>
export function motionRequested(spec: ExecutionSpec | null | undefined): boolean {
  return Boolean(spec?.checks['motion-ignores-reduced-preference'] && (spec.scope !== 'DIAGNOSTIC' ||
    spec.verificationTarget?.kind === 'DIAGNOSTIC' && spec.verificationTarget.checkId.split('::page:')[0] === 'motion-ignores-reduced-preference'))
}

export function motionAssertions(value: unknown): CheckAssertion[] {
  const parsed = motionObservationSchema.safeParse(value)
  if (!parsed.success) return [{ key: 'reduced-motion', name: 'Reduced-motion behavior', expected: 'Comparable normal and reduced startup observations',
    observed: 'Paired initial motion evidence is unavailable.', passed: false, complete: false }]
  const { before, after, scope } = parsed.data
  const hash = captureObservationKey(scope)
  const comparable = hash !== 'unknown' && before.complete && after.complete && !before.restricted && !after.restricted && !before.reduced && after.reduced &&
    before.windowMs === after.windowMs && before.pageUrl === after.pageUrl && after.pageUrl === scope.finalUrl
  return MOTION_FAMILIES.map(family => {
    const normal = before.targets.filter(target => target.family === family), reduced = after.targets.filter(target => target.family === family)
    const failed = reduced.length > 0 && reduced.length >= Math.ceil(normal.length * 0.5)
    const content = before.contentVisible && after.contentVisible
    const members = new Map([...normal, ...reduced].map(target => [JSON.stringify([target.selector, target.label]), target]))
    return { key: 'reduced-motion', name: 'Initial reduced motion (' + family + ')', expected: 'Significant moving elements fall below half their normal count under reduced motion',
      observed: `${family}: ${normal.length} moving elements under normal preference, ${reduced.length} under reduced preference during the ${before.windowMs}ms startup window.`,
      passed: comparable && !failed && content, complete: comparable && (failed || content), context: 'motion:' + hash + ':' + before.windowMs + ':' + family,
      targets: [...members.values()].map(target => ({ selector: target.selector, label: target.label,
        context: normal.some(member => member.selector === target.selector && member.label === target.label)
          ? reduced.some(member => member.selector === target.selector && member.label === target.label) ? 'both' : 'before' : 'after' })) }
  })
}
export function applyMotionObservation(metrics: CaptureMetrics, observation: MotionObservation): CaptureMetrics {
  const assertions = motionAssertions(observation)
  return { ...metrics, motionObservation: observation, motionComplete: assertions.every(assertion => assertion.complete === true),
    motionIgnoresReducedPreference: assertions.some(assertion => assertion.complete === true && !assertion.passed),
    motionSampleLabel: observation.after.targets[0]?.sample ?? null }
}
export function scopeMotionFlag(flag: DeterministicFlag, observation: unknown): DeterministicFlag {
  const parsed = motionObservationSchema.safeParse(observation)
  if (!parsed.success) return flag
  const failed = motionAssertions(parsed.data).filter(assertion => assertion.complete && !assertion.passed)
  if (!failed.length) return flag
  return { ...flag, verificationRule: MOTION_VERIFICATION_RULE, evidenceTargets: failed.flatMap(assertion => {
    const family = assertion.context!.split(':').at(-1)!
    const count = parsed.data.before.targets.filter(target => target.family === family).length
    return assertion.targets!.map(target => ({ kind: 'element' as const, source: 'measured' as const, device: 'mobile' as const,
      selector: target.selector, label: target.label, context: assertion.context + ':baseline:' + count }))
  }) }
}
