import { scheduleUptimeProbes } from '@/lib/uptime/service'
import { reconcileAdminOutcome } from './reconcile'
import type { AdminOperation, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requestSiteRun, reclaimExpiredOutcomeRuns } from '@/lib/sites/application/run-requests'
import { retryAdmittedRun } from '@/lib/sites/application/run-retry'
import { notifyWatchRegression, processDueProjectWatches } from '@/lib/audit/project-watch'
import { deliverUptimeNotifications } from '@/lib/uptime/alerts'
import { enqueueIntegrityProbe } from '@/lib/integrity/enqueue'
import { performAdminBillingAction } from './billing-actions'
import { performAdminErasure } from './erasure'
import { AdminActionError, AdminOutcomeUnknown } from './errors'

export async function performAdminExternalAction(
  operation: AdminOperation,
  input: Record<string, unknown>,
): Promise<Prisma.InputJsonObject> {
  if (operation.action === 'OPERATION_RECONCILE') return reconcileAdminOutcome(operation)
  if (operation.action.startsWith('BILLING_')) return performAdminBillingAction(operation, input)
  if (operation.action === 'USER_REMOVE') return performAdminErasure(operation)
  const operator = { kind: 'admin' as const, actorId: operation.actorId, operationId: operation.id }
  switch (operation.action) {
    case 'SITE_CHECK': {
      const result = await requestSiteRun({
        projectId: operation.targetId,
        userId: operation.ownerId!,
        source: 'INTERNAL',
        operator,
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
      const result = await retryAdmittedRun(operation.targetId, operator)
      return {
        runId: result.runId,
        auditId: result.auditId,
        previousAuditId: operation.targetId,
        state: 'ADMITTED',
      }
    }
    case 'SITE_RECONCILE': {
      const count = await reclaimExpiredOutcomeRuns(operation.targetId)
      const watch = await processDueProjectWatches(1, {
        onlyProjectId: operation.targetId,
        operator,
      })
      await scheduleUptimeProbes(new Date(), 1, operation.targetId)
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
        operator,
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
      const audit = await prisma.audit.findUniqueOrThrow({
        where: { id: operation.targetId },
        select: { id: true, parentId: true, watchNotificationAttempts: true },
      })
      await prisma.audit.update({
        where: { id: audit.id },
        data: { watchNotificationAttemptCeiling: { increment: 5 } },
      })
      await notifyWatchRegression(audit.parentId, audit.id)
      const current = await prisma.audit.findUniqueOrThrow({
        where: { id: audit.id },
        select: { watchNotificationStatus: true, watchNotificationProviderId: true },
      })
      if (current.watchNotificationStatus === 'FAILED')
        throw new AdminActionError(
          'The notification retry failed. Its delivery receipt is retained.',
          503,
          'NOTIFICATION_FAILED',
        )
      if (current.watchNotificationStatus === 'SENDING')
        throw new AdminOutcomeUnknown('Notification acceptance has not been confirmed.')
      return {
        auditId: audit.id,
        state: current.watchNotificationStatus ?? 'NOT_RECORDED',
        providerId: current.watchNotificationProviderId,
      }
    }
    case 'UPTIME_NOTIFICATION_RETRY': {
      await prisma.uptimeNotification.update({
        where: { id: operation.targetId },
        data: { status: 'PENDING', maxAttempts: { increment: 8 }, nextAttemptAt: new Date() },
      })
      await deliverUptimeNotifications(new Date(), 20, operation.targetId)
      const current = await prisma.uptimeNotification.findUniqueOrThrow({
        where: { id: operation.targetId },
      })
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
