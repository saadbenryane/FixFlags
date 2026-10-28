import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { productTransaction } from '@/lib/billing/product-transaction'
import { loadEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { assertAdminDomainActor, type AdminDomainActor } from '@/lib/admin/domain-actor'
import { calcWatchNextRun, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { logger } from '@/lib/logger'
import { systemClock, type Clock } from '@/lib/time/clock'
import { assertScheduledClaim, staleScheduledClaim, type ScheduledRunClaim, type ScheduledClaimProject } from './scheduled-admission'
import { readExecutionSpec } from '../domain/execution-spec'
import { analysisEnvironmentSourceSql } from './analysis-scope'
import { SiteRunRefusal } from './run-refusal'
import { interruptedAnalysisWorkSql, interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'

const scheduleSchema = z.object({ version: z.literal(1), targetHash: z.string().regex(/^[a-f0-9]{64}$/),
  interval: z.enum(['daily', 'weekly', 'hourly', 'custom']), everyMinutes: z.number().int().positive().nullable(),
  scheduledAt: z.number().int().nonnegative(), attemptedAt: z.number().int().nonnegative(), nextRunAt: z.number().int().nonnegative(),
  failures: z.number().int().min(0).max(2147483646),
}).strict()
type Schedule = z.infer<typeof scheduleSchema>
const targetHash = (url: string) => createHash('sha256').update(url).digest('hex')
const readSchedule = (context: unknown) => scheduleSchema.safeParse(context && typeof context === 'object' && 'scheduled' in context ? context.scheduled : undefined)

/** The receipt's schedule context and the Site clock commit together, after
 * normal execution admission. No raw URL or claim lease enters that context. */
export async function commitScheduledRun(input: { projectId: string; userId: string; runId: string; admittedAt: Date;
  claim: ScheduledRunClaim; operator?: AdminDomainActor }) {
  const complete = await productTransaction(async tx => {
    const [site] = await tx.$queryRaw<Array<ScheduledClaimProject & { watchConsecutiveFailures: number }>>`
      SELECT p.url, p."watchInterval", p."watchEveryMinutes", p."watchNextRunAt", p."watchLastAttemptAt", p."watchLeaseUntil", p."watchPausedAt", p."watchConsecutiveFailures"
      FROM projects p JOIN users u ON u.id = p."userId" WHERE p.id = ${input.projectId} AND p."userId" = ${input.userId}
        AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' FOR UPDATE OF p`
    if (!site) throw staleScheduledClaim()
    if (input.operator) await assertAdminDomainActor(input.operator, input.userId, input.projectId, tx)
    const policy = await loadEffectiveEntitlements(input.userId, tx)
    if (!policy?.available || !policy.watchIntervals.includes(input.claim.interval)) throw staleScheduledClaim()
    const run = await tx.runRequest.findFirst({ where: { id: input.runId, projectId: input.projectId, environment: 'production',
      status: { not: 'FAILED' }, audit: { projectId: input.projectId, userId: input.userId, status: { not: 'FAILED' } } },
      select: { context: true, executionSpec: true, status: true, audit: { select: { status: true } } } })
    const spec = readExecutionSpec(run?.executionSpec)
    if (!run || !spec || !['SITE', 'OUTCOMES'].includes(spec.scope) || spec.environment !== 'production' || spec.verificationTarget)
      throw new SiteRunRefusal('The scheduled check did not finish. FixFlags will try again.', 409, 'SCHEDULED_RUN_UNAVAILABLE')
    const old = readSchedule(run.context)
    if (!old.success && run.context && typeof run.context === 'object' && 'scheduled' in run.context)
      throw new SiteRunRefusal('The recorded monitoring context is unavailable.', 409, 'SCHEDULE_CONTEXT_UNAVAILABLE')
    if (old.success) {
      if (old.data.scheduledAt !== input.claim.scheduledAt.getTime() || old.data.interval !== input.claim.interval || old.data.everyMinutes !== input.claim.everyMinutes)
        throw new SiteRunRefusal('Another scheduled check still owns this execution.', 409, 'SITE_RUN_IN_PROGRESS')
      return false
    }
    assertScheduledClaim(site, input.claim)
    const scheduled = scheduleSchema.parse({ version: 1, targetHash: targetHash(site.url), interval: input.claim.interval,
      everyMinutes: input.claim.everyMinutes, scheduledAt: input.claim.scheduledAt.getTime(), attemptedAt: input.claim.attemptedAt.getTime(),
      nextRunAt: calcWatchNextRun(input.claim.interval, input.admittedAt, input.claim.everyMinutes).getTime(), failures: site.watchConsecutiveFailures })
    const context = run.context && typeof run.context === 'object' && !Array.isArray(run.context) ? run.context : {}
    await tx.runRequest.update({ where: { id: input.runId }, data: { context: { ...context, scheduled } } })
    const changed = await tx.project.updateMany({ where: { id: input.projectId, userId: input.userId, deletedAt: null, watchPausedAt: null,
      watchNextRunAt: input.claim.scheduledAt, watchLastAttemptAt: input.claim.attemptedAt, watchLeaseUntil: input.claim.leaseUntil },
      data: { watchNextRunAt: new Date(scheduled.nextRunAt), watchLeaseUntil: null } })
    if (changed.count !== 1) throw staleScheduledClaim()
    return run.status === 'COMPLETED' && run.audit?.status === 'COMPLETED'
  })
  if (complete) await reconcileScheduledCompletions(1, systemClock, { runId: input.runId, projectId: input.projectId })
    .catch(error => logger.warn('Scheduled completion deferred after admission', { runId: input.runId, error }))
}

type Candidate = { id: string; projectId: string; userId: string; context: Prisma.JsonValue; status: string;
  auditId: string; completedAt: Date; targetUrl: string; watchLastError: string | null; interrupted: boolean }

/** One cohort serves normal completion and bounded recovery. JSON comparisons
 * avoid trusting timestamp casts or interpreting malformed historical context. */
export async function reconcileScheduledCompletions(limit = 20, clock: Clock = systemClock,
  scope: { projectId?: string; runId?: string } = {}): Promise<number> {
  const now = clock.now()
  const rows = await prisma.$queryRaw<Candidate[]>(Prisma.sql`
    SELECT r.id, r."projectId", "source"."userId", r.context, "source".status, "source".id AS "auditId", "source"."completedAt", p.url AS "targetUrl", p."watchLastError",
      ${interruptedAnalysisWorkSql} AS interrupted
    FROM run_requests r JOIN audits "source" ON "source".id = r."auditId" AND "source"."projectId" = r."projectId"
    JOIN projects p ON p.id = r."projectId" AND p."userId" = "source"."userId" JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND p."watchPausedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchLeaseUntil" IS NULL
      AND r.environment = 'production' AND ${analysisEnvironmentSourceSql('production')} AND r.context#>'{scheduled,version}' = '1'::jsonb
      AND ((r.status = 'FAILED' AND "source".status = 'FAILED') OR (r.status = 'COMPLETED' AND "source".status = 'COMPLETED'
        AND (p."watchConsecutiveFailures" > 0 OR p."watchLastError" IS NOT NULL OR ${interruptedAnalysisWorkSql})))
      AND "source"."completedAt" IS NOT NULL AND "source"."completedAt" <= ${now}
      AND r.context#>'{scheduled,attemptedAt}' = to_jsonb((extract(epoch FROM p."watchLastAttemptAt") * 1000)::bigint)
      AND r.context#>'{scheduled,nextRunAt}' = to_jsonb((extract(epoch FROM p."watchNextRunAt") * 1000)::bigint)
      AND r.context#>'{scheduled,failures}' = to_jsonb(p."watchConsecutiveFailures")
      AND r.context#>>'{scheduled,interval}' = lower(p."watchInterval"::text)
      AND r.context#>'{scheduled,everyMinutes}' = COALESCE(to_jsonb(p."watchEveryMinutes"), 'null'::jsonb)
      AND r.context#>>'{scheduled,targetHash}' = encode(sha256(convert_to(p.url, 'UTF8')), 'hex')
      ${scope.projectId ? Prisma.sql`AND p.id = ${scope.projectId}` : Prisma.empty}
      ${scope.runId ? Prisma.sql`AND r.id = ${scope.runId}` : Prisma.empty}
    ORDER BY "source"."completedAt", r.id LIMIT ${Math.max(1, Math.min(100, limit))}`)
  let changed = 0
  for (const row of rows) {
    const parsed = readSchedule(row.context)
    if (!parsed.success) continue
    const saved: Schedule = parsed.data
    const failed = row.status === 'FAILED' || row.interrupted
    const delay = [15, 60, 360][Math.min(saved.failures, 2)] * 60_000
    try {
    const result = await prisma.project.updateMany({ where: { id: row.projectId, userId: row.userId, url: row.targetUrl, deletedAt: null, watchPausedAt: null,
        user: { lifecycleStatus: 'ACTIVE' }, watchInterval: toStoredWatchInterval(saved.interval), watchEveryMinutes: saved.everyMinutes,
        watchNextRunAt: new Date(saved.nextRunAt), watchLastAttemptAt: new Date(saved.attemptedAt), watchLeaseUntil: null,
        watchConsecutiveFailures: saved.failures, watchLastError: row.watchLastError,
        audits: { some: { id: row.auditId, userId: row.userId, status: row.status as 'FAILED' | 'COMPLETED', completedAt: row.completedAt,
          verifierExecutions: row.interrupted ? { some: interruptedAnalysisWorkWhere } : { none: interruptedAnalysisWorkWhere },
          runRequests: { some: { id: row.id, status: row.status as 'FAILED' | 'COMPLETED', context: { equals: row.context as Prisma.InputJsonValue } } } } },
      }, data: failed ? { watchNextRunAt: new Date(Math.min(saved.nextRunAt, row.completedAt.getTime() + delay)),
        watchConsecutiveFailures: saved.failures + 1, watchLastError: 'The scheduled check did not finish. FixFlags will try again.' }
        : { watchConsecutiveFailures: 0, watchLastError: null } })
      changed += result.count
    } catch (error) { logger.warn('Scheduled completion deferred; other Sites will continue', { runId: row.id, error }) }
  }
  return changed
}
