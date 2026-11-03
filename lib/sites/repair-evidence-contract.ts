import { z } from 'zod'
import { performanceMeasurementSchema } from '@/lib/audit/performance-measurement'

export const MAX_REPAIR_CAPTURE_BYTES = 5 * 1024 * 1024
export const MAX_MCP_CAPTURE_BYTES = 256 * 1024
export const repairEvidenceSchema = z.object({
  sourceAuditId: z.string().min(1), sourceFlagId: z.string().min(1),
  performanceMeasurements: z.array(performanceMeasurementSchema).max(4),
  capture: z.discriminatedUnion('state', [
    z.object({ state: z.literal('available'), sha256: z.string().regex(/^[a-f0-9]{64}$/),
      findingId: z.string().min(1), pageUrl: z.string().url(),
      bytes: z.number().int().positive().max(MAX_REPAIR_CAPTURE_BYTES), mimeType: z.literal('image/png'),
      findingRecordedAt: z.string().datetime(), url: z.string().url(), nativeImage: z.boolean() }).strict(),
    z.object({ state: z.enum(['not_recorded', 'unavailable', 'too_large']) }).strict(),
  ]),
}).strict()
export type RepairEvidence = z.infer<typeof repairEvidenceSchema>
