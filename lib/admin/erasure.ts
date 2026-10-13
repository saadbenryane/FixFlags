import { cancelProviderSubscription } from '@/lib/billing/cancel-subscription'
import type { AdminOperation, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { deleteUserProductData } from '@/lib/account/cleanup'
import { appendAdminActivity } from './activity'
import { fenceCustomerWork, guardCustomerLifecycleAction } from './database-actions'
import { resolveAdminTarget } from './targets'
import { AdminDeferredAction, AdminActionError, AdminOutcomeUnknown } from './errors'

export async function performAdminErasure(
  operation: AdminOperation,
): Promise<Prisma.InputJsonObject> {
  await prisma.$transaction(async (tx) => {
    await guardCustomerLifecycleAction(tx, operation)
    const user = await tx.user.findUniqueOrThrow({ where: { id: operation.targetId } })
    if (user.lifecycleStatus !== 'DELETING') {
      await tx.user.update({
        where: { id: user.id },
        data: { lifecycleStatus: 'DELETING', lifecycleRevision: { increment: 1 } },
      })
      await fenceCustomerWork(tx, user.id, new Date())
      await appendAdminActivity(tx, operation, 'ERASURE_STARTED', { state: 'DELETING' })
    }
    const target = await resolveAdminTarget(
      { action: 'USER_REMOVE', targetId: operation.targetId, reason: operation.reason, input: {} },
      tx,
    )
    await tx.adminOperation.update({
      where: { id: operation.id },
      data: { expectedRevision: target.revision, result: { stage: 'SETTLING_OBLIGATIONS' } },
    })
  })
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: operation.targetId },
    select: { stripeSubscriptionId: true },
  })
  if (user.stripeSubscriptionId) {
    try {
      const stripe = getStripe()
      const current = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
        {},
        { timeout: 15_000, maxNetworkRetries: 0 },
      )
      if (current.status !== 'canceled') {
        const canceled = await cancelProviderSubscription(
          stripe,
          current,
          `account-erasure-${operation.targetId}`,
        )
        if (canceled.status !== 'canceled')
          throw new AdminOutcomeUnknown(
            'Subscription cancellation has not been confirmed. Customer data is retained.',
          )
      }
    } catch (error) {
      if (error instanceof AdminActionError) throw error
      throw new AdminOutcomeUnknown(
        'Billing cancellation could not be confirmed. Customer data is retained for reconciliation.',
      )
    }
  }
  const sites = await prisma.project.findMany({
    where: { userId: operation.targetId, testAccounts: { some: { state: { not: 'DELETED' } } } },
    select: { id: true },
    take: 20,
  })
  const cleanupRunIds: string[] = []
  for (const site of sites) {
    const requested = await requestSiteRun({
      projectId: site.id,
      userId: operation.targetId,
      source: 'INTERNAL',
      scope: 'ACCOUNT_CHECKS',
      accountMode: 'cleanup',
      outcomeIds: [],
      idempotencyKey: `admin-erasure-cleanup:${operation.id}:${site.id}`,
      operator: { kind: 'admin', actorId: operation.actorId, operationId: operation.id },
      context: { adminOperationId: operation.id, action: 'account_erasure_cleanup' },
    })
    const run = await prisma.runRequest.findUniqueOrThrow({
      where: { id: requested.runId },
      select: { status: true, errorMessage: true },
    })
    if (run.status === 'FAILED')
      throw new AdminActionError(
        'External account cleanup failed. Resolve the Site cleanup before resuming erasure.',
        409,
        'CLEANUP_FAILED',
      )
    cleanupRunIds.push(requested.runId)
  }
  const remaining = await prisma.siteTestAccount.count({
    where: { project: { userId: operation.targetId }, state: { not: 'DELETED' } },
  })
  if (remaining)
    throw new AdminDeferredAction(
      'Account erasure is waiting for confirmed external test-account cleanup.',
      { stage: 'ACCOUNT_CLEANUP', remainingAccounts: remaining, cleanupRunIds },
    )
  await deleteUserProductData(operation.targetId)
  await prisma.user.delete({ where: { id: operation.targetId } })
  return {
    userId: operation.targetId,
    state: 'ERASED',
    billingCancellationConfirmed: true,
    externalAccountsSettled: true,
  }
}
