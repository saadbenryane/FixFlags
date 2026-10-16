import { prisma } from '@/lib/db'
import { accountsAwaitingAction } from './account-operations'

/** Aggregate operating evidence only. The calling admin page enforces operator access. */
export async function loadSiteOperations(now = new Date()) {
  const activeSite = { deletedAt: null, watchInterval: { not: null } }
  const thresholds = {
    overdue: new Date(now.getTime() - 5 * 60_000),
    interrupted: new Date(now.getTime() - 15 * 60_000),
  }
  const [
    overdueSchedules,
    incompleteTasks,
    pendingAccountReconciliation,
    uptimeGaps,
    failedUptimeAlerts,
    failedWatchAlerts,
  ] = await Promise.all([
    prisma.project.count({ where: { ...activeSite, watchNextRunAt: { lt: thresholds.overdue } } }),
    prisma.auditVerifierExecution.count({
      where: {
        workState: { in: ['BLOCKED', 'EXHAUSTED'] },
        audit: { project: activeSite },
        updatedAt: { gte: new Date(now.getTime() - 86400_000) },
      },
    }),
    prisma.siteTestAccount.count({
      where: accountsAwaitingAction(thresholds.interrupted),
    }),
    prisma.uptimeMonitor.count({
      where: { enabled: true, project: activeSite, nextProbeAt: { lt: thresholds.overdue } },
    }),
    prisma.uptimeNotification.count({
      where: { status: 'FAILED', incident: { monitor: { project: activeSite } } },
    }),
    prisma.audit.count({ where: { watchNotificationStatus: 'FAILED', project: activeSite } }),
  ])
  return [
    { label: 'Overdue monitoring schedules', value: overdueSchedules },
    { label: 'Incomplete tasks in 24 hours', value: incompleteTasks },
    { label: 'Accounts awaiting reconciliation', value: pendingAccountReconciliation },
    { label: 'Overdue uptime probes', value: uptimeGaps },
    { label: 'Failed uptime notifications', value: failedUptimeAlerts },
    { label: 'Failed monitoring notifications', value: failedWatchAlerts },
  ]
}
