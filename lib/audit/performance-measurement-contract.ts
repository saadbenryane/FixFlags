import { z } from 'zod'

const key = z.string().regex(/^[a-f0-9]{64}$/)
const measurementScopeSchema = z.object({ requestedKey: key, finalKey: key, profileKey: key }).strict()

/** Recorded provider facts. Scope calculation and recovery stay server-side. */
export const performanceMeasurementSchema = z.object({
  version: z.literal(1), source: z.literal('google-pagespeed'), strategy: z.enum(['desktop', 'mobile']),
  receivedAt: z.string().datetime(), measuredAt: z.string().datetime().nullable(),
  requestedAt: z.string().datetime().optional(),
  lighthouseVersion: z.string().max(100).nullable(), formFactor: z.string().max(40).nullable(),
  throttlingMethod: z.string().max(40).nullable(),
  scope: measurementScopeSchema.nullable().optional(),
}).strict()
export type PerformanceMeasurement = z.infer<typeof performanceMeasurementSchema>
