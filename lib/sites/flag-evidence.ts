import { z } from 'zod'

const reference = z.object({ selector: z.string().max(2000).optional(), label: z.string().max(300).optional(),
  device: z.enum(['desktop', 'mobile']).optional() })
export type FlagEvidenceContext = {
  source: string | null; recordedAt: string | null; auditId: string;
  references: Array<z.infer<typeof reference>>;
}

/** Display references only. Raw request data and private comparison context remain server-side. */
export function flagEvidenceContext(flag: { source?: string; createdAt?: Date; auditId: string; evidenceTargets?: unknown }): FlagEvidenceContext {
  const references = Array.isArray(flag.evidenceTargets) ? flag.evidenceTargets.slice(0, 20).flatMap(value => {
    const parsed = reference.safeParse(value)
    return parsed.success && (parsed.data.selector || parsed.data.label || parsed.data.device) ? [parsed.data] : []
  }) : []
  return { source: flag.source ?? null, recordedAt: flag.createdAt instanceof Date ? flag.createdAt.toISOString() : null,
    auditId: flag.auditId, references }
}
