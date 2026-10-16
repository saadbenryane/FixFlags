import { z } from 'zod'
import { MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'
import { createHash } from 'node:crypto'
import { captureObservationKey, captureObservationScopeSchema } from '../browser/observation-scope'

export const SLOW_REPLAY_VERIFICATION_RULE = 'Slow connection observation v2'
export const SLOW_REPLAY_CONTEXT = /^slow-replay:v2:[a-f0-9]{64}$/
export const SLOW_3G = { offline: false, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024, latency: 400 }
export const SLOW_REPLAY_PROFILE = 'mobile-slow-3g-v1:' + JSON.stringify({ viewport: MOBILE_CAPTURE_PROFILE, network: SLOW_3G,
  interactions: 'public-read-only', content: 'viewport-text-or-decoded-main-image' })
const milliseconds = z.number().finite().nonnegative()
export const slowActionContextSchema = z.object({ profile: z.literal(SLOW_REPLAY_PROFILE), pageUrl: z.string().url(), href: z.string().url().nullable(),
  captureKey: z.string().regex(/^[a-f0-9]{64}$/).optional(), sourcePageKey: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict()
export const slowActionIdentitySchema = z.object({ selector: z.string().min(1).max(2000), label: z.string().min(1).max(160),
  context: z.string().min(1).max(4200) }).strict()
export type SlowActionIdentity = z.infer<typeof slowActionIdentitySchema>
/** DOM paths help locate evidence. The observed action name, destination and conditions own its timing identity. */
export function sameSlowActionIdentity(left: SlowActionIdentity, right: SlowActionIdentity): boolean {
  return left.label === right.label && left.context === right.context
}
/** Locate and time the original control independently of the later scope comparison. */
export function slowActionForObservation(action: SlowActionIdentity): SlowActionIdentity {
  const { profile, pageUrl, href } = slowActionContextSchema.parse(JSON.parse(action.context))
  return { ...action, context: JSON.stringify({ profile, pageUrl, href }) }
}
export function readSlowActionTargets(value: unknown): SlowActionIdentity[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).flatMap(target => {
    const parsed = z.object({ kind: z.literal('element'), source: z.literal('measured'), device: z.literal('mobile'),
      ...slowActionIdentitySchema.shape }).passthrough().safeParse(target)
    if (!parsed.success) return []
    try {
      if (!slowActionContextSchema.safeParse(JSON.parse(parsed.data.context)).success) return []
      return [{ selector: parsed.data.selector, label: parsed.data.label, context: parsed.data.context }]
    } catch { return [] }
  })
}
export const slowReplayResultSchema = z.object({
  timeToFirstTextMs: milliseconds, timeToCtaMs: milliseconds,
  screenshotUrls: z.array(z.string().url()).max(10), complete: z.boolean().optional(),
  profile: z.string().max(800).optional(), pageUrl: z.string().url().optional(),
  navigationComplete: z.boolean().optional(), reason: z.enum(['navigation_unavailable', 'interrupted', 'observation_incomplete']).optional(),
  restricted: z.boolean().optional(),
  scope: captureObservationScopeSchema.optional(),
  observedForMs: milliseconds.optional(), textBlankThroughMs: milliseconds.optional(), ctaAbsentThroughMs: milliseconds.optional(),
  timeToContentMs: milliseconds.optional(), contentAbsentThroughMs: milliseconds.optional(),
  actions: z.array(slowActionIdentitySchema.extend({ timeToVisibleMs: milliseconds, absentThroughMs: milliseconds }).strict()).max(20).optional(),
  captures: z.array(z.object({ targetMs: milliseconds, startedAtMs: milliseconds, capturedAtMs: milliseconds.nullable().optional(), completedAtMs: milliseconds,
    url: z.string().url().nullable() }).strict()).max(3).optional(),
}).strict()
export type SlowReplayResult = z.infer<typeof slowReplayResultSchema>

export function slowReplayCaptureKey(result: Pick<SlowReplayResult, 'profile' | 'scope'>): string | undefined {
  if (result.profile !== SLOW_REPLAY_PROFILE || !result.scope) return undefined
  const capture = captureObservationKey(result.scope)
  return capture === 'unknown' ? undefined : createHash('sha256').update(JSON.stringify([result.profile, capture])).digest('hex')
}
