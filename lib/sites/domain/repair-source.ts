import { z } from 'zod'
import { jsonValueSchema } from '@/lib/json-value'

/** Comparison facts belong to the declaration. The live Flag remains free to
 * accumulate observations and is closed only by proof covering its live facts. */
export const repairSourcesSchema = z.object({ version: z.literal(1), flags: z.array(z.object({
  id: z.string().min(1), auditId: z.string().min(1), source: z.enum(['AI', 'DETERMINISTIC', 'JOURNEY']),
  checkId: z.string().nullable(), fingerprint: z.string().nullable(), pageUrl: z.string().nullable(),
  affectedPaths: jsonValueSchema, attentionPolicy: jsonValueSchema, verificationRule: z.string().nullable(),
  evidenceTargets: jsonValueSchema, supportingObservations: jsonValueSchema,
}).strict()).min(1).max(5000) }).strict().superRefine((value, context) => {
  if (new Set(value.flags.map(flag => flag.id)).size !== value.flags.length)
    context.addIssue({ code: 'custom', message: 'Duplicate repair source' })
})
export type RepairSources = z.infer<typeof repairSourcesSchema>
export function readRepairSources(value: unknown): RepairSources | null {
  const parsed = repairSourcesSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
export const repairSourceSelect = {
  id: true, auditId: true, source: true, checkId: true, fingerprint: true, pageUrl: true,
  affectedPaths: true, attentionPolicy: true, verificationRule: true, evidenceTargets: true, supportingObservations: true,
} as const
