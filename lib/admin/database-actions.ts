import { decryptSecret } from '@/lib/security/crypto'
import { randomBytes } from 'node:crypto'
import type { AdminOperation, Prisma } from '@prisma/client'
import { getEnv } from '@/lib/env'
import { isAdminUser } from '@/lib/auth/permissions'
import { cancelSiteExecutions } from '@/lib/sites/application/cancel-executions'
import { saveSiteSettings, removeSite } from '@/lib/sites/application/settings-commands'
import { setProjectWatch } from '@/lib/sites/application/monitoring-settings'
import { appendSupportMessage } from '@/lib/live-support/ordered-messages'
import { SITE_URL } from '@/lib/marketing/copy-barrel'
import { AdminActionError } from './errors'

const databaseActions = new Set([
  'SITE_SET_MONITORING',
  'SITE_SET_SETTINGS',
  'SITE_REMOVE',
  'USER_SUSPEND',
  'USER_REACTIVATE',
  'USER_REVOKE_SESSIONS',
  'ENTITLEMENT_GRANT',
  'ENTITLEMENT_REVOKE',
  'SUPPORT_REPLY',
  'SUPPORT_STATUS',
  'SUPPORT_ASSIGN',
  'LEAD_UPDATE',
  'WAITLIST_BATCH',
  'WAITLIST_GRANT',
  'WAITLIST_INVITE',
  'SHOP_DISCONNECT',
  'EVIDENCE_ACCESS',
  'DATA_EXPORT',
])
export function isDatabaseAdminAction(action: string) {
  return databaseActions.has(action)
}

export async function guardCustomerLifecycleAction(
  tx: Prisma.TransactionClient,
  operation: Pick<AdminOperation, 'actorId' | 'targetId'>,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fixflags:active-admin-guard'))`
  if (operation.actorId === operation.targetId)
    throw new AdminActionError(
      'You cannot suspend or erase your own administrator account.',
      409,
      'SELF_ACTION_FORBIDDEN',
    )
  const target = await tx.user.findUniqueOrThrow({
    where: { id: operation.targetId },
    select: { id: true, role: true, lifecycleStatus: true },
  })
  if (isAdminUser(target) && target.lifecycleStatus === 'ACTIVE') {
    const activeAdmins = await tx.user.count({
      where: {
        lifecycleStatus: 'ACTIVE',
        OR: [{ role: 'admin' }, { id: { in: getEnv().ADMIN_USER_IDS } }],
      },
    })
    if (activeAdmins <= 1)
      throw new AdminActionError(
        'Keep at least one active administrator.',
        409,
        'LAST_ADMIN_REQUIRED',
      )
  }
}

