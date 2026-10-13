import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { watchScheduleSchema } from '@/lib/sites/watch-schedule'
import {
  siteSettingsWriteSchema,
  siteRemovalSchema,
} from '@/lib/sites/application/settings-commands'
import { categoryAreaSchema } from '@/lib/sites/domain/execution-spec'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'
import { AdminActionError } from './errors'
import type { AdminAction, AdminActionRequest } from './contracts'
import { revisionHash } from './security'
import { formatMoneyMinor } from '@/lib/billing/ledger'

const empty = z.object({}).strict()
const grantSchema = z
  .object({
    plan: z.enum(['FREE', 'BUILDER', 'TEAM']).optional(),
    siteAllowance: z.number().int().min(1).max(1000).optional(),
    scanAllowance: z.number().int().min(0).max(1_000_000).optional(),
    deepReviewAllowance: z.number().int().min(0).max(1_000_000).optional(),
    allowedWatchIntervals: z
      .array(z.enum(['weekly', 'daily', 'hourly', 'custom']))
      .max(4)
      .default([]),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (value) =>
      value.plan !== undefined ||
      value.siteAllowance !== undefined ||
      value.scanAllowance !== undefined ||
      value.deepReviewAllowance !== undefined ||
      value.allowedWatchIntervals.length > 0,
    'Choose the access to grant.',
  )

export const adminActionInputs: Record<AdminAction, z.ZodType> = {
  OPERATION_RECONCILE: empty,
  SITE_SET_MONITORING: watchScheduleSchema,
  SITE_CHECK: z.object({ categoryArea: categoryAreaSchema.optional() }).strict(),
  AUDIT_RETRY: empty,
  SITE_RECONCILE: empty,
  WATCH_NOTIFICATION_RETRY: empty,
  UPTIME_NOTIFICATION_RETRY: empty,
  SITE_ACCOUNT_RECONCILE: empty,
  SITE_ACCOUNT_CLEANUP: empty,
  SITE_SET_SETTINGS: siteSettingsWriteSchema,
  SITE_REMOVE: siteRemovalSchema,
  USER_SUSPEND: empty,
  USER_REACTIVATE: empty,
  USER_REVOKE_SESSIONS: empty,
  USER_REMOVE: empty,
  ENTITLEMENT_GRANT: grantSchema,
  ENTITLEMENT_REVOKE: empty,
  BILLING_CHANGE_SUBSCRIPTION: z
    .object({
      plan: z.enum(['BUILDER', 'TEAM']),
      quantity: z.number().int().min(1).max(1000),
      timing: z.enum(['period_end', 'immediate']).default('period_end'),
      prorationDate: z.number().int().positive().optional(),
    })
    .strict(),
  BILLING_CANCEL_SUBSCRIPTION: z
    .object({ timing: z.enum(['period_end', 'immediate']).default('period_end') })
    .strict(),
  BILLING_RESUME_SUBSCRIPTION: empty,
  BILLING_RECONCILE: empty,
  BILLING_REFUND: z.object({ amountMinor: z.number().int().positive().optional() }).strict(),
  SHOP_RECHECK: empty,
  SHOP_DISCONNECT: empty,
  SUPPORT_REPLY: z.object({ body: z.string().trim().min(1).max(4000) }).strict(),
  SUPPORT_STATUS: z.object({ status: z.enum(['OPEN', 'WAITING', 'ACTIVE', 'CLOSED']) }).strict(),
  SUPPORT_ASSIGN: z.object({ assigneeId: z.string().min(1).nullable() }).strict(),
  LEAD_UPDATE: z
    .object({
      status: z.enum(['NEW', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'DISQUALIFIED']).optional(),
      notes: z.string().max(10000).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0),
  WAITLIST_BATCH: z.object({ batch: z.union([z.literal(1), z.literal(2)]) }).strict(),
  WAITLIST_GRANT: empty,
  WAITLIST_INVITE: empty,
  EVIDENCE_ACCESS: empty,
  DATA_EXPORT: z
    .object({
      days: z.number().int().min(1).max(365).default(30),
      plan: z.enum(['BUILDER', 'TEAM']).optional(),
      asOf: z.string().datetime().optional(),
    })
    .strict(),
}

const destructiveActions = new Set<AdminAction>([
  'SITE_REMOVE',
  'USER_SUSPEND',
  'USER_REMOVE',
  'SHOP_DISCONNECT',
  'ENTITLEMENT_REVOKE',
])
export function actionNeedsRecentAuthentication(action: AdminAction) {
  return (
    action === 'OPERATION_RECONCILE' ||
    destructiveActions.has(action) ||
    action.startsWith('BILLING_') ||
    action === 'ENTITLEMENT_GRANT' ||
    action === 'USER_REVOKE_SESSIONS'
  )
}
export function actionIsDestructive(action: AdminAction) {
  return (
    action === 'OPERATION_RECONCILE' ||
    destructiveActions.has(action) ||
    action === 'BILLING_REFUND' ||
    action === 'BILLING_CANCEL_SUBSCRIPTION'
  )
}

export function validateAdminActionInput(action: AdminAction, value: unknown) {
  const parsed = adminActionInputs[action].safeParse(value)
  if (!parsed.success)
    throw new AdminActionError(
      parsed.error.issues[0]?.message ?? 'Invalid action details.',
      400,
      'INVALID_INPUT',
    )
  const input = parsed.data as Record<string, unknown>
  if (action === 'ENTITLEMENT_GRANT') {
    const expiry = Date.parse(input.expiresAt as string)
    if (expiry <= Date.now() || expiry > Date.now() + 365 * 86400_000)
      throw new AdminActionError('Choose an expiry within the next year.', 400, 'INVALID_EXPIRY')
  }
  return input
}

export async function resolveAdminTarget(
  request: AdminActionRequest,
  db: Prisma.TransactionClient = prisma,
) {
  const { action, targetId } = request
  let ownerId: string | null = null,
    targetType: string,
    label: string,
    material: unknown
  if (action === 'OPERATION_RECONCILE') {
    const operation = await db.adminOperation.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        status: true,
        action: true,
        ownerId: true,
        targetId: true,
        targetType: true,
      },
    })
    if (!operation || operation.status !== 'INDETERMINATE')
      throw new AdminActionError(
        'Choose an unconfirmed operation.',
        409,
        'OPERATION_NOT_UNCONFIRMED',
      )
    ownerId = operation.ownerId
    targetType = 'OPERATION'
    label = ADMIN_COPY.actions[operation.action as AdminAction] ?? operation.action
    material = operation
  } else if (action.startsWith('SITE_')) {
    const site = await db.project.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        userId: true,
        name: true,
        url: true,
        deletedAt: true,
        watchInterval: true,
        watchEveryMinutes: true,
        accountChecksEnabled: true,
        accountCheckRevision: true,
        notificationLevel: true,
        notifyOnRecovery: true,
        testAccounts: {
          where: { state: { not: 'DELETED' } },
          select: { id: true, email: true, state: true, updatedAt: true },
        },
      },
    })
    if (!site || (site.deletedAt && action !== 'SITE_ACCOUNT_CLEANUP'))
      throw new AdminActionError('Site not found.', 404, 'NOT_FOUND')
    ownerId = site.userId
    targetType = 'SITE'
    label = site.name
    material = site
  } else if (
    action.startsWith('USER_') ||
    (action.startsWith('BILLING_') && action !== 'BILLING_REFUND') ||
    action === 'ENTITLEMENT_GRANT'
  ) {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        email: true,
        role: true,
        lifecycleStatus: true,
        lifecycleRevision: true,
        plan: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
        licensedSiteQuantity: true,
        stripeSubscriptionEventAt: true,
      },
    })
    if (!user) throw new AdminActionError('Customer not found.', 404, 'NOT_FOUND')
    if (
      user.lifecycleStatus === 'DELETING' &&
      !['USER_REMOVE', 'USER_REVOKE_SESSIONS', 'BILLING_RECONCILE'].includes(action)
    )
      throw new AdminActionError(
        'This account is being erased. Settle its cleanup or resume erasure.',
        409,
        'ACCOUNT_DELETING',
      )
    ownerId = user.id
    targetType = 'USER'
    label = user.email
    material = user
    if (
      action.startsWith('BILLING_') &&
      action !== 'BILLING_RECONCILE' &&
      !user.stripeSubscriptionId
    )
      throw new AdminActionError(
        'This account has no subscription to change.',
        409,
        'NO_SUBSCRIPTION',
      )
  } else if (
    action === 'AUDIT_RETRY' ||
    action === 'WATCH_NOTIFICATION_RETRY' ||
    action === 'EVIDENCE_ACCESS'
  ) {
    const audit = await db.audit.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        url: true,
        userId: true,
        projectId: true,
        status: true,
        executionSpec: true,
        watchNotificationStatus: true,
        watchNotificationAttempts: true,
        completedAt: true,
      },
    })
    if (!audit) throw new AdminActionError('Check not found.', 404, 'NOT_FOUND')
    if (
      action === 'AUDIT_RETRY' &&
      (audit.status !== 'FAILED' || !audit.userId || !audit.projectId || !audit.executionSpec)
    )
      throw new AdminActionError(
        'This check cannot reproduce an admitted run. Start an explicitly scoped new check from its Site.',
        409,
        'RETRY_SCOPE_UNAVAILABLE',
      )
    if (action === 'WATCH_NOTIFICATION_RETRY' && audit.watchNotificationStatus !== 'FAILED')
      throw new AdminActionError('This notification is not failed.', 409, 'NOT_FAILED')
    ownerId = audit.userId
    targetType = 'AUDIT'
    label = audit.url
    material = audit
  } else if (action === 'UPTIME_NOTIFICATION_RETRY') {
    const notification = await db.uptimeNotification.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        status: true,
        attempts: true,
        nextAttemptAt: true,
        incident: {
          select: {
            monitor: { select: { project: { select: { id: true, name: true, userId: true } } } },
          },
        },
      },
    })
    if (!notification) throw new AdminActionError('Notification not found.', 404, 'NOT_FOUND')
    if (notification.status !== 'FAILED')
      throw new AdminActionError('This notification is not failed.', 409, 'NOT_FAILED')
    ownerId = notification.incident.monitor.project.userId
    targetType = 'UPTIME_NOTIFICATION'
    label = notification.incident.monitor.project.name
    material = notification
  } else if (action.startsWith('SHOP_')) {
    const shop = await db.shopifyShop.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        shopDomain: true,
        projectId: true,
        uninstalledAt: true,
        linkedAt: true,
        project: { select: { userId: true } },
        paths: { select: { id: true, lastVerifiedAt: true } },
      },
    })
    if (!shop) throw new AdminActionError('Shopify installation not found.', 404, 'NOT_FOUND')
    if (shop.uninstalledAt)
      throw new AdminActionError('This installation has been uninstalled.', 409, 'SHOP_UNINSTALLED')
    ownerId = shop.project?.userId ?? null
    targetType = 'SHOP'
    label = shop.shopDomain
    material = shop
  } else if (action.startsWith('SUPPORT_')) {
    const session = await db.supportSession.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        userId: true,
        visitorEmail: true,
        status: true,
        assignedAgentId: true,
        updatedAt: true,
      },
    })
    if (!session) throw new AdminActionError('Conversation not found.', 404, 'NOT_FOUND')
    if (action === 'SUPPORT_REPLY' && session.status === 'CLOSED')
      throw new AdminActionError('Reopen this conversation before replying.', 409, 'SESSION_CLOSED')
    ownerId = session.userId
    targetType = 'SUPPORT'
    label = session.visitorEmail ?? 'Visitor conversation'
    material = { id: session.id, status: session.status, assignedAgentId: session.assignedAgentId }
  } else if (action === 'LEAD_UPDATE') {
    const lead = await db.lead.findUnique({
      where: { normalizedDomain: targetId },
      select: { id: true, normalizedDomain: true, linkedUserId: true, status: true, notes: true },
    })
    if (!lead) throw new AdminActionError('Lead not found.', 404, 'NOT_FOUND')
    ownerId = lead.linkedUserId
    targetType = 'LEAD'
    label = lead.normalizedDomain
    material = lead
  } else if (action.startsWith('WAITLIST_')) {
    const entry = await db.paidPlanWaitlistEntry.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        userId: true,
        email: true,
        plan: true,
        batch: true,
        accessGrantedAt: true,
        invitedAt: true,
      },
    })
    if (!entry) throw new AdminActionError('Waitlist entry not found.', 404, 'NOT_FOUND')
    ownerId = entry.userId
    targetType = 'WAITLIST'
    label = entry.email ?? entry.userId
    material = entry
  } else if (action === 'ENTITLEMENT_REVOKE') {
    const grant = await db.entitlementGrant.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    })
    if (!grant) throw new AdminActionError('Access grant not found.', 404, 'NOT_FOUND')
    ownerId = grant.userId
    targetType = 'ENTITLEMENT'
    label = 'Complimentary access'
    material = grant
  } else if (action === 'BILLING_REFUND') {
    const payment = await db.billingLedgerEntry.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        userId: true,
        amountMinor: true,
        currency: true,
        status: true,
        paymentReference: true,
        kind: true,
      },
    })
    if (
      !payment ||
      payment.kind === 'REFUND' ||
      payment.status !== 'SUCCEEDED' ||
      !payment.paymentReference
    )
      throw new AdminActionError(
        'A confirmed refundable payment is required.',
        409,
        'PAYMENT_NOT_REFUNDABLE',
      )
    const refunded = await db.billingLedgerEntry.aggregate({
      where: {
        kind: 'REFUND',
        paymentReference: payment.paymentReference,
        status: { in: ['SUCCEEDED', 'PENDING'] },
      },
      _sum: { amountMinor: true },
    })
    const remaining = payment.amountMinor - (refunded._sum.amountMinor ?? 0)
    const amount = request.input.amountMinor ?? remaining
    if (typeof amount !== 'number' || amount <= 0 || amount > remaining)
      throw new AdminActionError(
        'Choose an amount within the remaining refundable balance.',
        409,
        'REFUND_BALANCE_CHANGED',
      )
    request.input.amountMinor = amount
    ownerId = payment.userId
    targetType = 'PAYMENT'
    label = formatMoneyMinor(amount, payment.currency)
    material = { ...payment, remaining }
  } else {
    if (targetId !== 'feedback' && targetId !== 'waitlist')
      throw new AdminActionError('Unknown export.', 400, 'INVALID_EXPORT')
    targetType = 'EXPORT'
    label = targetId === 'feedback' ? 'Feedback digest' : 'Waitlist records'
    material = { targetId, input: request.input }
  }
  return {
    ownerId,
    targetType,
    label,
    revision: revisionHash(material),
    title: ADMIN_COPY.actions[action],
  }
}
