import { z } from 'zod'

export const performanceMeasurementSchema = z.object({
  version: z.literal(1), source: z.literal('google-pagespeed'), strategy: z.enum(['desktop', 'mobile']),
  receivedAt: z.string().datetime(), measuredAt: z.string().datetime().nullable(),
  lighthouseVersion: z.string().max(100).nullable(), formFactor: z.string().max(40).nullable(),
  throttlingMethod: z.string().max(40).nullable(),
}).strict()
export type PerformanceMeasurement = z.infer<typeof performanceMeasurementSchema>

/** Whitelist provider conditions before its raw response is discarded. */
export function performanceMeasurement(raw: Record<string, unknown>, strategy: 'desktop' | 'mobile'): PerformanceMeasurement {
  const settings = z.object({ formFactor: z.string().max(40).optional(), throttlingMethod: z.string().max(40).optional() }).safeParse(raw.configSettings)
  const measuredAt = z.string().datetime().safeParse(raw.fetchTime)
  const engine = z.string().max(100).safeParse(raw.lighthouseVersion)
  return { version: 1, source: 'google-pagespeed', strategy, receivedAt: new Date().toISOString(),
    measuredAt: measuredAt.success ? measuredAt.data : null, lighthouseVersion: engine.success ? engine.data : null,
    formFactor: settings.success ? settings.data.formFactor ?? null : null,
    throttlingMethod: settings.success ? settings.data.throttlingMethod ?? null : null }
}
