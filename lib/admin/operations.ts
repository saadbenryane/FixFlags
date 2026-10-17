import type { Prisma } from '@prisma/client'
import { accountsAwaitingAction, requiresAccountCleanup } from './account-operations'
import { incompleteExecutionHistory } from './task-operations'
import type { AdminActor } from '@/lib/auth/require-admin'
import { adminRead } from './workspace-queries'
import { adminPagination, readAdminListQuery } from './list-query'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
export const OPERATION_QUEUES = [
  { id: 'schedules', label: 'Overdue monitoring schedules' },
  { id: 'tasks', label: 'Incomplete execution history' },
  { id: 'accounts', label: 'Accounts awaiting reconciliation' },
  { id: 'uptime', label: 'Overdue uptime probes' },
  { id: 'uptime-alerts', label: 'Failed uptime notifications' },
  { id: 'watch-alerts', label: 'Failed monitoring notifications' },
] as const
export async function loadOperations(actor: AdminActor, params: { queue?: string; page?: string }) {
  const queue = OPERATION_QUEUES.some((q) => q.id === params.queue) ? params.queue! : 'schedules',
    now = new Date(),
    overdue = new Date(now.getTime() - 300000),
    interrupted = new Date(now.getTime() - 900000)
  const active: Prisma.ProjectWhereInput = { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } }
  const data = await adminRead(actor, async (db) => {
    const sites: Prisma.ProjectWhereInput = {
      ...active,
      watchInterval: { not: null },
      watchNextRunAt: { lt: overdue },
    }
    const tasks = incompleteExecutionHistory()
    const accounts = accountsAwaitingAction(interrupted)
    const uptime: Prisma.UptimeMonitorWhereInput = {
      enabled: true,
      project: active,
      nextProbeAt: { lt: overdue },
    }
    const uptimeAlerts: Prisma.UptimeNotificationWhereInput = {
      status: 'FAILED',
      incident: { monitor: { project: active } },
    }
    const watchAlerts: Prisma.AuditWhereInput = {
      watchNotificationStatus: 'FAILED',
      project: active,
    }
    const counts = await Promise.all([
      db.project.count({ where: sites }),
      db.auditVerifierExecution.count({ where: tasks }),
      db.siteTestAccount.count({ where: accounts }),
      db.uptimeMonitor.count({ where: uptime }),
      db.uptimeNotification.count({ where: uptimeAlerts }),
      db.audit.count({ where: watchAlerts }),
    ])
    const index = OPERATION_QUEUES.findIndex((q) => q.id === queue),
      total = counts[index],
      pagination = adminPagination(readAdminListQuery(params).page, total),
      slice = { skip: pagination.skip, take: pagination.take }
    let rows: Array<{
      id: string
      siteId: string
      label: string
      state: string
      at: Date | null
      action:
        | 'SITE_RECONCILE'
        | 'AUDIT_RETRY'
        | 'SITE_ACCOUNT_RECONCILE'
        | 'SITE_ACCOUNT_CLEANUP'
        | 'UPTIME_NOTIFICATION_RETRY'
        | 'WATCH_NOTIFICATION_RETRY'
        | null
      targetId: string
      auditId?: string
    }> = []
    if (queue === 'schedules')
      rows = (
        await db.project.findMany({
          where: sites,
          ...slice,
          orderBy: [{ watchNextRunAt: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true, watchNextRunAt: true },
        })
      ).map((p) => ({
        id: p.id,
        siteId: p.id,
        label: p.name,
        state: 'Schedule overdue',
        at: p.watchNextRunAt,
        action: 'SITE_RECONCILE',
        targetId: p.id,
      }))
    if (queue === 'tasks')
      rows = (
        await db.auditVerifierExecution.findMany({
          where: tasks,
          ...slice,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            workState: true,
            workErrorCode: true,
            updatedAt: true,
            audit: { select: { id: true, projectId: true, url: true } },
          },
        })
      ).map((t) => ({
        id: t.id,
        siteId: t.audit.projectId!,
        label: t.audit.url,
        state: `${t.workState}${t.workErrorCode ? ' · ' + t.workErrorCode : ''}`,
        at: t.updatedAt,
        // Inspection reaches the original report and its canonical actions.
        // Site reconciliation cannot retry a terminal task or a partial report.
        action: null,
        targetId: t.audit.id,
        auditId: t.audit.id,
      }))
    if (queue === 'accounts')
      rows = (
        await db.siteTestAccount.findMany({
          where: accounts,
          ...slice,
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            state: true,
            updatedAt: true,
            project: { select: { id: true, name: true, deletedAt: true, accountChecksEnabled: true } },
          },
        })
      ).map((a) => ({
        id: a.id,
        siteId: a.project.id,
        label: a.project.name,
        state: requiresAccountCleanup(a.project) ? `${a.state} · Cleanup required` : a.state,
        at: a.updatedAt,
        action: requiresAccountCleanup(a.project) ? 'SITE_ACCOUNT_CLEANUP' : 'SITE_ACCOUNT_RECONCILE',
        targetId: a.project.id,
      }))
    if (queue === 'uptime')
      rows = (
        await db.uptimeMonitor.findMany({
          where: uptime,
          ...slice,
          orderBy: [{ nextProbeAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            state: true,
            nextProbeAt: true,
            project: { select: { id: true, name: true } },
          },
        })
      ).map((m) => ({
        id: m.id,
        siteId: m.project.id,
        label: m.project.name,
        state: m.state,
        at: m.nextProbeAt,
        action: 'SITE_RECONCILE',
        targetId: m.project.id,
      }))
    if (queue === 'uptime-alerts')
      rows = (
        await db.uptimeNotification.findMany({
          where: uptimeAlerts,
          ...slice,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            status: true,
            createdAt: true,
            incident: {
              select: { monitor: { select: { project: { select: { id: true, name: true } } } } },
            },
          },
        })
      ).map((n) => ({
        id: n.id,
        siteId: n.incident.monitor.project.id,
        label: n.incident.monitor.project.name,
        state: n.status,
        at: n.createdAt,
        action: 'UPTIME_NOTIFICATION_RETRY',
        targetId: n.id,
      }))
    if (queue === 'watch-alerts')
      rows = (
        await db.audit.findMany({
          where: watchAlerts,
          ...slice,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, projectId: true, url: true, createdAt: true },
        })
      ).map((a) => ({
        id: a.id,
        siteId: a.projectId!,
        label: a.url,
        state: 'Delivery failed',
        at: a.createdAt,
        action: 'WATCH_NOTIFICATION_RETRY',
        targetId: a.id,
      }))
    return { queue, total, pagination, rows, counts }
  })
  try {
    const heartbeat = await readWorkerHeartbeat()
    return {
      ...data,
      worker: heartbeat?.alive
        ? heartbeat.browserOk
          ? 'Ready'
          : 'Browser unavailable'
        : 'No active heartbeat',
    }
  } catch {
    return { ...data, worker: 'Heartbeat unavailable' }
  }
}
