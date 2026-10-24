import { Prisma } from '@prisma/client'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { monitoringOverdueBefore } from '@/lib/sites/monitoring-freshness'
import { UPTIME_INTERVAL_MS, UPTIME_STALE_MS } from '@/lib/uptime/domain'

type UptimeGap = { id: string; name: string; createdAt: Date; monitorId: string | null;
  state: string | null; nextProbeAt: Date | null; lastCheckedAt: Date | null; gap: 'overdue' | 'inconclusive' }
type UptimeRead = Pick<Prisma.TransactionClient, '$queryRaw' | 'project'>

/** Current commitments own the cohort. Correlated probes retain the exact
 * monitor generation and target, using the existing scoped time index.
 * A Site with no monitor is applied separately: only a public check target is
 * an overdue probe. A retained private or local URL is not an uptime obligation. */
function uptimeOperationSites(now: Date) {
  const overdue = Prisma.sql`m."nextProbeAt" < ${new Date(now.getTime() - UPTIME_INTERVAL_MS)}`
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
    m."nextProbeAt", m."lastCheckedAt", CASE WHEN ${overdue} THEN 'overdue' ELSE 'inconclusive' END AS gap
    FROM projects p JOIN users u ON u.id = p."userId" LEFT JOIN uptime_monitors m ON m."projectId" = p.id
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchInterval" IS NOT NULL
      AND (${overdue} OR ${inconclusive})`
}

/** Missing monitors sort after every saved probe time, matching NULLS LAST. */
async function missingPublicMonitorGaps(db: Pick<Prisma.TransactionClient, 'project'>, now: Date): Promise<UptimeGap[]> {
  const rows = await db.project.findMany({
    where: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, watchInterval: { not: null },
      uptimeMonitor: null, createdAt: { lt: monitoringOverdueBefore(now) } },
    select: { id: true, name: true, url: true, createdAt: true },
    orderBy: { id: 'asc' },
  })
  return rows.filter(row => normalizeAuditUrl(row.url).ok).map(row => ({
    id: row.id, name: row.name, createdAt: row.createdAt, monitorId: null, state: null,
    nextProbeAt: null, lastCheckedAt: null, gap: 'overdue' as const,
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
      ORDER BY "nextProbeAt" ASC NULLS LAST, id ASC LIMIT ${take} OFFSET ${slice.skip}`))
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
  const activeSite = { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } satisfies Prisma.ProjectWhereInput
  const overdueBefore = monitoringOverdueBefore(now)
  const oldWatchObservation = { OR: [
    { completedAt: { lt: overdueBefore } },
    { completedAt: null, createdAt: { lt: overdueBefore } },
  ] } satisfies Prisma.AuditWhereInput
  return {
    schedules: { ...activeSite, watchInterval: { not: null }, watchNextRunAt: { lt: monitoringOverdueBefore(now) } },
    uptimeAlerts: { incident: { monitor: { project: activeSite } }, OR: [
      { status: 'FAILED' },
      { status: 'PENDING', nextAttemptAt: { lt: overdueBefore } },
      { status: 'SENDING', OR: [{ leaseUntil: { lte: now } }, { leaseUntil: null, nextAttemptAt: { lt: overdueBefore } }] },
    ] },
    watchAlerts: { project: activeSite, recheckTrigger: 'WATCH', OR: [
      { watchNotificationStatus: 'FAILED' },
      { watchNotificationStatus: 'PENDING', ...oldWatchObservation },
      { watchNotificationStatus: 'SENDING', OR: [
        { watchNotificationLeaseUntil: { lte: now } },
        { watchNotificationLeaseUntil: null, ...oldWatchObservation },
      ] },
    ] },
  } satisfies {
    schedules: Prisma.ProjectWhereInput;
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
  const [overdueSchedules, uptime, undeliveredUptimeAlerts, undeliveredWatchAlerts] = await Promise.all([
    db.project.count({ where: where.schedules }),
    countUptimeOperationSites(db, now),
    db.uptimeNotification.count({ where: where.uptimeAlerts }),
    db.audit.count({ where: where.watchAlerts }),
  ])
  return { overdueSchedules, ...uptime, undeliveredUptimeAlerts, undeliveredWatchAlerts }
}
