import { Prisma, type Project, type UptimeMonitor } from '@prisma/client'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { UPTIME_INTERVAL_MS, uptimeSlotStart } from './domain'
import { uptimeEligible } from './eligibility'

type Transition = { targetUrl: string; enabled: boolean; changed: boolean }

/** Incident and monitor aliases are shared by delivery and operator queries. */
export const currentUptimeNotificationTargetSql = Prisma.sql`i.version = m.version
  AND i."targetUrl" = m."targetUrl" AND i."supersededAt" IS NULL`

/** The caller holds the Site row through initial monitor admission. */
export function createInitialUptimeMonitor(tx: Prisma.TransactionClient, projectId: string, targetUrl: string, now: Date) {
  return tx.uptimeMonitor.createMany({
    data: { projectId, targetUrl, nextProbeAt: new Date(uptimeSlotStart(now.getTime())) },
    skipDuplicates: true,
  })
}

/** The caller holds the monitor row through its generation and incident writes. */
export async function applyUptimeMonitorTransition(tx: Prisma.TransactionClient,
  current: Pick<UptimeMonitor, 'id' | 'lastScheduledAt'>, transition: Transition, now: Date) {
  const { targetUrl, enabled, changed } = transition
  const monitorId = current.id
  const due = uptimeSlotStart(now.getTime()) + (enabled ? 0 : UPTIME_INTERVAL_MS)
  const nextUnusedSlot = !changed && current.lastScheduledAt ? current.lastScheduledAt.getTime() + UPTIME_INTERVAL_MS : due
  if (changed) await tx.uptimeIncident.updateMany({ where: { monitorId, recoveredAt: null, supersededAt: null }, data: { supersededAt: now } })
  const monitor = await tx.uptimeMonitor.update({ where: { id: monitorId }, data: {
    enabled, ...(changed ? { targetUrl, version: { increment: 1 }, lastCheckedAt: null, lastScheduledAt: null } : {}),
    state: enabled ? 'unknown' : 'paused',
    nextProbeAt: new Date(Math.max(due, nextUnusedSlot)),
    pendingFailureAt: null, pendingSlotAt: null, confirmationDueAt: null, leaseUntil: null, leaseToken: null,
    lastDispatchAttemptAt: null,
  } })
  if (changed) await tx.uptimeNotification.updateMany({ where: {
    incident: { monitorId, version: { lt: monitor.version } }, status: { in: ['PENDING', 'FAILED'] },
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
  }, data: { status: 'SKIPPED', leaseUntil: null } })
  return monitor
}

function lockSiteUptimeMonitor(tx: Prisma.TransactionClient, projectId: string) {
  return tx.$queryRaw<Array<Pick<UptimeMonitor, 'id' | 'lastScheduledAt' | 'targetUrl' | 'enabled'>>>`
    SELECT id, "lastScheduledAt", "targetUrl", enabled FROM uptime_monitors WHERE "projectId" = ${projectId} FOR UPDATE`
}

/** Called after saving active monitoring intent under the Site row lock. */
export async function enableUptimeMonitor(tx: Prisma.TransactionClient, projectId: string, targetUrl: string, now: Date) {
  const [monitor] = await lockSiteUptimeMonitor(tx, projectId)
  if (!monitor) {
    await createInitialUptimeMonitor(tx, projectId, targetUrl, now)
    return
  }
  const changed = targetUrl !== monitor.targetUrl
  if (!monitor.enabled || changed) await applyUptimeMonitorTransition(tx, monitor, { targetUrl, enabled: true, changed }, now)
}

/** Keep target identity and its probe generation atomic with the Site edit. */
export async function reconcileEditedUptimeTarget(tx: Prisma.TransactionClient, previousUrl: string | undefined, project: Project, now = new Date()) {
  if (previousUrl === undefined || previousUrl === project.url) return project
  const previous = normalizeAuditUrl(previousUrl), target = normalizeAuditUrl(project.url)
  if (!target.ok || previous.ok && previous.url === target.url) return project

  // Site edits hold the project row first, matching probe commit and pause.
  const [monitor] = await lockSiteUptimeMonitor(tx, project.id)
  if (monitor) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: project.userId }, select: { id: true, lifecycleStatus: true } })
    await applyUptimeMonitorTransition(tx, monitor, { targetUrl: target.url, enabled: uptimeEligible({ ...project, user }), changed: true }, now)
  }
  return project.uptimeSetupRetryAt ? tx.project.update({ where: { id: project.id }, data: { uptimeSetupRetryAt: null } }) : project
}
