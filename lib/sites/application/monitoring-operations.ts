import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { monitoringOverdueBefore } from '@/lib/sites/monitoring-freshness'
import { UPTIME_INTERVAL_MS, UPTIME_STALE_MS } from '@/lib/uptime/domain'
import { initialMonitoringSitesWhere } from './monitoring-setup'
import { watchNotificationSourceWhere } from '@/lib/audit/watch-notification-source'

type UptimeGap = { id: string; name: string; createdAt: Date; monitorId: string | null;
  state: string | null; nextProbeAt: Date | null; lastCheckedAt: Date | null; gap: 'overdue' | 'inconclusive' }

/** Current commitments own the cohort. Correlated probes retain the exact
 * monitor generation and target, using the existing scoped time index. */
function uptimeOperationSites(now: Date) {
  const overdue = Prisma.sql`(m."nextProbeAt" < ${new Date(now.getTime() - UPTIME_INTERVAL_MS)}
    OR (p."createdAt" < ${monitoringOverdueBefore(now)} AND m.id IS NULL))`
  const staleBefore = new Date(now.getTime() - UPTIME_STALE_MS)
  // A primary failure still awaits confirmation. Repeated attempts cannot
  // renew assurance while the monitor remains checking or unknown.
  const inconclusive = Prisma.sql`(m.enabled AND m.state IN ('unknown', 'checking')
    AND m."lastCheckedAt" >= ${staleBefore} AND m."lastCheckedAt" <= ${now}
    AND EXISTS (SELECT 1 FROM uptime_probes old WHERE old."monitorId" = m.id
      AND old.version = m.version AND old."targetUrl" = m."targetUrl" AND old."observedAt" < ${staleBefore})
    AND NOT EXISTS (SELECT 1 FROM uptime_probes fresh WHERE fresh."monitorId" = m.id
      AND fresh.version = m.version AND fresh."targetUrl" = m."targetUrl"
      AND fresh."observedAt" >= ${staleBefore} AND fresh."observedAt" <= ${now}
      AND (fresh.result = 'ONLINE' OR (fresh.result = 'FAILED' AND fresh.confirmed))))`
  return Prisma.sql`SELECT p.id, p.name, p."createdAt", m.id AS "monitorId", m.state,
    m."nextProbeAt", m."lastCheckedAt", CASE WHEN ${overdue} THEN 'overdue' ELSE 'inconclusive' END AS gap
    FROM projects p JOIN users u ON u.id = p."userId" LEFT JOIN uptime_monitors m ON m."projectId" = p.id
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchInterval" IS NOT NULL
      AND (${overdue} OR ${inconclusive})`
}

export async function loadUptimeOperationSites(db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  now: Date, slice: { skip: number; take: number }) {
  return db.$queryRaw<UptimeGap[]>(Prisma.sql`SELECT * FROM (${uptimeOperationSites(now)}) gaps
    ORDER BY "nextProbeAt" ASC NULLS LAST, id ASC LIMIT ${slice.take} OFFSET ${slice.skip}`)
}

async function countUptimeOperationSites(db: Pick<Prisma.TransactionClient, '$queryRaw'>, now: Date) {
  const [counts] = await db.$queryRaw<Array<{ overdueUptimeProbes: number; inconclusiveUptimeSites: number }>>(Prisma.sql`
    SELECT COUNT(*) FILTER (WHERE gap = 'overdue')::integer AS "overdueUptimeProbes",
      COUNT(*) FILTER (WHERE gap = 'inconclusive')::integer AS "inconclusiveUptimeSites"
    FROM (${uptimeOperationSites(now)}) gaps`)
  return counts
}

/** Summary counts and detailed queues describe the same actionable work.
 * Uptime remains eligible independently of the broad analysis schedule. */
export function monitoringOperationsWhere(now: Date) {
  const activeSite = { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } satisfies Prisma.ProjectWhereInput
  const overdueBefore = monitoringOverdueBefore(now)
  const oldWatchObservation = { OR: [
    { completedAt: { lt: overdueBefore } },
    { completedAt: null, createdAt: { lt: overdueBefore } },
  ] } satisfies Prisma.AuditWhereInput
  const scheduledSite = { ...activeSite, watchInterval: { not: null } } satisfies Prisma.ProjectWhereInput
  // Setup is already owed before a schedule exists. Its retry delay cannot
  // remove a missed first commitment from the same operational denominator.
  const overdueSchedules = { OR: [
    { ...scheduledSite, watchNextRunAt: { lt: overdueBefore } },
    { ...initialMonitoringSitesWhere(), createdAt: { lt: overdueBefore } },
  ] } satisfies Prisma.ProjectWhereInput
  // Retry backoff is execution policy, not evidence that the obligation recovered.
  // Keep the cohorts disjoint so summaries and the existing queue count each Site once.
  const interruptedSchedules = { ...scheduledSite, watchNextRunAt: { gte: overdueBefore },
    watchConsecutiveFailures: { gt: 0 }, watchLastError: { not: null } } satisfies Prisma.ProjectWhereInput
  return {
    schedules: { OR: [overdueSchedules, interruptedSchedules] },
    overdueSchedules,
    interruptedSchedules,
    uptimeAlerts: { incident: { monitor: { project: activeSite } }, OR: [
      { status: 'FAILED' },
      { status: 'PENDING', nextAttemptAt: { lt: overdueBefore } },
      { status: 'SENDING', OR: [{ leaseUntil: { lte: now } }, { leaseUntil: null, nextAttemptAt: { lt: overdueBefore } }] },
    ] },
    watchAlerts: { project: activeSite, OR: [
      { watchNotificationStatus: 'FAILED' },
      { watchNotificationStatus: 'PENDING', ...watchNotificationSourceWhere, ...oldWatchObservation },
      { watchNotificationStatus: 'SENDING', OR: [
        { watchNotificationLeaseUntil: { lte: now } },
        { watchNotificationLeaseUntil: null, ...oldWatchObservation },
      ] },
    ] },
  } satisfies {
    schedules: Prisma.ProjectWhereInput;
    overdueSchedules: Prisma.ProjectWhereInput;
    interruptedSchedules: Prisma.ProjectWhereInput;
    uptimeAlerts: Prisma.UptimeNotificationWhereInput;
    watchAlerts: Prisma.AuditWhereInput;
  }
}

/** Operational counts and queue selection share the same saved obligations.
 * These are current gaps, not a historical fulfillment rate. */
export async function countMonitoringOperations(
  db: Pick<Prisma.TransactionClient, 'project' | 'uptimeNotification' | 'audit' | '$queryRaw'>,
  now: Date,
) {
  const where = monitoringOperationsWhere(now)
  const [overdueSchedules, interruptedSchedules, uptime, undeliveredUptimeAlerts, undeliveredWatchAlerts] = await Promise.all([
    db.project.count({ where: where.overdueSchedules }),
    db.project.count({ where: where.interruptedSchedules }),
    countUptimeOperationSites(db, now),
    db.uptimeNotification.count({ where: where.uptimeAlerts }),
    db.audit.count({ where: where.watchAlerts }),
  ])
  return { overdueSchedules, interruptedSchedules, ...uptime, undeliveredUptimeAlerts, undeliveredWatchAlerts }
}

/** Readers without an existing transaction need one consistent, bounded snapshot. */
export async function loadMonitoringOperations(now: Date) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '500ms'")
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'")
    return countMonitoringOperations(tx, now)
  }, { maxWait: 500, timeout: 3000, isolationLevel: 'RepeatableRead' })
}
