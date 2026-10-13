import { isAdminUser } from '@/lib/auth/permissions'
import { getEnv } from '@/lib/env'
import { cancelSiteExecutions } from '@/lib/sites/application/cancel-executions'
import { cancelProviderSubscription } from '@/lib/billing/cancel-subscription'
import { prisma } from '@/lib/db'
import { deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'
import { getStripe } from '@/lib/stripe'
import { AdminActionError } from '@/lib/admin/errors'

export async function deleteUserProductData(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeSubscriptionId: true, stripeCustomerId: true },
  })

  const unsettled = await prisma.siteTestAccount.count({
    where: { project: { userId }, state: { not: 'DELETED' } },
  })
  if (unsettled)
    throw new AdminActionError(
      'External test accounts must be settled before customer data can be erased.',
      409,
      'ACCOUNT_CLEANUP_REQUIRED',
    )
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId} FOR UPDATE`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fixflags:active-admin-guard'))`
    const account = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, lifecycleStatus: true },
    })
    if (account && isAdminUser(account)) {
      const others = await tx.user.count({
        where: {
          id: { not: userId },
          lifecycleStatus: 'ACTIVE',
          OR: [{ role: 'admin' }, { id: { in: getEnv().ADMIN_USER_IDS } }],
        },
      })
      if (!others)
        throw new AdminActionError(
          'Keep at least one active administrator.',
          409,
          'LAST_ADMIN_REQUIRED',
        )
    }
    if (account && account.lifecycleStatus !== 'DELETING') {
      await tx.user.update({
        where: { id: userId },
        data: { lifecycleStatus: 'DELETING', lifecycleRevision: { increment: 1 } },
      })
      const projects = await tx.project.findMany({ where: { userId }, select: { id: true } })
      for (const project of projects)
        await cancelSiteExecutions(tx, project.id, new Date(), {
          code: 'ACCOUNT_UNAVAILABLE',
          message: 'Account erasure has started.',
        })
      await tx.session.deleteMany({ where: { userId } })
      await tx.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await tx.oAuthRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await tx.oAuthAuthorizationCode.deleteMany({ where: { userId } })
    }
  })
  if (user?.stripeSubscriptionId) {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    if (subscription.status !== 'canceled') {
      const canceled = await cancelProviderSubscription(
        stripe,
        subscription,
        `account-erasure-${userId}`,
      )
      if (canceled.status !== 'canceled')
        throw new AdminActionError(
          'Subscription cancellation is not confirmed. Customer data is retained.',
          409,
          'BILLING_CANCELLATION_UNCONFIRMED',
        )
    }
  }

  const audits = await prisma.audit.findMany({
    where: { OR: [{ userId }, { project: { userId } }] },
    select: { id: true },
  })
  await deleteAuditScreenshotAssets(audits.map((audit) => audit.id))
  await prisma.$transaction([
    prisma.waitlistLead.deleteMany({
      where: {
        OR: [
          { claimedUserId: userId },
          ...(user?.email ? [{ email: { equals: user.email, mode: 'insensitive' as const } }] : []),
        ],
      },
    }),
    prisma.waitlistInvite.deleteMany({
      where: {
        OR: [
          { joinedUserId: userId },
          ...(user?.email
            ? [{ inviteeEmail: { equals: user.email, mode: 'insensitive' as const } }]
            : []),
        ],
      },
    }),
    prisma.auditFeedback.deleteMany({ where: { userId } }),
    prisma.flagFeedback.deleteMany({ where: { userId } }),
    prisma.lead.updateMany({ where: { linkedUserId: userId }, data: { notes: null } }),
    prisma.adminOperation.updateMany({
      where: { ownerId: userId, action: { in: ['SUPPORT_REPLY', 'LEAD_UPDATE'] } },
      data: { input: { contentCleared: true } },
    }),
    prisma.supportSession.deleteMany({ where: { userId } }),
    prisma.repoFixPr.deleteMany({ where: { userId } }),
    prisma.repoScan.deleteMany({ where: { userId } }),
    prisma.audit.deleteMany({ where: { OR: [{ userId }, { project: { userId } }] } }),
    prisma.project.deleteMany({ where: { userId } }),
    prisma.apiKey.deleteMany({ where: { userId } }),
    prisma.emailLog.deleteMany({ where: { userId } }),
  ])
}
