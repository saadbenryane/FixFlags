import { z } from 'zod'
import type { EvidenceTarget } from './evidence-targets'

const targetSchema = z.object({
  kind: z.enum(['element', 'page']), source: z.literal('measured'), device: z.enum(['desktop', 'mobile']),
  rect: z.object({ x: z.number().finite(), y: z.number().finite(), width: z.number().finite(), height: z.number().finite() }).strict().optional(),
  selector: z.string().optional(), text: z.string().optional(), label: z.string(), context: z.string().optional(),
}).strict()

export const supportingObservationsSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({
    source: z.string().nullable(), checkId: z.string().nullable(), checkVersion: z.number().int().positive().nullable(),
    pageUrl: z.string().url().nullable(), evidence: z.string(), verificationRule: z.string().nullable(),
    evidenceTargets: z.array(targetSchema),
    provenance: z.object({ auditId: z.string().min(1), taskId: z.string().min(1),
      collectedAt: z.string().datetime().nullable() }).strict().nullable(),
  }).strict()).min(1).max(5000),
}).strict()

export type SupportingObservations = z.infer<typeof supportingObservationsSchema>
export type SupportingObservation = SupportingObservations['items'][number]
export const supportingObservationViewSchema = supportingObservationsSchema.shape.items.element.pick({
  source: true, checkId: true, checkVersion: true, pageUrl: true, evidence: true,
}).extend({ recordedAt: z.string().datetime().nullable(),
  references: z.array(targetSchema.pick({ device: true, label: true, selector: true })),
}).strict()
export type SupportingObservationView = z.infer<typeof supportingObservationViewSchema>
type ObservationInput = {
  source?: string | null; checkId?: string | null; pageUrl?: string | null; evidence?: string;
  verificationRule?: string | null; evidenceTargets?: EvidenceTarget[]; supportingObservations?: unknown;
}

export function readSupportingObservations(value: unknown): SupportingObservations | null {
  const parsed = supportingObservationsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Missing historical provenance stays unknown. Current registry state cannot supply it. */
export function observationsForFlag(flag: ObservationInput, origin?: {
  checkVersion: number | null; auditId: string; taskId: string; collectedAt?: string | null;
}): SupportingObservations {
  if (flag.supportingObservations != null) return supportingObservationsSchema.parse(flag.supportingObservations)
  return supportingObservationsSchema.parse({ version: 1, items: [{
    source: flag.source ?? null, checkId: flag.checkId ?? null, checkVersion: origin?.checkVersion ?? null,
    pageUrl: flag.pageUrl ?? null, evidence: flag.evidence ?? '', verificationRule: flag.verificationRule ?? null,
    evidenceTargets: flag.evidenceTargets ?? [],
    provenance: origin ? { auditId: origin.auditId, taskId: origin.taskId, collectedAt: origin.collectedAt ?? null } : null,
  }] })
}

/** Stable ordering and exact observation deduplication make replay idempotent. */
export function mergeSupportingObservations(values: SupportingObservations[]): SupportingObservations {
  const items = [...new Map(values.flatMap(value => value.items.map(item => [JSON.stringify(item), item] as const))).values()]
  return supportingObservationsSchema.parse({ version: 1, items })
}

/** UI references omit private comparison contexts and credentials. */
export function publicSupportingObservations(value: unknown) {
  return readSupportingObservations(value)?.items.map(item => ({
    source: item.source, checkId: item.checkId, checkVersion: item.checkVersion, pageUrl: item.pageUrl,
    evidence: item.evidence, recordedAt: item.provenance?.collectedAt ?? null,
    references: item.evidenceTargets.map(target => ({ device: target.device, label: target.label, selector: target.selector })),
  })) ?? []
}

/** Handoffs accept the recorded server contract or its validated public view.
 * Neither view can supply missing private comparison rules or provenance. */
export function readSupportingObservationView(value: unknown): SupportingObservationView[] | null {
  if (readSupportingObservations(value)) return publicSupportingObservations(value)
  const parsed = z.array(supportingObservationViewSchema).max(5000).safeParse(value)
  return parsed.success ? parsed.data : null
}
