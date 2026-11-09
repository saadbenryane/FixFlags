import { systemClock } from '@/lib/time/clock'
import { scheduleUptimeProbes } from '@/lib/uptime/service'
import { reconcileAdminOutcome } from './reconcile'
import type { AdminOperation, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requestSiteRun, reclaimExpiredOutcomeRuns } from '@/lib/sites/application/run-requests'
import { retryAdmittedRun } from '@/lib/sites/application/run-retry'
import { notifyWatchRegression, processDueProjectWatches } from '@/lib/audit/project-watch'
import { deliverUptimeNotifications } from '@/lib/uptime/alerts'
import { currentUptimeNotificationTargetSql } from '@/lib/uptime/monitor-target'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { enqueueIntegrityProbe } from '@/lib/integrity/enqueue'
import { performAdminBillingAction } from './billing-actions'
import { performAdminErasure } from './erasure'
import { AdminActionError, AdminOutcomeUnknown } from './errors'
import { adminDomainActorForOperation, lockAdminSiteOperation } from './domain-actor'
import { resolveAdminTarget } from './targets'
import { currentWatchObservationSql, sameSiteWatchParentSql, watchNotificationRetryEligibleSql } from '@/lib/sites/application/scheduled-observation'

export async function performAdminExternalAction(
  operation: AdminOperation,
  input: Record<string, unknown>,
): Promise<Prisma.InputJsonObject> {
  if (operation.action === 'OPERATION_RECONCILE') return reconcileAdminOutcome(operation)
  if (operation.action.startsWith('BILLING_')) return performAdminBillingAction(operation, input)
  if (operation.action === 'USER_REMOVE') return performAdminErasure(operation)
  switch (operation.action) {
    case 'SITE_CHECK': {
      const result = await requestSiteRun({
        projectId: operation.targetId,
        userId: operation.ownerId!,
        source: 'INTERNAL',
        operator: adminDomainActorForOperation(operation),
        scope: input.categoryArea ? 'CATEGORY' : 'SITE',
        categoryArea: input.categoryArea as Parameters<typeof requestSiteRun>[0]['categoryArea'],
        outcomeIds: [],
        idempotencyKey: `admin-check:${operation.id}`,
        context: { adminOperationId: operation.id },
      })
      return {
        runId: result.runId,
        auditId: result.auditId,
        state: 'ADMITTED',
        reused: result.reused,
      }
    }
    case 'AUDIT_RETRY': {
      const result = await retryAdmittedRun(operation.targetId, adminDomainActorForOperation(operation))
      return {
        runId: result.runId,
        auditId: result.auditId,
        previousAuditId: operation.targetId,
        state: 'ADMITTED',
      }
    }
    case 'SITE_RECONCILE': {
      const actor = adminDomainActorForOperation(operation)
      if (!operation.ownerId) throw new AdminActionError('The Site owner changed before execution.', 409, 'TARGET_CHANGED')
      const scope = { actor, projectId: operation.targetId, userId: operation.ownerId }
      const count = await reclaimExpiredOutcomeRuns(operation.targetId, scope)
      const watch = await processDueProjectWatches(1, {
        onlyProjectId: operation.targetId,
        operator: actor,
      })
      await scheduleUptimeProbes(systemClock, 1, scope)
      return {
        siteId: operation.targetId,
        watchProcessed: watch.processed,
        watchEnqueued: watch.enqueued,
        watchErrors: watch.errors,
        uptimeScheduling: 'RECONCILED',
        reconciledRuns: count,
        state: 'RECONCILED',
      }
    }
    case 'SITE_ACCOUNT_RECONCILE':
    case 'SITE_ACCOUNT_CLEANUP': {
      const result = await requestSiteRun({
        projectId: operation.targetId,
        userId: operation.ownerId!,
        source: 'INTERNAL',
        operator: adminDomainActorForOperation(operation),
        scope: 'ACCOUNT_CHECKS',
        accountMode: operation.action === 'SITE_ACCOUNT_CLEANUP' ? 'cleanup' : 'routine',
        outcomeIds: [],
        idempotencyKey: `admin-accounts:${operation.id}`,
        context: { adminOperationId: operation.id },
      })
      return {
        siteId: operation.targetId,
        runId: result.runId,
        auditId: result.auditId,
        state: 'ADMITTED',
      }
    }
    case 'WATCH_NOTIFICATION_RETRY': {
      const changed = () => new AdminActionError('This notification is no longer eligible for retry.', 409, 'TARGET_CHANGED')
      const ownerId = operation.ownerId
      const audit = await prisma.audit.findUnique({ where: { id: operation.targetId }, select: { id: true, projectId: true } })
      if (!ownerId || !audit?.projectId) throw changed()
      const projectId = audit.projectId
      await prisma.$transaction(async tx => {
        await lockAdminSiteOperation({ actor: adminDomainActorForOperation(operation), projectId, userId: ownerId,
          expectedAction: 'WATCH_NOTIFICATION_RETRY' }, tx, audit.id)
        const current = await resolveAdminTarget({ action: 'WATCH_NOTIFICATION_RETRY', targetId: audit.id,
          reason: operation.reason, input }, tx)
        if (current.revision !== operation.expectedRevision || current.ownerId !== ownerId) throw changed()
        const now = new Date()
        const updated = await tx.$executeRaw`
          UPDATE audits a SET "watchNotificationAttemptCeiling" = a."watchNotificationAttemptCeiling" + 5,
            "watchNotificationNextAttemptAt" = ${now}, "watchNotificationLeaseUntil" = NULL, "updatedAt" = ${now}
          FROM projects p JOIN users u ON u.id = p."userId"
          WHERE a.id = ${audit.id} AND a."projectId" = p.id AND p.id = ${projectId} AND a."userId" = p."userId"
            AND p."userId" = ${ownerId} AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'
            AND ${watchNotificationRetryEligibleSql(now)} AND ${currentWatchObservationSql} AND ${sameSiteWatchParentSql}`
        if (!updated) throw changed()
      })
      await notifyWatchRegression(audit.id)
      const current = await prisma.audit.findFirst({
        where: { id: audit.id, userId: ownerId, projectId, project: { userId: ownerId, deletedAt: null } },
        select: { watchNotificationStatus: true, watchNotificationProviderId: true },
      })
      if (!current) throw changed()
      if (current.watchNotificationStatus === 'FAILED')
        throw new AdminActionError(
          'The notification retry failed. Its delivery receipt is retained.',
          503,
          'NOTIFICATION_FAILED',
        )
      if (current.watchNotificationStatus === 'SENDING' || current.watchNotificationStatus === 'PENDING')
        throw new AdminOutcomeUnknown('Notification acceptance has not been confirmed.')
      return {
        auditId: audit.id,
        state: current.watchNotificationStatus ?? 'NOT_RECORDED',
        providerId: current.watchNotificationProviderId,
      }
    }
    case 'UPTIME_NOTIFICATION_RETRY': {
      const changed = () => new AdminActionError('This notification is no longer eligible for retry.', 409, 'TARGET_CHANGED')
      const ownerId = operation.ownerId
      const receipt = await prisma.uptimeNotification.findUnique({ where: { id: operation.targetId },
        select: { incident: { select: { monitor: { select: { projectId: true } } } } },
      })
      if (!receipt || !ownerId) throw changed()
      const projectId = receipt.incident.monitor.projectId
      await prisma.$transaction(async tx => {
        await lockAdminSiteOperation({ actor: adminDomainActorForOperation(operation), projectId, userId: ownerId,
          expectedAction: 'UPTIME_NOTIFICATION_RETRY' }, tx)
        const [locked] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM uptime_notifications
          WHERE id = ${operation.targetId} AND status = 'FAILED' FOR UPDATE`
        if (!locked) throw changed()
        const current = await resolveAdminTarget({ action: 'UPTIME_NOTIFICATION_RETRY', targetId: operation.targetId,
          reason: operation.reason, input }, tx)
        if (current.revision !== operation.expectedRevision || current.ownerId !== ownerId) throw changed()
        const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { url: true } })
        const target = normalizeAuditUrl(project.url), now = new Date()
        if (!target.ok) throw changed()
        const updated = await tx.$executeRaw`UPDATE uptime_notifications n SET status = 'PENDING',
          "maxAttempts" = n."maxAttempts" + 8, "nextAttemptAt" = ${now}, "leaseUntil" = NULL
          FROM uptime_incidents i JOIN uptime_monitors m ON m.id = i."monitorId" JOIN projects p ON p.id = m."projectId"
          WHERE n.id = ${operation.targetId} AND n."incidentId" = i.id AND p.id = ${projectId} AND p."userId" = ${ownerId}
            AND n.status = 'FAILED' AND n."providerId" IS NULL AND n."sentAt" IS NULL
            AND (n."leaseUntil" IS NULL OR n."leaseUntil" < ${now}) AND ${currentUptimeNotificationTargetSql}
            AND m."targetUrl" = ${target.url} AND m.enabled AND p."watchInterval" IS NOT NULL AND p."watchPausedAt" IS NULL
            AND EXISTS (SELECT 1 FROM users u WHERE u.id = p."userId" AND u."emailVerified")
            AND p."notificationLevel" <> 'OFF' AND ((n.kind = 'DOWN' AND i."recoveredAt" IS NULL)
              OR (n.kind = 'RECOVERED' AND p."notifyOnRecovery" AND i."recoveredAt" IS NOT NULL))`
        if (!updated) throw changed()
      })
      await deliverUptimeNotifications(new Date(), 20, { receiptId: operation.targetId, ownerId })
      const current = await prisma.uptimeNotification.findUnique({
        where: { id: operation.targetId, incident: { monitor: { project: { id: projectId, userId: ownerId } } } },
      })
      if (!current) throw changed()
      if (current.status === 'FAILED')
        throw new AdminActionError(
          'The uptime notification retry failed.',
          503,
          'NOTIFICATION_FAILED',
        )
      if (current.status === 'SENDING' || current.status === 'PENDING')
        throw new AdminOutcomeUnknown('Notification acceptance has not been confirmed.')
      return { notificationId: current.id, state: current.status, providerId: current.providerId }
    }
    case 'SHOP_RECHECK': {
      const paths = await prisma.revenuePath.findMany({
        where: { shopId: operation.targetId, shop: { uninstalledAt: null } },
        select: { id: true },
      })
      if (!paths.length)
        throw new AdminActionError('No purchase paths are available to recheck.', 409, 'NO_PATHS')
      for (const path of paths) await enqueueIntegrityProbe(path.id, `admin-${operation.id}`)
      return { shopId: operation.targetId, pathIds: paths.map((path) => path.id), state: 'QUEUED' }
    }
    default:
      throw new AdminActionError('Unsupported operator action.', 400, 'UNSUPPORTED_ACTION')
  }
}
