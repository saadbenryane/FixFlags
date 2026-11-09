import { Prisma, type Project } from '@prisma/client'
import { prisma } from '@/lib/db'
import { incompleteScheduledAnalysisSql } from '@/lib/audit/progressive/recorded-completeness'
import { nextAttemptTimestamp, type Clock } from '@/lib/time/clock'
import { analysisEnvironmentSourceSql } from './analysis-scope'
import { scheduledContextSchema } from './scheduled-observation'
import { lockAdminDomainActor, type AdminDomainActor } from '@/lib/admin/domain-actor'

type DueWatchProject = Pick<Project, 'id' | 'userId' | 'url' | 'watchTargetRevision' | 'watchInterval' | 'watchEveryMinutes' |
  'watchNextRunAt' | 'watchLastAttemptAt' | 'watchConsecutiveFailures'>
export type WatchWriteAuthority = { actor: AdminDomainActor; userId: string }
type CompletionSelectionScope = { projectId?: string; runId?: string; userId?: string }
type DueSelectionScope = { projectId?: string; userId?: string; excludeProjectIds?: readonly string[] }

// Both readers compare the same receipt to the current Site clock (alias p).
const currentReceiptSource = Prisma.sql`FROM run_requests r JOIN audits "source"
  ON "source".id = r."auditId" AND "source"."projectId" = r."projectId"`
const currentReceipt = Prisma.sql`r."projectId" = p.id AND "source"."userId" = p."userId"
  AND r.environment = 'production' AND ${analysisEnvironmentSourceSql('production')}
  AND r.context#>'{scheduled,version}' = '1'::jsonb
  AND COALESCE(r.context#>'{scheduled,targetRevision}', '1'::jsonb) = to_jsonb(p."watchTargetRevision")
  AND r.context#>'{scheduled,attemptedAt}' = to_jsonb((extract(epoch FROM p."watchLastAttemptAt") * 1000)::bigint)
  AND r.context#>'{scheduled,nextRunAt}' = to_jsonb((extract(epoch FROM p."watchNextRunAt") * 1000)::bigint)
  AND r.context#>'{scheduled,failures}' = to_jsonb(p."watchConsecutiveFailures")
  AND r.context#>>'{scheduled,interval}' = lower(p."watchInterval"::text)
  AND r.context#>'{scheduled,everyMinutes}' = COALESCE(to_jsonb(p."watchEveryMinutes"), 'null'::jsonb)
  AND r.context#>>'{scheduled,targetHash}' = encode(sha256(convert_to(p.url, 'UTF8')), 'hex')`

const unsettledTerminalReceipt = Prisma.sql`"source"."completedAt" IS NOT NULL
  AND ((r.status = 'FAILED' AND "source".status = 'FAILED') OR (r.status = 'COMPLETED' AND "source".status = 'COMPLETED'
    AND (p."watchConsecutiveFailures" > 0 OR p."watchLastError" IS NOT NULL OR ${incompleteScheduledAnalysisSql})))`

// A malformed retained receipt cannot settle and must not hold up care.
// The clock match verifies the other fields against typed Project columns.
const validReceipt = Prisma.sql`(r.context->'scheduled') - ARRAY[${Prisma.join(Object.keys(scheduledContextSchema.shape))}]::text[] = '{}'::jsonb
  AND jsonb_typeof(r.context#>'{scheduled,scheduledAt}') = 'number'
  AND jsonb_path_exists(r.context->'scheduled', '$.scheduledAt ? (@.type() == "number" && @ >= 0 && @ <= 9007199254740991 && @ == @.floor())')
  AND p."watchLastAttemptAt" >= TIMESTAMP 'epoch' AND p."watchNextRunAt" >= TIMESTAMP 'epoch'
  AND (p."watchEveryMinutes" IS NULL OR p."watchEveryMinutes" > 0)
  AND p."watchConsecutiveFailures" BETWEEN 0 AND 2147483646`

// A receipt and its next clock commit together, releasing the admission lease.
const predecessorSettled = Prisma.sql`(p."watchLeaseUntil" IS NOT NULL OR NOT EXISTS (
  SELECT 1 ${currentReceiptSource} WHERE ${currentReceipt} AND ${validReceipt}
    AND (r.status IN ('QUEUED', 'RUNNING') OR (${unsettledTerminalReceipt}))
))`

/** Skip contended Sites and owners before applying the limit. Selection is only a hint. */
export function dueWatchSelection(now: Date, limit: number, scope: DueSelectionScope) {
  return Prisma.sql`
    SELECT p.id, p."userId", p.url, p."watchTargetRevision", p."watchInterval", p."watchEveryMinutes", p."watchNextRunAt",
      p."watchLastAttemptAt", p."watchConsecutiveFailures"
    FROM projects p JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchPausedAt" IS NULL
      AND p."watchInterval" IS NOT NULL AND p."watchNextRunAt" <= ${now}
      AND (p."watchLeaseUntil" IS NULL OR p."watchLeaseUntil" < ${now})
      AND ${predecessorSettled}
      ${scope.projectId ? Prisma.sql`AND p.id = ${scope.projectId}` : Prisma.empty}
      ${scope.userId ? Prisma.sql`AND p."userId" = ${scope.userId}` : Prisma.empty}
      ${scope.excludeProjectIds?.length ? Prisma.sql`AND p.id NOT IN (${Prisma.join(scope.excludeProjectIds)})` : Prisma.empty}
    ORDER BY p."watchLastAttemptAt" ASC NULLS FIRST, p."watchNextRunAt" ASC, p.id ASC
    LIMIT ${limit} FOR UPDATE OF p SKIP LOCKED FOR SHARE OF u SKIP LOCKED`
}

