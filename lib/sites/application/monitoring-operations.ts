import { Prisma, type Audit } from '@prisma/client'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { monitoringOverdueBefore } from '@/lib/sites/monitoring-freshness'
import { UPTIME_INTERVAL_MS, UPTIME_STALE_MS, UPTIME_SWEEP_INTERVAL_MS } from '@/lib/uptime/domain'
import { uptimeProjectWhere } from '@/lib/uptime/eligibility'
import { currentUptimeNotificationTargetSql } from '@/lib/uptime/monitor-target'
import { currentWatchObservationSql, sameSiteWatchParentSql, watchNotificationRetryEligibleSql,
  watchNotificationSourceReadySql } from './scheduled-observation'

type UptimeGap = { id: string; name: string; createdAt: Date; monitorId: string | null;
  state: string | null; dueAt: Date | null; lastCheckedAt: Date | null; gap: 'overdue' | 'inconclusive' }
type UptimeRead = Pick<Prisma.TransactionClient, '$queryRaw' | 'project'>

/** Current commitments own the cohort. Correlated probes retain the exact
 * monitor generation and target, using the existing scoped time index.
 * A Site with no monitor is applied separately: only a public check target is
 * an overdue probe. A retained private or local URL is not an uptime obligation. */
function uptimeOperationSites(now: Date) {
  const pendingConfirmation = Prisma.sql`(m.enabled AND m."confirmationDueAt" IS NOT NULL)`
  const dueAt = Prisma.sql`CASE WHEN ${pendingConfirmation} THEN m."confirmationDueAt" ELSE m."nextProbeAt" END`
  // Give confirmation delivery two sweeps before raising a gap, while the
  // original failure is still eligible for confirmation. Keep normal probe grace.
  const overdue = Prisma.sql`(CASE WHEN ${pendingConfirmation}
    THEN m."confirmationDueAt" < ${new Date(now.getTime() - 2 * UPTIME_SWEEP_INTERVAL_MS)}
    ELSE m."nextProbeAt" < ${new Date(now.getTime() - UPTIME_INTERVAL_MS)} END)`
  const staleBefore = new Date(now.getTime() - UPTIME_STALE_MS)
  const inconclusive = Prisma.sql`(m.enabled AND m.state = 'unknown'
    AND m."lastCheckedAt" >= ${staleBefore} AND m."lastCheckedAt" <= ${now}
    AND EXISTS (SELECT 1 FROM uptime_probes old WHERE old."monitorId" = m.id
      AND old.version = m.version AND old."targetUrl" = m."targetUrl" AND old."observedAt" < ${staleBefore})
    AND NOT EXISTS (SELECT 1 FROM uptime_probes fresh WHERE fresh."monitorId" = m.id
      AND fresh.version = m.version AND fresh."targetUrl" = m."targetUrl"
      AND fresh."observedAt" >= ${staleBefore} AND fresh."observedAt" <= ${now}
      AND fresh.result IN ('ONLINE', 'FAILED')))`
  return Prisma.sql`SELECT p.id, p.name, p."createdAt", m.id AS "monitorId", m.state,
    ${dueAt} AS "dueAt", m."lastCheckedAt", CASE WHEN ${overdue} THEN 'overdue' ELSE 'inconclusive' END AS gap
    FROM projects p JOIN users u ON u.id = p."userId" LEFT JOIN uptime_monitors m ON m."projectId" = p.id
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'
      AND p."watchPausedAt" IS NULL AND p."watchInterval" IS NOT NULL
      AND (${overdue} OR ${inconclusive})`
}

/** Missing monitors sort after every saved probe time, matching NULLS LAST. */
async function missingPublicMonitorGaps(db: Pick<Prisma.TransactionClient, 'project'>, now: Date): Promise<UptimeGap[]> {
  const rows = await db.project.findMany({
    where: { ...uptimeProjectWhere,
      uptimeMonitor: null, createdAt: { lt: monitoringOverdueBefore(now) } },
    select: { id: true, name: true, url: true, createdAt: true },
    orderBy: { id: 'asc' },
  })
  return rows.filter(row => normalizeAuditUrl(row.url).ok).map(row => ({
    id: row.id, name: row.name, createdAt: row.createdAt, monitorId: null, state: null,
    dueAt: null, lastCheckedAt: null, gap: 'overdue' as const,
  }))
}

export async function loadUptimeOperationSites(db: UptimeRead, now: Date, slice: { skip: number; take: number }) {
  if (slice.take <= 0) return []
  const missing = await missingPublicMonitorGaps(db, now)
  const [counted] = await db.$queryRaw<Array<{ monitorGaps: number }>>(Prisma.sql`
    SELECT COUNT(*)::integer AS "monitorGaps" FROM (${uptimeOperationSites(now)}) gaps`)
  const monitorTotal = counted.monitorGaps
  const rows: UptimeGap[] = []
  if (slice.skip < monitorTotal) {
    const take = Math.min(slice.take, monitorTotal - slice.skip)
    rows.push(...await db.$queryRaw<UptimeGap[]>(Prisma.sql`SELECT * FROM (${uptimeOperationSites(now)}) gaps
      ORDER BY "dueAt" ASC NULLS LAST, id ASC LIMIT ${take} OFFSET ${slice.skip}`))
  }
  const missingTake = slice.take - rows.length
  if (missingTake > 0) {
    const missingSkip = Math.max(0, slice.skip - monitorTotal)
    rows.push(...missing.slice(missingSkip, missingSkip + missingTake))
  }
  return rows
}

