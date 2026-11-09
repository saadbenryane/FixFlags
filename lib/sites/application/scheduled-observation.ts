import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'

/** One committed schedule receipt serves completion and notification readers.
 * A caller-supplied context alone cannot attach a monitoring obligation. */
export const scheduledContextSchema = z.object({ version: z.literal(1), targetHash: z.string().regex(/^[a-f0-9]{64}$/),
  targetRevision: z.number().int().positive().optional(),
  interval: z.enum(['daily', 'weekly', 'hourly', 'custom']), everyMinutes: z.number().int().positive().nullable(),
  scheduledAt: z.number().int().nonnegative(), attemptedAt: z.number().int().nonnegative(), nextRunAt: z.number().int().nonnegative(),
  failures: z.number().int().min(0).max(2147483646),
}).strict()
export type ScheduledContext = z.infer<typeof scheduledContextSchema>
export const readScheduledContext = (context: unknown) => scheduledContextSchema.safeParse(
  context && typeof context === 'object' && 'scheduled' in context ? context.scheduled : undefined)

export const watchTargetHash = (url: string) => createHash('sha256').update(url).digest('hex')

/** Old run admissions belong to the initial target revision. */
export function recordedWatchTargetRevision(context: unknown): number | null {
  if (!context || typeof context !== 'object' || !('watchTargetRevision' in context)) return 1
  const parsed = z.number().int().positive().safeParse(context.watchTargetRevision)
  return parsed.success ? parsed.data : null
}

export function watchRunTargetsSite(targetUrl: string, context: unknown, site: { url: string; watchTargetRevision: number }) {
  const target = normalizeAuditNavigationUrl(site.url), admitted = normalizeAuditNavigationUrl(targetUrl)
  return target.ok && admitted.ok && admitted.url === target.url && recordedWatchTargetRevision(context) === (site.watchTargetRevision ?? 1)
}

export function sharedWatchRunWhere(projectId?: string): Prisma.RunRequestWhereInput {
  return { ...(projectId ? { projectId } : {}), source: { not: 'WATCH' }, environment: 'production',
    context: { path: ['scheduled', 'version'], equals: 1 }, keys: { some: { source: 'WATCH' } } }
}

/** Start shared recovery at the selective committed-receipt index. Native
 * Watch executions use the existing notification index in their own branch. */
const currentSharedWatchDutySql = Prisma.sql`duty.source <> 'WATCH' AND duty.environment = 'production'
    AND duty.context#>'{scheduled,version}' = '1'::jsonb
    AND COALESCE(duty.context#>'{scheduled,targetRevision}', '1'::jsonb) = to_jsonb(p."watchTargetRevision")
    AND COALESCE(duty.context->'watchTargetRevision', '1'::jsonb) = to_jsonb(p."watchTargetRevision")
    AND EXISTS (SELECT 1 FROM run_request_keys key WHERE key."runRequestId" = duty.id
      AND key."projectId" = duty."projectId" AND key.source = 'WATCH')`

export const scheduledObservationAuditsSql = Prisma.sql`SELECT DISTINCT duty."auditId", duty."projectId"
  FROM run_requests duty JOIN projects p ON p.id = duty."projectId" WHERE ${currentSharedWatchDutySql}`

/** Legacy native observations without a run row belong to the first target. */
const nativeWatchDutySql = Prisma.sql`FROM run_requests duty
  WHERE duty."auditId" = a.id AND duty."projectId" = p.id AND duty.source = 'WATCH'`
export const currentNativeWatchTargetSql = Prisma.sql`(EXISTS (SELECT 1 ${nativeWatchDutySql}
    AND COALESCE(duty.context->'watchTargetRevision', '1'::jsonb) = to_jsonb(p."watchTargetRevision"))
  OR (p."watchTargetRevision" = 1 AND NOT EXISTS (SELECT 1 ${nativeWatchDutySql})))`

/** Current Watch work requires the matching target and its native or shared duty. */
export const currentWatchObservationSql = Prisma.sql`(CASE WHEN a."recheckTrigger" = 'WATCH'
  THEN ${currentNativeWatchTargetSql}
  ELSE EXISTS (SELECT 1 FROM run_requests duty WHERE duty."auditId" = a.id AND duty."projectId" = p.id AND ${currentSharedWatchDutySql}) END)`

export const sameSiteWatchParentSql = Prisma.sql`(a."parentId" IS NULL OR EXISTS (SELECT 1 FROM audits parent
  WHERE parent.id = a."parentId" AND parent."projectId" = a."projectId"))`

/** Delivery requires a completed observation and committed classification. */
export const watchNotificationSourceReadySql = Prisma.sql`a.status = 'COMPLETED'
  AND a."completedAt" IS NOT NULL AND a."improvementProjectedAt" IS NOT NULL`

/** An operator can reopen a failed receipt without bypassing current delivery policy. */
export const watchNotificationRetryEligibleSql = (now: Date) => Prisma.sql`a."watchNotificationStatus" = 'FAILED'
  AND ${watchNotificationSourceReadySql} AND u."emailVerified" AND p."watchPausedAt" IS NULL
  AND p."notificationLevel" <> 'OFF' AND a."watchNotificationProviderId" IS NULL AND a."watchNotifiedAt" IS NULL
  AND (a."watchNotificationLeaseUntil" IS NULL OR a."watchNotificationLeaseUntil" <= ${now})`
