import { z } from 'zod'
import { MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'

export const SLOW_REPLAY_VERIFICATION_RULE = 'Slow connection observation v1'
export const SLOW_3G = { offline: false, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024, latency: 400 }
export const SLOW_REPLAY_PROFILE = 'mobile-slow-3g-v1:' + JSON.stringify({ viewport: MOBILE_CAPTURE_PROFILE, network: SLOW_3G,
  interactions: 'public-read-only', content: 'viewport-text-or-decoded-main-image' })
const milliseconds = z.number().finite().nonnegative()
export const slowActionContextSchema = z.object({ profile: z.literal(SLOW_REPLAY_PROFILE), pageUrl: z.string().url(), href: z.string().url().nullable() }).strict()
export const slowActionIdentitySchema = z.object({ selector: z.string().min(1).max(2000), label: z.string().min(1).max(160),
  context: z.string().min(1).max(4200) }).strict()
export type SlowActionIdentity = z.infer<typeof slowActionIdentitySchema>
/** DOM paths help locate evidence. The observed action name, destination and conditions own its timing identity. */
export function sameSlowActionIdentity(left: SlowActionIdentity, right: SlowActionIdentity): boolean {
  return left.label === right.label && left.context === right.context
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
  observedForMs: milliseconds.optional(), textBlankThroughMs: milliseconds.optional(), ctaAbsentThroughMs: milliseconds.optional(),
  timeToContentMs: milliseconds.optional(), contentAbsentThroughMs: milliseconds.optional(),
  actions: z.array(slowActionIdentitySchema.extend({ timeToVisibleMs: milliseconds, absentThroughMs: milliseconds }).strict()).max(20).optional(),
  captures: z.array(z.object({ targetMs: milliseconds, startedAtMs: milliseconds, capturedAtMs: milliseconds.nullable().optional(), completedAtMs: milliseconds,
    url: z.string().url().nullable() }).strict()).max(3).optional(),
}).strict()
export type SlowReplayResult = z.infer<typeof slowReplayResultSchema>
