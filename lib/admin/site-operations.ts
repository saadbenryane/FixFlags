import { prisma } from '@/lib/db'
import { accountsAwaitingAction } from './account-operations'
import { incompleteExecutionHistory } from './task-operations'
import { countGuidanceGaps } from './guidance-operations'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'
import { countMonitoringOperations } from '@/lib/sites/application/monitoring-operations'

/** Aggregate operating evidence only. The calling admin page enforces operator access. */
export async function loadSiteOperations(now = new Date()) {
  const interrupted = new Date(now.getTime() - 15 * 60_000)
  const [
    monitoring,
    incompleteTasks,
    pendingAccountReconciliation,
    missingGuidance,
  ] = await Promise.all([
    countMonitoringOperations(prisma, now),
    prisma.auditVerifierExecution.count({ where: incompleteExecutionHistory() }),
    prisma.siteTestAccount.count({
      where: accountsAwaitingAction(interrupted),
    }),
    countGuidanceGaps(prisma),
  ])
  return [
    { label: 'Overdue monitoring schedules', value: monitoring.overdueSchedules },
    { label: 'Incomplete execution history', value: incompleteTasks },
    { label: 'Accounts awaiting reconciliation', value: pendingAccountReconciliation },
    { label: ADMIN_COPY.operations.uptime, value: monitoring.overdueUptimeProbes + monitoring.inconclusiveUptimeSites },
    { label: 'Uptime notifications needing attention', value: monitoring.undeliveredUptimeAlerts },
    { label: 'Monitoring notifications needing attention', value: monitoring.undeliveredWatchAlerts },
    { label: ADMIN_COPY.operations.guidance, value: missingGuidance },
  ]
}
