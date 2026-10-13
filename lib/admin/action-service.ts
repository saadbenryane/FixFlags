import { randomUUID } from 'node:crypto'
import { Prisma, type AdminOperation } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AdminActor } from '@/lib/auth/require-admin'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'
import { appendAdminActivity } from './activity'
import {
  adminExecuteRequestSchema,
  adminIntentSchema,
  adminPreviewRequestSchema,
  type AdminActionPreview,
  type AdminOperationReceipt,
} from './contracts'
import {
  actionIsDestructive,
  actionNeedsRecentAuthentication,
  resolveAdminTarget,
  validateAdminActionInput,
} from './targets'
import {
  ADMIN_INTENT_TTL_MS,
  assertAdminActor,
  readAdminIntent,
  redactAdminText,
  requireRecentAdminAuthentication,
  revisionHash,
  signAdminIntent,
} from './security'
import { AdminActionError } from './errors'
import { previewAdminBillingAction } from './billing-actions'

const targetTables: Record<string, { table: string; column: string }> = {
  OPERATION: { table: 'admin_operations', column: 'id' },
  USER: { table: 'users', column: 'id' },
  SITE: { table: 'projects', column: 'id' },
  AUDIT: { table: 'audits', column: 'id' },
  SUPPORT: { table: 'support_sessions', column: 'id' },
  SHOP: { table: 'shopify_shops', column: 'id' },
  LEAD: { table: 'leads', column: 'normalizedDomain' },
  WAITLIST: { table: 'paid_plan_waitlist_entries', column: 'id' },
  ENTITLEMENT: { table: 'entitlement_grants', column: 'id' },
  PAYMENT: { table: 'billing_ledger_entries', column: 'id' },
  UPTIME_NOTIFICATION: { table: 'uptime_notifications', column: 'id' },
}

export async function lockAdminTarget(tx: Prisma.TransactionClient, type: string, id: string) {
  const target = targetTables[type]
  if (target)
    await tx.$queryRaw(
      Prisma.sql`SELECT ${Prisma.raw(`"${target.column}"`)} FROM ${Prisma.raw(`"${target.table}"`)} WHERE ${Prisma.raw(`"${target.column}"`)} = ${id} FOR UPDATE`,
    )
}

function effectsFor(action: string, label: string, input: Record<string, unknown>) {
  if (action === 'USER_REMOVE')
    return [
      'Block new account access and settle active work.',
      'Cancel billing and reconcile external test-account cleanup.',
      'Purge customer data only after required cleanup is confirmed.',
    ]
  if (action === 'USER_SUSPEND')
    return [
      'Block sign-in and new work for this customer.',
      'Revoke sessions and developer keys, and fence unfinished execution.',
      'Keep customer data and saved monitoring preferences.',
    ]
  if (action === 'SITE_REMOVE')
    return [
      'Remove this Site from the customer workspace and stop its monitoring.',
      'Preserve historical evidence and any acknowledged external-account obligations.',
    ]
  if (action === 'BILLING_REFUND')
    return [
      `Request a refund of ${label}.`,
      'A refund does not cancel the subscription.',
      'Completion requires the provider to confirm the refund outcome.',
    ]
  if (action === 'BILLING_CANCEL_SUBSCRIPTION')
    return [
      input.timing === 'immediate'
        ? 'End the subscription immediately.'
        : 'End the subscription at its current billing boundary.',
      'No automatic refund will be requested.',
    ]
  if (action === 'BILLING_CHANGE_SUBSCRIPTION')
    return [
      input.timing === 'immediate'
        ? 'Change the existing subscription now, with provider-calculated proration.'
        : 'Schedule the subscription change at the next billing boundary.',
      'Update access through the shared billing reconciliation path.',
    ]
  if (action === 'ENTITLEMENT_GRANT')
    return [
      `Grant the selected access until ${input.expiresAt}.`,
      'Preserve stored subscription, payments, and execution-safety gates.',
    ]
  if (action === 'EVIDENCE_ACCESS')
    return [
      'Allow this session to inspect this check’s private evidence for five minutes.',
      'Keep customer routes owner-only and record this investigation.',
    ]
  if (action === 'SUPPORT_REPLY')
    return [
      'Send this reply to the selected conversation.',
      'Record one message for this action, including if the request is repeated.',
    ]
  if (action === 'DATA_EXPORT')
    return [
      'Export the complete selected reporting window.',
      'Omit structured private identifiers and record this export.',
    ]
  return [
    `${ADMIN_COPY.actions[action as keyof typeof ADMIN_COPY.actions]} for ${label}.`,
    'Preserve previous evidence and record the actual outcome.',
  ]
}

