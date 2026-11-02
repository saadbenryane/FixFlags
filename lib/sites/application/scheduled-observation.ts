import { Prisma } from '@prisma/client'
import { z } from 'zod'

/** One committed schedule receipt serves completion and notification readers.
 * A caller-supplied context alone cannot attach a monitoring obligation. */
export const scheduledContextSchema = z.object({ version: z.literal(1), targetHash: z.string().regex(/^[a-f0-9]{64}$/),
  interval: z.enum(['daily', 'weekly', 'hourly', 'custom']), everyMinutes: z.number().int().positive().nullable(),
  scheduledAt: z.number().int().nonnegative(), attemptedAt: z.number().int().nonnegative(), nextRunAt: z.number().int().nonnegative(),
  failures: z.number().int().min(0).max(2147483646),
}).strict()
export type ScheduledContext = z.infer<typeof scheduledContextSchema>
export const readScheduledContext = (context: unknown) => scheduledContextSchema.safeParse(
  context && typeof context === 'object' && 'scheduled' in context ? context.scheduled : undefined)

export function sharedWatchRunWhere(projectId?: string): Prisma.RunRequestWhereInput {
  return { ...(projectId ? { projectId } : {}), source: { not: 'WATCH' }, environment: 'production',
    context: { path: ['scheduled', 'version'], equals: 1 }, keys: { some: { source: 'WATCH' } } }
}

/** Original execution source stays intact when scheduled care shares its work. */
export function watchObservationWhere(projectId?: string): Prisma.AuditWhereInput {
  return { OR: [{ recheckTrigger: 'WATCH' }, { runRequests: { some: sharedWatchRunWhere(projectId) } }] }
}

/** Start shared recovery at the selective committed-receipt index. Native
 * Watch executions use the existing notification index in their own branch. */
export const scheduledObservationAuditsSql = Prisma.sql`SELECT DISTINCT duty."auditId", duty."projectId"
  FROM run_requests duty WHERE duty.source <> 'WATCH' AND duty.environment = 'production'
    AND duty.context#>'{scheduled,version}' = '1'::jsonb
    AND EXISTS (SELECT 1 FROM run_request_keys key WHERE key."runRequestId" = duty.id
      AND key."projectId" = duty."projectId" AND key.source = 'WATCH')`