export async function fenceCustomerWork(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const sites = await tx.project.findMany({ where: { userId }, select: { id: true } })
  for (const site of sites) {
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${site.id} FOR UPDATE`
    await cancelSiteExecutions(tx, site.id, now, {
      code: 'ACCOUNT_UNAVAILABLE',
      message: 'The account is unavailable. Previous evidence is retained.',
    })
  }
  await tx.session.deleteMany({ where: { userId } })
  await tx.oAuthAuthorizationCode.deleteMany({ where: { userId } })
  await tx.apiKey.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })
  await tx.oAuthRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  })
}

export async function performAdminDatabaseAction(
  tx: Prisma.TransactionClient,
  operation: AdminOperation,
  input: Record<string, unknown>,
): Promise<Prisma.InputJsonObject> {
  const targetId = operation.targetId,
    now = new Date()
  switch (operation.action) {
    case 'SITE_SET_MONITORING': {
      const result = await setProjectWatch(
        { projectId: targetId, userId: operation.ownerId!, ...input } as Parameters<
          typeof setProjectWatch
        >[0],
        { tx },
      )
      if (!result.ok) throw new AdminActionError(result.error, 409, result.code)
      return { siteId: targetId, interval: input.interval as string | null, state: 'SAVED' }
    }
    case 'SITE_SET_SETTINGS': {
      await saveSiteSettings({ projectId: targetId, userId: operation.ownerId! }, input, tx)
      return { siteId: targetId, state: 'SAVED' }
    }
    case 'SITE_REMOVE': {
      const remaining = await tx.siteTestAccount.count({
        where: { projectId: targetId, state: { not: 'DELETED' } },
      })
      await removeSite({ projectId: targetId, userId: operation.ownerId! }, input, tx)
      return {
        siteId: targetId,
        state: 'REMOVED',
        externalAccountDeletionVerified: remaining === 0,
      }
    }
    case 'USER_SUSPEND': {
      await guardCustomerLifecycleAction(tx, operation)
      const user = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
        select: { lifecycleStatus: true },
      })
      if (user.lifecycleStatus === 'DELETING')
        throw new AdminActionError('This account is already being erased.', 409, 'ACCOUNT_DELETING')
      await tx.user.update({
        where: { id: targetId },
        data: {
          lifecycleStatus: 'SUSPENDED',
          suspendedAt: now,
          lifecycleRevision: { increment: 1 },
        },
      })
      await fenceCustomerWork(tx, targetId, now)
      return { userId: targetId, state: 'SUSPENDED' }
    }
    case 'USER_REACTIVATE': {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
        select: { lifecycleStatus: true },
      })
      if (user.lifecycleStatus === 'DELETING')
        throw new AdminActionError(
          'An erasing account cannot be reactivated.',
          409,
          'ACCOUNT_DELETING',
        )
      await tx.user.update({
        where: { id: targetId },
        data: { lifecycleStatus: 'ACTIVE', suspendedAt: null, lifecycleRevision: { increment: 1 } },
      })
      return { userId: targetId, state: 'ACTIVE', monitoringPreferencesPreserved: true }
    }
    case 'USER_REVOKE_SESSIONS': {
      const result = await tx.session.deleteMany({ where: { userId: targetId } })
      return { userId: targetId, revokedSessions: result.count }
    }
    case 'ENTITLEMENT_GRANT': {
      const grant = await tx.entitlementGrant.create({
        data: {
          userId: targetId,
          operationId: operation.id,
          grantedBy: operation.actorId,
          plan: input.plan as 'FREE' | 'BUILDER' | 'TEAM' | undefined,
          siteAllowance: input.siteAllowance as number | undefined,
          scanAllowance: input.scanAllowance as number | undefined,
          deepReviewAllowance: input.deepReviewAllowance as number | undefined,
          allowedWatchIntervals: input.allowedWatchIntervals as string[],
          expiresAt: new Date(input.expiresAt as string),
        },
      })
      return { grantId: grant.id, userId: targetId, expiresAt: grant.expiresAt.toISOString() }
    }
    case 'ENTITLEMENT_REVOKE': {
      await tx.entitlementGrant.update({ where: { id: targetId }, data: { revokedAt: now } })
      return { grantId: targetId, state: 'REVOKED' }
    }
    case 'SUPPORT_REPLY': {
      const message = await appendSupportMessage(tx, {
        sessionId: targetId,
        role: 'AGENT',
        senderId: operation.actorId,
        requestKey: operation.id,
        body: input.body as string,
      })
      await tx.supportSession.update({
        where: { id: targetId },
        data: {
          lastMessageAt: message.createdAt,
          unreadByVisitor: { increment: 1 },
          status: 'ACTIVE',
          assignedAgentId: operation.actorId,
        },
      })
      const draft = await tx.supportDraft.findUnique({
        where: { actorId_sessionId: { actorId: operation.actorId, sessionId: targetId } },
      })
      if (draft && decryptSecret(draft.body).trim() === input.body)
        await tx.supportDraft.deleteMany({ where: { id: draft.id, revision: draft.revision } })
      return { messageId: message.id, sessionId: targetId, sequence: message.sequence.toString() }
    }
    case 'SUPPORT_STATUS': {
      await tx.supportSession.update({
        where: { id: targetId },
        data: { status: input.status as 'OPEN' | 'WAITING' | 'ACTIVE' | 'CLOSED' },
      })
      return { sessionId: targetId, status: input.status as string }
    }
    case 'SUPPORT_ASSIGN': {
      const assigneeId = input.assigneeId as string | null
      if (assigneeId) {
        const assignee = await tx.user.findUnique({
          where: { id: assigneeId },
          select: { id: true, role: true, lifecycleStatus: true },
        })
        if (!assignee || assignee.lifecycleStatus !== 'ACTIVE' || !isAdminUser(assignee))
          throw new AdminActionError('Choose an active administrator.', 400, 'INVALID_ASSIGNEE')
      }
      await tx.supportSession.update({
        where: { id: targetId },
        data: { assignedAgentId: assigneeId },
      })
      return { sessionId: targetId, assigneeId }
    }
    case 'LEAD_UPDATE': {
      await tx.lead.update({
        where: { normalizedDomain: targetId },
        data: {
          status: input.status as
            | 'NEW'
            | 'QUALIFIED'
            | 'CONTACTED'
            | 'CONVERTED'
            | 'DISQUALIFIED'
            | undefined,
          notes: input.notes as string | undefined,
        },
      })
      return { domain: targetId, state: 'SAVED' }
    }
    case 'WAITLIST_BATCH': {
      await tx.paidPlanWaitlistEntry.update({
        where: { id: targetId },
        data: { batch: input.batch as number },
      })
      return { entryId: targetId, batch: input.batch as number }
    }
    case 'WAITLIST_GRANT': {
      await tx.paidPlanWaitlistEntry.update({
        where: { id: targetId },
        data: { accessGrantedAt: now },
      })
      return { entryId: targetId, state: 'GRANTED', checkoutPolicyUnchanged: true }
    }
    case 'WAITLIST_INVITE': {
      const entry = await tx.paidPlanWaitlistEntry.findUniqueOrThrow({
        where: { id: targetId },
        include: { user: { select: { email: true } } },
      })
      if (entry.plan !== 'BUILDER' && entry.plan !== 'TEAM')
        throw new AdminActionError('Choose a paid-plan waitlist entry.', 400, 'INVALID_PLAN')
      const invite = await tx.waitlistInvite.create({
        data: {
          code: randomBytes(18).toString('base64url'),
          inviteeEmail: entry.email ?? entry.user.email,
          plan: entry.plan,
          batch: entry.batch,
          inviterUserId: operation.actorId,
        },
      })
      await tx.paidPlanWaitlistEntry.update({ where: { id: targetId }, data: { invitedAt: now } })
      return {
        entryId: targetId,
        joinUrl: `${SITE_URL}/waitlist/${entry.plan === 'TEAM' ? 'studio' : 'pro'}?code=${invite.code}`,
        emailSent: false,
        checkoutPolicyUnchanged: true,
      }
    }
    case 'SHOP_DISCONNECT': {
      await tx.shopifyAccountLink.deleteMany({ where: { shopId: targetId } })
      await tx.shopifyShop.update({
        where: { id: targetId },
        data: { projectId: null, linkedAt: null },
      })
      return { shopId: targetId, state: 'DISCONNECTED', installationPreserved: true }
    }
    case 'EVIDENCE_ACCESS': {
      const grant = await tx.adminEvidenceGrant.create({
        data: {
          operationId: operation.id,
          actorId: operation.actorId,
          sessionId: operation.actorSessionId,
          auditId: targetId,
          expiresAt: new Date(now.getTime() + 5 * 60_000),
        },
      })
      return { grantId: grant.id, auditId: targetId, expiresAt: grant.expiresAt.toISOString() }
    }
    case 'DATA_EXPORT':
      return {
        downloadUrl: `/api/admin/exports/${operation.id}`,
        asOf: input.asOf as string,
        state: 'AUTHORIZED',
      }
    default:
      throw new AdminActionError('Unsupported database action.', 400, 'UNSUPPORTED_ACTION')
  }
}