export async function previewAdminAction(
  actor: AdminActor,
  raw: unknown,
): Promise<AdminActionPreview> {
  const parsed = adminPreviewRequestSchema.safeParse(raw)
  if (!parsed.success)
    throw new AdminActionError(
      parsed.error.issues[0]?.message ?? 'Invalid action.',
      400,
      'INVALID_INPUT',
    )
  const request = parsed.data
  request.input = validateAdminActionInput(request.action, request.input)
  if (request.action === 'BILLING_CHANGE_SUBSCRIPTION' && request.input.timing === 'immediate')
    request.input.prorationDate = Math.floor(Date.now() / 1000)
  if (request.action === 'DATA_EXPORT') request.input.asOf = new Date().toISOString()
  const target = await prisma.$transaction(async (tx) => {
    await assertAdminActor(tx, actor)
    return resolveAdminTarget(request, tx)
  })
  const expiresAt = Date.now() + ADMIN_INTENT_TTL_MS
  const billing = request.action.startsWith('BILLING_')
    ? await previewAdminBillingAction(request)
    : null
  const intent = signAdminIntent({
    ...request,
    version: 1,
    actorId: actor.id,
    sessionId: actor.sessionId,
    revision: target.revision,
    providerRevision: billing?.revision,
    ownerId: target.ownerId,
    targetType: target.targetType,
    expiresAt,
  })
  return {
    action: request.action,
    title: target.title,
    targetLabel: target.label,
    effects: billing?.effects ?? effectsFor(request.action, target.label, request.input),
    recentAuthenticationRequired: actionNeedsRecentAuthentication(request.action),
    destructive: actionIsDestructive(request.action),
    intent,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export function adminOperationReceipt(operation: AdminOperation): AdminOperationReceipt {
  return {
    id: operation.id,
    action: operation.action,
    status: operation.status,
    result: operation.result,
    errorCode: operation.errorCode,
    errorMessage: operation.errorMessage,
    createdAt: operation.createdAt.toISOString(),
    completedAt: operation.completedAt?.toISOString() ?? null,
  }
}

export function adminOperationActor(operation: AdminOperation): AdminActor {
  return {
    id: operation.actorId,
    sessionId: operation.actorSessionId,
    authenticatedAt: operation.actorAuthenticatedAt,
    role: 'admin',
    email: '',
  }
}

export function decodedAdminInput(operation: AdminOperation): Record<string, unknown> {
  const input = operation.input as Record<string, unknown>
  if (operation.action === 'SUPPORT_REPLY') {
    if (typeof input.encryptedBody !== 'string')
      throw new AdminActionError('Reply admission is invalid.', 409, 'INVALID_ADMISSION')
    return { body: decryptSecret(input.encryptedBody) }
  }
  return input
}

export async function admitAdminAction(
  actor: AdminActor,
  raw: unknown,
): Promise<AdminOperationReceipt> {
  const parsed = adminExecuteRequestSchema.safeParse(raw)
  if (!parsed.success)
    throw new AdminActionError('Invalid action confirmation.', 400, 'INVALID_INPUT')
  const decoded = adminIntentSchema.safeParse(readAdminIntent(parsed.data.intent))
  if (!decoded.success)
    throw new AdminActionError('Invalid action confirmation.', 400, 'INVALID_INTENT')
  const intent = decoded.data
  if (intent.actorId !== actor.id || intent.sessionId !== actor.sessionId)
    throw new AdminActionError(
      'This confirmation belongs to another session.',
      403,
      'INTENT_SESSION_MISMATCH',
    )
  const requestHash = revisionHash(intent)
  const prior = await prisma.adminOperation.findUnique({
    where: {
      actorId_idempotencyKey: { actorId: actor.id, idempotencyKey: parsed.data.idempotencyKey },
    },
  })
  if (prior) {
    if (prior.requestHash !== requestHash)
      throw new AdminActionError(
        'This request key already belongs to another action.',
        409,
        'IDEMPOTENCY_CONFLICT',
      )
    return adminOperationReceipt(prior)
  }
  if (Date.now() >= intent.expiresAt)
    throw new AdminActionError(
      'This confirmation expired. Review the action again.',
      409,
      'INTENT_EXPIRED',
    )
  if (actionNeedsRecentAuthentication(intent.action)) requireRecentAdminAuthentication(actor)
  const input = validateAdminActionInput(intent.action, intent.input)
  let operation: AdminOperation
  try {
    operation = await prisma.$transaction(async (tx) => {
      await assertAdminActor(tx, actor)
      await lockAdminTarget(tx, intent.targetType, intent.targetId)
      const target = await resolveAdminTarget({ ...intent, input }, tx)
      if (target.revision !== intent.revision || target.ownerId !== intent.ownerId)
        throw new AdminActionError(
          'This record changed. Review its current state before confirming.',
          409,
          'TARGET_CHANGED',
        )
      const unsettled = await tx.adminOperation.findFirst({
        where: {
          targetType: target.targetType,
          targetId: intent.targetId,
          status: { in: ['QUEUED', 'RUNNING', 'INDETERMINATE'] },
        },
        select: { id: true },
      })
      const resumed =
        unsettled &&
        intent.action === 'USER_REMOVE' &&
        (await tx.adminOperation.findFirst({
          where: {
            id: unsettled.id,
            action: 'USER_REMOVE',
            status: 'INDETERMINATE',
            executionToken: null,
          },
        }))
      if (resumed) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: intent.targetId },
          select: { lifecycleStatus: true },
        })
        if (user.lifecycleStatus !== 'DELETING')
          throw new AdminActionError(
            'The earlier erasure has not reached its protected deletion phase.',
            409,
            'ERASURE_NOT_STARTED',
          )
        await tx.adminOperation.update({
          where: { id: resumed.id },
          data: { status: 'SUPERSEDED' },
        })
      }
      if (unsettled && !resumed)
        throw new AdminActionError(
          `Another action for this record is unsettled. Review Activity (${unsettled.id}).`,
          409,
          'TARGET_ACTION_UNSETTLED',
        )
      const created = await tx.adminOperation.create({
        data: {
          id: randomUUID(),
          action: intent.action,
          actorId: actor.id,
          actorSessionId: actor.sessionId,
          actorAuthenticatedAt: actor.authenticatedAt,
          targetType: target.targetType,
          targetId: intent.targetId,
          ownerId: target.ownerId,
          reason: redactAdminText(intent.reason),
          input: (intent.action === 'SUPPORT_REPLY'
            ? { encryptedBody: encryptSecret(input.body as string) }
            : input) as Prisma.InputJsonObject,
          expectedRevision: target.revision,
          providerRevision: intent.providerRevision,
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash,
          intentExpiresAt: new Date(intent.expiresAt),
        },
      })
      if (resumed)
        await appendAdminActivity(tx, resumed, 'ERASURE_CONTINUED', {
          continuationId: created.id,
          continuedBy: actor.id,
        })
      await appendAdminActivity(tx, created, 'ADMITTED', {
        reason: intent.reason,
        state: 'QUEUED',
        ...(resumed ? { previousOperationId: resumed.id } : {}),
      })
      return created
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
      throw error
    const raced = await prisma.adminOperation.findUnique({
      where: {
        actorId_idempotencyKey: { actorId: actor.id, idempotencyKey: parsed.data.idempotencyKey },
      },
    })
    if (!raced)
      throw new AdminActionError(
        'Another action for this target was admitted. Review Activity before continuing.',
        409,
        'TARGET_ACTION_UNSETTLED',
      )
    if (raced.requestHash !== requestHash)
      throw new AdminActionError(
        'This request key already belongs to another action.',
        409,
        'IDEMPOTENCY_CONFLICT',
      )
    operation = raced
  }
  const { dispatchAdminOperation } = await import('./runtime')
  await dispatchAdminOperation(operation.id)
  return adminOperationReceipt(
    await prisma.adminOperation.findUniqueOrThrow({ where: { id: operation.id } }),
  )
}

export async function loadAdminOperation(actor: AdminActor, id: string) {
  return prisma.$transaction(async (tx) => {
    await assertAdminActor(tx, actor)
    const operation = await tx.adminOperation.findUnique({ where: { id } })
    if (!operation) throw new AdminActionError('Action not found.', 404, 'NOT_FOUND')
    return adminOperationReceipt(operation)
  })
}
