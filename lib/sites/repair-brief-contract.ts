import { z } from 'zod'
import { supportingObservationViewSchema } from '@/lib/audit/flag-observations'
import { SITE_CARD_AREAS } from './card-areas'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { repairEvidenceSchema } from './repair-evidence-contract'

export const repairContextHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const REPAIR_OBSERVATIONS_PER_PAGE = 25
export const repairObservationOffsetSchema = z.number().int().min(0).max(5000)
const id = z.string().min(1)
const repairRequestSchema = z.object({ tool: z.literal(MCP_TOOLS.getFlag.name),
  arguments: z.object({ siteId: id, flagId: id, expectedContextHash: repairContextHashSchema,
    observationOffset: repairObservationOffsetSchema.optional(), includeEvidence: z.boolean().optional() }).strict(),
}).strict()
const reference = z.object({ selector: z.string().optional(), label: z.string().optional(),
  device: z.enum(['desktop', 'mobile']).optional() }).strict()

/** Public evidence contract. Private comparison inputs never belong in this DTO. */
export const repairBriefSchema = z.object({
  schemaVersion: z.literal('fixflags.repair-brief.v1'),
  siteId: id, referenceFlagId: id, contextHash: repairContextHashSchema,
  flag: z.object({
    flagId: id, sourceFlagId: id, sourceAuditId: id,
    checkId: z.string().nullable(), status: z.string(), verificationState: z.string(),
    severity: z.string(), area: z.enum(SITE_CARD_AREAS),
    problem: z.string(), whyItMatters: z.string(),
    pageUrl: z.string().nullable(), affectedPaths: z.array(z.string()),
    outcomeId: z.string().nullable(), outcomeName: z.string().nullable(), evidence: z.string().nullable(),
    evidenceContext: z.object({ source: z.string().nullable(), recordedAt: z.string().datetime().nullable(),
      auditId: id, references: z.array(reference).max(20) }).strict().nullable(),
    supportingObservations: z.array(supportingObservationViewSchema).max(REPAIR_OBSERVATIONS_PER_PAGE).nullable(),
    viewport: z.string().nullable(), confidence: z.number().finite().nullable(), causeCertainty: z.string().nullable(),
    latestOccurrenceAt: z.string().datetime().nullable(),
  }).strict(),
  observationPage: z.object({ offset: repairObservationOffsetSchema, returned: z.number().int().min(0).max(REPAIR_OBSERVATIONS_PER_PAGE),
    total: z.number().int().min(0).max(5000).nullable(), nextOffset: repairObservationOffsetSchema.nullable(), complete: z.boolean(),
  }).strict(),
  repair: z.discriminatedUnion('readiness', [
    z.object({ readiness: z.literal('ready'), guidance: z.string().refine(value => value.trim().length > 0) }).strict(),
    z.object({ readiness: z.literal('pending'), guidance: z.null() }).strict(),
    z.object({ readiness: z.literal('unavailable'), guidance: z.null() }).strict(),
  ]),
  verification: z.object({ expectedBehavior: z.string(), rule: z.string().nullable(), independentCheckRequired: z.literal(true),
    afterDeployment: z.object({ tool: z.literal(MCP_TOOLS.recordFix.name),
      arguments: z.object({ siteId: id, flagId: id }).strict(),
      requiredChangeContext: z.array(z.string()), optionalChangeContext: z.array(z.string()), continuation: z.string(),
    }).strict(),
  }).strict(),
  limitations: z.array(z.string()), instructions: z.array(z.string()),
  evidence: repairEvidenceSchema.optional(),
  links: z.object({ flag: z.string().url(), report: z.string().url().nullable(), json: z.string().url(), next: z.string().url().nullable(), evidence: z.string().url() }).strict(),
  retrieval: z.object({ authentication: z.literal('owner-session-or-developer-key'),
    mcp: repairRequestSchema, next: repairRequestSchema.nullable(), evidence: repairRequestSchema,
  }).strict(),
}).strict()

export type RepairBrief = z.infer<typeof repairBriefSchema>