export function selectDueWatchProjects(now: Date, limit: number, scope: DueSelectionScope) {
  return prisma.$queryRaw<DueWatchProject[]>(dueWatchSelection(now, limit, scope))
}

/** Recheck the caller's owner and schedule predicates under a short row lock. */
export function updateUnlockedWatchProject(projectId: string, where: Prisma.ProjectWhereInput, data: Prisma.ProjectUpdateManyMutationInput,
  options: { admission?: boolean; authority?: WatchWriteAuthority } = {}) {
  return prisma.$transaction(async tx => {
    if (options.authority) await lockAdminDomainActor(options.authority.actor, options.authority.userId, projectId, tx)
    const available = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p.id FROM projects p
      ${options.admission ? Prisma.sql`JOIN users u ON u.id = p."userId" AND u."lifecycleStatus" = 'ACTIVE'` : Prisma.empty}
      WHERE p.id = ${projectId}
      ${options.authority ? Prisma.sql`AND p."userId" = ${options.authority.userId}` : Prisma.empty}
      ${options.admission ? Prisma.sql`AND ${predecessorSettled}` : Prisma.empty}
      FOR UPDATE OF p SKIP LOCKED ${options.admission ? Prisma.sql`FOR SHARE OF u SKIP LOCKED` : Prisma.empty}`)
    if (!available.length) return { count: 0 }
    return tx.project.updateMany({ where: { AND: [{ id: projectId }, where] }, data })
  })
}

type Candidate = { id: string; projectId: string; userId: string; context: Prisma.JsonValue; status: string;
  auditId: string; completedAt: Date; updatedAt: Date; targetUrl: string; watchLastError: string | null; incomplete: boolean }

/** Rotate attempted receipts even when their schedule write fails. */
export function recordCompletionAttempt(row: Candidate, clock: Clock, authority?: WatchWriteAuthority) {
  return prisma.$transaction(async tx => {
    if (authority) {
      await lockAdminDomainActor(authority.actor, authority.userId, row.projectId, tx)
      const [site] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM projects WHERE id = ${row.projectId} AND "userId" = ${authority.userId} FOR SHARE SKIP LOCKED`
      if (!site || row.userId !== authority.userId) return { count: 0 }
    }
    const available = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM run_requests WHERE id = ${row.id} FOR NO KEY UPDATE SKIP LOCKED`
    if (!available.length) return { count: 0 }
    return tx.runRequest.updateMany({ where: {
      id: row.id, projectId: row.projectId, auditId: row.auditId, updatedAt: row.updatedAt,
      status: row.status as 'FAILED' | 'COMPLETED', context: { equals: row.context as Prisma.InputJsonValue },
      project: { userId: row.userId, deletedAt: null, watchPausedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
      audit: { projectId: row.projectId, userId: row.userId, status: row.status as 'FAILED' | 'COMPLETED', completedAt: row.completedAt },
    }, data: { updatedAt: nextAttemptTimestamp(clock.now(), row.updatedAt) } })
  })
}

export function scheduledCompletionSelection(now: Date, limit: number, scope: CompletionSelectionScope) {
  return Prisma.sql`
    SELECT r.id, r."projectId", "source"."userId", r.context, r."updatedAt", "source".status, "source".id AS "auditId", "source"."completedAt", p.url AS "targetUrl", p."watchLastError",
      ${incompleteScheduledAnalysisSql} AS incomplete
    ${currentReceiptSource}
    JOIN projects p ON p.id = r."projectId" JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND p."watchPausedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchLeaseUntil" IS NULL
      AND ${currentReceipt} AND ${unsettledTerminalReceipt} AND "source"."completedAt" <= ${now}
      ${scope.projectId ? Prisma.sql`AND p.id = ${scope.projectId}` : Prisma.empty}
      ${scope.userId ? Prisma.sql`AND p."userId" = ${scope.userId}` : Prisma.empty}
      ${scope.runId ? Prisma.sql`AND r.id = ${scope.runId}` : Prisma.empty}
    ORDER BY r."updatedAt", "source"."completedAt", r.id LIMIT ${Math.max(1, Math.min(100, limit))}
    FOR NO KEY UPDATE OF p, r SKIP LOCKED`
}

export function selectScheduledCompletionCandidates(now: Date, limit: number, scope: CompletionSelectionScope) {
  return prisma.$queryRaw<Candidate[]>(scheduledCompletionSelection(now, limit, scope))
}
