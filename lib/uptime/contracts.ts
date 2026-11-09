import { z } from 'zod'
import type { UptimeHistory, UptimeSummary } from './domain'

const time = z.string().datetime(), nullableTime = time.nullable()
const count = z.number().int().nonnegative()
export const uptimeWindowSchema = z.enum(['24h', '7d', '30d'])
// Accept the bounded transport form here. The owned reader validates the
// version and scope, including obsolete bare probe IDs.
export const uptimeCursorSchema = z.string().regex(/^[a-zA-Z0-9_.-]{1,150}$/)
export const uptimeIncidentSchema = z.object({ id: z.string(), targetUrl: z.string(), failureOrigin: z.string().nullable().optional(),
  startedAt: time, confirmedAt: time, recoveredAt: nullableTime, supersededAt: nullableTime, reason: z.string() })
export const uptimeSummarySchema: z.ZodType<UptimeSummary> = z.object({
  enabled: z.boolean(), targetUrl: z.string(), state: z.enum(['online', 'offline', 'checking', 'unknown', 'paused']),
  lastCheckedAt: nullableTime, nextCheckAt: nullableTime, openIncidentCount: count, incidentOpen: z.boolean().optional(),
  segments: z.array(z.object({ startAt: time, endAt: time, state: z.enum(['online', 'offline', 'unknown']), checked: count, expected: count })).max(60),
})
export const uptimeHistorySchema: z.ZodType<UptimeHistory> = z.object({
  historyScope: z.object({ key: z.string().min(1), from: time, through: time }).strict()
    .refine(scope => Date.parse(scope.from) <= Date.parse(scope.through), 'Invalid history bounds').optional(),
  enabled: z.boolean(), targetUrl: z.string(), state: z.enum(['online', 'offline', 'checking', 'unknown', 'paused']),
  lastCheckedAt: nullableTime, nextCheckAt: nullableTime, openIncidentCount: count, incidentOpen: z.boolean().optional(),
  segments: z.array(z.object({ startAt: time, endAt: time, state: z.enum(['online', 'offline', 'unknown']), checked: count, expected: count })).max(60),
  window: uptimeWindowSchema,
  probes: z.array(z.object({ id: z.string(), scheduledAt: time, observedAt: time, attempt: count, confirmed: z.boolean(), targetUrl: z.string(),
    result: z.enum(['ONLINE', 'FAILED', 'UNKNOWN']), reason: z.string(), statusCode: count.nullable(), durationMs: count, finalUrl: z.string().nullable() })).max(100),
  incidents: z.array(uptimeIncidentSchema).max(100),
  nextCursor: z.string().nullable(),
})
