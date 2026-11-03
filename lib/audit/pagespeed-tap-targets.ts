import { z } from 'zod'
import type { CheckAssertion } from './checks/assertion'
import { lighthouseRecord, lighthouseScore } from './lighthouse-audit'

const AUDIT_IDS = ['target-size', 'tap-targets', 'tap-targets-too-small'] as const
export const tapTargetAuditsSchema = z.array(z.object({
  id: z.enum(AUDIT_IDS), title: z.string().max(1000),
  score: z.number().finite().min(0).max(1).nullable(),
  itemsCount: z.number().int().nonnegative().max(100_000).optional(),
}).strict()).max(3).superRefine((audits, context) => {
  if (new Set(audits.map(audit => audit.id)).size !== audits.length)
    context.addIssue({ code: 'custom', message: 'Duplicate tap-target audit identity' })
})
export type TapTargetAudit = z.infer<typeof tapTargetAuditsSchema>[number]
export const TAP_TARGET_VERIFICATION_RULE = 'Mobile tap-target provider audit v1'
export const TAP_TARGET_CONTEXT = /^pagespeed-tap-targets:(target-size|tap-targets|tap-targets-too-small)$/

/** Preserve the provider's criteria, including measured success. DOM snippets
 * and control values are not part of the normalized observation. */
export function readTapTargetAudits(audits: Record<string, unknown>): TapTargetAudit[] {
  return AUDIT_IDS.flatMap(id => {
    if (!Object.hasOwn(audits, id)) return []
    const audit = lighthouseRecord(audits[id])
    const details = lighthouseRecord(audit?.details)
    return [{ id, title: (typeof audit?.title === 'string' ? audit.title : id).slice(0, 1000),
      score: lighthouseScore(audit),
      ...(Array.isArray(details?.items) && details.items.length <= 100_000 ? { itemsCount: details.items.length } : {}) }]
  })
}

export function tapTargetObservations(audits: TapTargetAudit[] | undefined): CheckAssertion[] {
  if (!audits?.length) return [{ key: 'tap-targets', name: 'Mobile tap targets',
    expected: 'The original mobile target audit passes', observed: 'No tap-target audit measurement is available.', passed: false, complete: false }]
  return audits.map(audit => ({ key: 'tap-targets', name: 'Mobile tap targets',
    expected: `The mobile ${audit.id} audit passes its size and spacing criteria`,
    observed: `${audit.id}: ${audit.score === null ? 'measurement unavailable' : 'score ' + audit.score}${audit.itemsCount === undefined ? '' : ', ' + audit.itemsCount + ' reported items'}`,
    passed: audit.score === 1, complete: audit.score !== null, context: 'pagespeed-tap-targets:' + audit.id }))
}