async function countUptimeOperationSites(db: UptimeRead, now: Date) {
  const [counts] = await db.$queryRaw<Array<{ overdueUptimeProbes: number; inconclusiveUptimeSites: number }>>(Prisma.sql`
    SELECT COUNT(*) FILTER (WHERE gap = 'overdue')::integer AS "overdueUptimeProbes",
      COUNT(*) FILTER (WHERE gap = 'inconclusive')::integer AS "inconclusiveUptimeSites"
    FROM (${uptimeOperationSites(now)}) gaps`)
  const missing = await missingPublicMonitorGaps(db, now)
  return {
    overdueUptimeProbes: counts.overdueUptimeProbes + missing.length,
    inconclusiveUptimeSites: counts.inconclusiveUptimeSites,
  }
}

/** Summary counts and detailed queues describe the same actionable work.
 * Uptime remains eligible independently of the broad analysis schedule. */
export function monitoringOperationsWhere(now: Date) {
  const overdueBefore = monitoringOverdueBefore(now)
  return {
    schedules: { ...uptimeProjectWhere, watchNextRunAt: { lt: monitoringOverdueBefore(now) } },
    summaryAlerts: { user: { lifecycleStatus: 'ACTIVE' }, OR: [
      { status: 'FAILED' },
      { status: 'PENDING', nextAttemptAt: { lt: overdueBefore } },
      { status: 'SENDING', OR: [
        { leaseUntil: { lte: now } },
        { leaseUntil: null, nextAttemptAt: { lt: overdueBefore } },
      ] },
    ] },
  } satisfies {
    schedules: Prisma.ProjectWhereInput;
    summaryAlerts: Prisma.NotificationDigestWhereInput;
  }
}

function uptimeOperationAlerts(now: Date) {
  const overdueBefore = monitoringOverdueBefore(now)
  return Prisma.sql`FROM uptime_notifications n
    JOIN uptime_incidents i ON i.id = n."incidentId" JOIN uptime_monitors m ON m.id = i."monitorId"
    JOIN projects p ON p.id = m."projectId" JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND ${currentUptimeNotificationTargetSql}
      AND (n.status = 'FAILED' OR (n.status = 'PENDING' AND n."nextAttemptAt" < ${overdueBefore})
        OR (n.status = 'SENDING' AND (n."leaseUntil" <= ${now}
          OR (n."leaseUntil" IS NULL AND n."nextAttemptAt" < ${overdueBefore}))))`
}

export function loadUptimeOperationAlerts(db: Pick<Prisma.TransactionClient, '$queryRaw'>, now: Date, slice: { skip: number; take: number }) {
  return db.$queryRaw<Array<{ id: string; projectId: string; name: string; status: string; createdAt: Date }>>(Prisma.sql`
    SELECT n.id, p.id AS "projectId", p.name, n.status, n."createdAt" ${uptimeOperationAlerts(now)}
    ORDER BY n."createdAt" DESC, n.id DESC LIMIT ${slice.take} OFFSET ${slice.skip}`)
}

function watchOperationAlerts(now: Date) {
  const overdue = Prisma.sql`COALESCE(a."completedAt", a."createdAt") < ${monitoringOverdueBefore(now)}`
  return Prisma.sql`FROM audits a JOIN projects p ON p.id = a."projectId" AND p."userId" = a."userId"
    JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND ${currentWatchObservationSql} AND ${sameSiteWatchParentSql}
      AND (a."watchNotificationStatus" = 'FAILED'
        OR (a."watchNotificationStatus" = 'NOT_APPLICABLE' AND a."recheckTrigger" IS DISTINCT FROM 'WATCH'
          AND a."watchRegressionCount" IS NULL AND a."watchRecoveryCount" IS NULL AND ${watchNotificationSourceReadySql} AND ${overdue})
        OR (a."watchNotificationStatus" = 'PENDING' AND ${watchNotificationSourceReadySql} AND ${overdue})
        OR (a."watchNotificationStatus" = 'SENDING' AND (a."watchNotificationLeaseUntil" <= ${now}
          OR (a."watchNotificationLeaseUntil" IS NULL AND ${overdue}))))`
}

export function loadWatchOperationAlerts(db: Pick<Prisma.TransactionClient, '$queryRaw'>, now: Date, slice: { skip: number; take: number }) {
  return db.$queryRaw<Array<Pick<Audit, 'id' | 'projectId' | 'url' | 'createdAt' | 'watchNotificationStatus'> & { canRetry: boolean }>>(Prisma.sql`
    SELECT a.id, a."projectId", a.url, a."createdAt", a."watchNotificationStatus", (${watchNotificationRetryEligibleSql(now)}) AS "canRetry"
    ${watchOperationAlerts(now)}
    ORDER BY a."createdAt" DESC, a.id DESC LIMIT ${slice.take} OFFSET ${slice.skip}`)
}

/** Operational counts and queue selection share the same saved obligations.
 * These are current gaps, not a historical fulfillment rate. */
export async function countMonitoringOperations(
  db: Pick<Prisma.TransactionClient, 'project' | 'notificationDigest' | '$queryRaw'>,
  now: Date,
) {
  const where = monitoringOperationsWhere(now)
  const [overdueSchedules, uptime, [alerts], [watch], unsettledSummaries] = await Promise.all([
    db.project.count({ where: where.schedules }),
    countUptimeOperationSites(db, now),
    db.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT COUNT(*)::integer AS count ${uptimeOperationAlerts(now)}`),
    db.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT COUNT(*)::integer AS count ${watchOperationAlerts(now)}`),
    db.notificationDigest.count({ where: where.summaryAlerts }),
  ])
  return { overdueSchedules, ...uptime, undeliveredUptimeAlerts: alerts.count, undeliveredWatchAlerts: watch.count, unsettledSummaries }
}
