import { createHash } from 'node:crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { FROM_EMAIL } from './from'
import { logger } from '@/lib/logger'
import { emailDeliveryState, type EmailDeliveryView } from './delivery-state'
import { watchEmailPayloadSchema } from './watch-payload'
import { uptimeEmailSchema } from './uptime-payload'
import { hasNotificationReceiptTag, notificationReceiptTags } from './notification-receipt'
import { currentWatchObservationSql, sameSiteWatchParentSql, watchNotificationSourceReadySql } from '@/lib/sites/application/scheduled-observation'
import { currentUptimeNotificationTargetSql } from '@/lib/uptime/monitor-target'
import { readUnprojectedEmailAcceptances } from './acceptance-sources'

const eventTypes = ['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced',
  'email.complained', 'email.failed', 'email.suppressed'] as const
export const emailProviderEventSchema = z.object({
  type: z.enum(eventTypes), created_at: z.string().datetime({ offset: true }),
  data: z.object({ email_id: z.string().uuid(), from: z.string().max(512), to: z.array(z.string().email()).min(1).max(20),
    created_at: z.unknown().optional(), tags: z.unknown().optional() }),
})
const providerDate = z.string().datetime({ offset: true })
export const EMAIL_DELIVERY_RETENTION_MS = 90 * 86400_000
const eventFields: Record<string, 'deliveredAt' | 'delayedAt' | 'bouncedAt' | 'complainedAt' | 'failedAt' | undefined> = {
  'email.delivered': 'deliveredAt', 'email.delivery_delayed': 'delayedAt', 'email.bounced': 'bouncedAt',
  'email.complained': 'complainedAt', 'email.failed': 'failedAt', 'email.suppressed': 'failedAt',
}
const address = (value: string) => (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase()
export const emailRecipientHash = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export async function notificationRecipientAllowed(email: string): Promise<boolean> {
  return !(await prisma.emailSuppression.findUnique({ where: { recipientHash: emailRecipientHash(email) }, select: { recipientHash: true } }))
}

type EmailAcceptance = {
  providerId: string; userId: string; email: string; channel: 'summary' | 'watch' | 'uptime' | 'onboarding'; sourceId: string; acceptedAt: Date;
  firstAttemptAt?: Date;
}

async function storeEmailAcceptance(input: EmailAcceptance, db: Pick<Prisma.TransactionClient, 'emailDelivery'>) {
  const { email, ...identity } = input, recipientHash = emailRecipientHash(email)
  const receipt = await db.emailDelivery.upsert({ where: { providerId: input.providerId }, update: {},
    create: { ...identity, firstAttemptAt: input.firstAttemptAt ?? input.acceptedAt, recipientHash } })
  if (receipt.userId !== input.userId || receipt.recipientHash !== recipientHash || receipt.channel !== input.channel || receipt.sourceId !== input.sourceId)
    throw new Error('Email provider receipt identity changed')
}

export async function recordEmailAcceptance(input: EmailAcceptance) {
  await storeEmailAcceptance(input, prisma)
  await reconcileEmailEvents(input.providerId)
}

type EmailAcceptanceSource = Pick<Parameters<typeof recordEmailAcceptance>[0], 'channel' | 'sourceId' | 'providerId'>

async function updateEmailAcceptanceSource(source: EmailAcceptanceSource,
  data: { deliveryProjectedAt: Date } | { nextAttemptAt: Date }) {
  const where = { id: source.sourceId, providerId: source.providerId, status: 'SENT' as const, deliveryProjectedAt: null }
  if (source.channel === 'summary') return prisma.notificationDigest.updateMany({ where, data })
  if (source.channel === 'uptime') return prisma.uptimeNotification.updateMany({ where, data })
  if (source.channel === 'onboarding') return prisma.emailLog.updateMany({ where, data })
  return prisma.audit.updateMany({ where: { id: source.sourceId, watchNotificationProviderId: source.providerId,
    watchNotificationStatus: 'SENT', watchDeliveryProjectedAt: null }, data: 'deliveryProjectedAt' in data
      ? { watchDeliveryProjectedAt: data.deliveryProjectedAt } : { watchNotificationNextAttemptAt: data.nextAttemptAt } })
}

/** SENT receipts no longer enter the provider queue. Their existing retry clock
 * can defer history recovery without spending a provider attempt or changing
 * acceptance, recipient or payload facts. Completed projections cannot defer. */
export async function deferEmailAcceptanceProjection(source: EmailAcceptanceSource, nextAttemptAt: Date) {
  await updateEmailAcceptanceSource(source, { nextAttemptAt })
}

/** Acceptance already belongs to its durable source receipt. A projection
 * failure must not rewrite that fact into a failed send; maintenance repairs it. */
export async function projectEmailAcceptance(input: Parameters<typeof recordEmailAcceptance>[0]): Promise<boolean> {
  try {
    await recordEmailAcceptance(input)
    await updateEmailAcceptanceSource(input, { deliveryProjectedAt: new Date() })
    return true
  }
  catch {
    logger.error('Email delivery projection needs reconciliation', { channel: input.channel, sourceId: input.sourceId })
    return false
  }
}

type ReceiptTags = z.infer<typeof notificationReceiptTags>
type ProviderConfirmation = { providerId: string; recipientHash: string; acceptedAt: Date }

function frozenAttemptAt(payload: { from: string; to: string; firstAttemptAt?: string; tags: Array<{ name: string; value: string }> },
  tags: ReceiptTags, confirmation: ProviderConfirmation) {
  if (!payload.firstAttemptAt || emailRecipientHash(payload.to) !== confirmation.recipientHash ||
    address(payload.from) !== address(FROM_EMAIL) || !hasNotificationReceiptTag(payload.tags, tags)) return null
  const firstAttemptAt = new Date(payload.firstAttemptAt)
  return confirmation.acceptedAt.getTime() >= firstAttemptAt.getTime() - 60_000 ? firstAttemptAt : null
}

async function settleWatchAcceptance(tx: Prisma.TransactionClient, tags: Extract<ReceiptTags, { purpose: 'watch' }>,
  confirmation: ProviderConfirmation): Promise<EmailAcceptance | undefined> {
  const { providerId, acceptedAt } = confirmation
  const source = await tx.audit.findUnique({ where: { id: tags.audit_id }, select: {
    userId: true, projectId: true, watchNotificationPayload: true, watchNotificationStatus: true, watchNotificationProviderId: true,
  } })
  if (!source?.userId || !source.projectId || source.watchNotificationProviderId || !['SENDING', 'FAILED'].includes(source.watchNotificationStatus)) return
  const payload = watchEmailPayloadSchema.safeParse(source.watchNotificationPayload)
  if (!payload.success || payload.data.receiptOwnerId !== source.userId || payload.data.selection?.projectId !== source.projectId) return
  const firstAttemptAt = frozenAttemptAt(payload.data, tags, confirmation)
  if (!firstAttemptAt) return
  const recorded = await tx.audit.updateMany({ where: { id: tags.audit_id, userId: source.userId, projectId: source.projectId,
    watchNotificationStatus: { in: ['SENDING', 'FAILED'] }, watchNotificationAttempts: { gt: 0 }, watchNotificationProviderId: null,
    watchNotifiedAt: null, watchNotificationPayload: { equals: source.watchNotificationPayload as Prisma.InputJsonValue },
  }, data: { watchNotificationStatus: 'SENT', watchNotificationProviderId: providerId, watchNotifiedAt: acceptedAt,
    watchNotificationLastError: null, watchNotificationLeaseUntil: null, watchNotificationNextAttemptAt: null } })
  if (recorded.count) return { providerId, userId: source.userId, email: payload.data.to, channel: 'watch',
    sourceId: tags.audit_id, acceptedAt, firstAttemptAt }
}

async function settleUptimeAcceptance(tx: Prisma.TransactionClient, tags: Extract<ReceiptTags, { purpose: 'uptime' }>,
  confirmation: ProviderConfirmation): Promise<EmailAcceptance | undefined> {
  const { providerId, acceptedAt } = confirmation
  const unsettled = { id: tags.notification_id, status: { in: ['PENDING', 'SENDING', 'FAILED', 'SKIPPED'] },
    attempts: { gt: 0 }, providerId: null, sentAt: null }
  const source = await tx.uptimeNotification.findFirst({ where: unsettled, select: { kind: true, incidentId: true, deliveryPayload: true,
    incident: { select: { version: true, monitor: { select: { projectId: true } } } } } })
  if (!source) return
  const payload = uptimeEmailSchema.safeParse(source.deliveryPayload)
  if (!payload.success || payload.data.kind !== source.kind || payload.data.incidentId !== source.incidentId ||
    payload.data.targetVersion !== source.incident.version || payload.data.projectId !== source.incident.monitor.projectId) return
  const firstAttemptAt = frozenAttemptAt(payload.data, tags, confirmation)
  if (!firstAttemptAt || !await tx.user.findUnique({ where: { id: payload.data.ownerId }, select: { id: true } })) return
  // An accepted send remains part of its original incident after a target edit or recovery.
  const recorded = await tx.uptimeNotification.updateMany({ where: { ...unsettled, kind: source.kind, incidentId: source.incidentId,
    incident: { version: payload.data.targetVersion, monitor: { projectId: payload.data.projectId } },
    deliveryPayload: { equals: source.deliveryPayload as Prisma.InputJsonValue },
  }, data: { status: 'SENT', providerId, sentAt: acceptedAt, lastError: null, leaseUntil: null } })
  if (recorded.count) return { providerId, userId: payload.data.ownerId, email: payload.data.to, channel: 'uptime',
    sourceId: tags.notification_id, acceptedAt, firstAttemptAt }
}

/** A verified provider event settles only the exact saved send. */
async function recoverNotificationAcceptance(tags: ReceiptTags, eventId: string, confirmation: ProviderConfirmation, now: Date) {
  return prisma.$transaction(async tx => {
    if (!await tx.emailProviderEvent.findFirst({ where: { id: eventId, processedAt: null, discardedAt: null, expiresAt: { gt: now } },
      select: { id: true } })) return
    const acceptance = tags.purpose === 'watch' ? await settleWatchAcceptance(tx, tags, confirmation)
      : await settleUptimeAcceptance(tx, tags, confirmation)
    if (!acceptance) return
    await storeEmailAcceptance(acceptance, tx)
    return acceptance
  })
}

export async function acceptEmailProviderEvent(id: string, payload: string, now = new Date()) {
  const parsed = emailProviderEventSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) return
  const event = parsed.data, occurredAt = new Date(event.created_at)
  const age = now.getTime() - occurredAt.getTime()
  if (address(event.data.from) !== address(FROM_EMAIL) || age < -300_000 || age >= EMAIL_DELIVERY_RETENTION_MS) return
  const recipientHashes = event.data.to.map(emailRecipientHash).sort()
  const tags = notificationReceiptTags.safeParse(event.data.tags)
  const created = providerDate.safeParse(event.data.created_at)
  const acceptedAt = created.success ? new Date(created.data) : null
  const correlation = tags.success && acceptedAt && acceptedAt <= occurredAt && recipientHashes.length === 1 &&
    (event.type === 'email.sent' || event.type === 'email.delivered') ? { tags: tags.data, acceptedAt } : null
  const bodyHash = createHash('sha256').update(JSON.stringify({ providerId: event.data.email_id,
    type: event.type, at: occurredAt.toISOString(), from: address(event.data.from), recipientHashes, ...(correlation ? { correlation } : {}) })).digest('hex')
  const stored = await prisma.emailProviderEvent.upsert({ where: { id }, update: {}, create: { id,
    providerId: event.data.email_id, type: event.type, occurredAt, bodyHash,
    recipientHashes, expiresAt: new Date(now.getTime() + 86400_000) } })
  if (stored.bodyHash !== bodyHash) throw new Error('Provider event identity changed')
  if (stored.discardedAt || stored.expiresAt <= now) return
  const recovered = correlation && !stored.processedAt && now.getTime() - correlation.acceptedAt.getTime() < EMAIL_DELIVERY_RETENTION_MS
    ? await recoverNotificationAcceptance(correlation.tags, id, { providerId: event.data.email_id,
      recipientHash: recipientHashes[0], acceptedAt: correlation.acceptedAt }, now) : null
  await reconcileEmailEvents(event.data.email_id, now)
  if (recovered) await updateEmailAcceptanceSource(recovered, { deliveryProjectedAt: now })
}

async function applyEvent(tx: Prisma.TransactionClient, event: { id: string; type: string; occurredAt: Date },
  receipt: { providerId: string; recipientHash: string }, now: Date) {
  const claimed = await tx.emailProviderEvent.updateMany({
    where: { id: event.id, processedAt: null, discardedAt: null, expiresAt: { gt: now } },
    data: { processedAt: now, expiresAt: new Date(now.getTime() + EMAIL_DELIVERY_RETENTION_MS) },
  })
  if (!claimed.count) return
  const field = eventFields[event.type]
  if (field) await tx.emailDelivery.updateMany({ where: { providerId: receipt.providerId,
    OR: [{ [field]: null }, { [field]: { lt: event.occurredAt } }] }, data: { [field]: event.occurredAt } })
  if (['email.bounced', 'email.complained', 'email.suppressed'].includes(event.type)) {
    const reason = event.type === 'email.bounced' ? 'BOUNCED' : event.type === 'email.complained' ? 'COMPLAINED' : 'SUPPRESSED'
    await tx.emailSuppression.upsert({ where: { recipientHash: receipt.recipientHash },
      create: { recipientHash: receipt.recipientHash, reason, occurredAt: event.occurredAt, providerId: receipt.providerId }, update: {} })
    await tx.emailSuppression.updateMany({ where: { recipientHash: receipt.recipientHash, occurredAt: { lt: event.occurredAt } },
      data: { reason, occurredAt: event.occurredAt, providerId: receipt.providerId } })
  }
}

/** Correlation cannot revive an event after its stored reconciliation window. */
export async function reconcileEmailEvents(providerId: string, now = new Date()) {
  const since = new Date(now.getTime() - EMAIL_DELIVERY_RETENTION_MS)
  await prisma.$transaction(async tx => {
    // Hold the accepted receipt through correlation. A busy receipt can be
    // retried by maintenance without delaying the webhook or another message.
    const [receipt] = await tx.$queryRaw<Array<{ providerId: string; recipientHash: string; firstAttemptAt: Date }>>`
      SELECT "providerId", "recipientHash", "firstAttemptAt" FROM email_deliveries
      WHERE "providerId" = ${providerId} AND "acceptedAt" >= ${since} FOR UPDATE SKIP LOCKED`
    if (!receipt) return
    const events = await tx.emailProviderEvent.findMany({ where: { providerId, processedAt: null, discardedAt: null, expiresAt: { gt: now },
      recipientHashes: { has: receipt.recipientHash }, occurredAt: { gte: new Date(receipt.firstAttemptAt.getTime() - 60_000) } },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 50 })
    for (const event of events) await applyEvent(tx, event, receipt, now)
  })
}

export async function loadEmailDeliveryHistory(userId: string): Promise<EmailDeliveryView[]> {
  const now = new Date(), since = new Date(now.getTime() - EMAIL_DELIVERY_RETENTION_MS)
  type Unsettled = { id: string; channel: 'watch' | 'uptime'; at: Date; status: string; attempts: number; ceiling: number; leaseUntil: Date | null }
  // Read acceptance and outstanding attempts from the same database snapshot.
  // An arriving webhook can move an alert between these ledgers during a read.
  const [receipts, savedAcceptances, summaries, monitoring] = await prisma.$transaction([
    prisma.emailDelivery.findMany({ where: { userId, acceptedAt: { gte: since } }, orderBy: [{ acceptedAt: 'desc' }, { providerId: 'desc' }], take: 5 }),
    readUnprojectedEmailAcceptances(prisma, since, 5, { userId }),
    prisma.notificationDigest.findMany({ where: { userId, createdAt: { gte: since }, status: { in: ['PENDING', 'SENDING', 'FAILED'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 3, select: { id: true, status: true, attempts: true, leaseUntil: true, createdAt: true } }),
    prisma.$queryRaw<Unsettled[]>`
      (SELECT a.id, 'watch' AS channel, a."completedAt" AS at, a."watchNotificationStatus"::text AS status,
        a."watchNotificationAttempts" AS attempts, a."watchNotificationAttemptCeiling" AS ceiling, a."watchNotificationLeaseUntil" AS "leaseUntil"
      FROM audits a JOIN projects p ON p.id = a."projectId" AND p."userId" = a."userId"
      WHERE p."userId" = ${userId} AND p."deletedAt" IS NULL AND a."completedAt" >= ${since}
        AND a."watchNotificationStatus" IN ('PENDING', 'SENDING', 'FAILED') AND a."watchNotificationAttempts" > 0
        AND COALESCE(a."watchNotificationPayload"->>'receiptOwnerId', a."userId") = ${userId}
        AND ${watchNotificationSourceReadySql} AND ${currentWatchObservationSql} AND ${sameSiteWatchParentSql}
      ORDER BY a."completedAt" DESC, a.id DESC LIMIT 5)
      UNION ALL
      (SELECT n.id, 'uptime', n."createdAt", n.status, n.attempts, n."maxAttempts", n."leaseUntil"
      FROM projects p JOIN uptime_monitors m ON m."projectId" = p.id
      JOIN uptime_incidents i ON i."monitorId" = m.id JOIN uptime_notifications n ON n."incidentId" = i.id
      WHERE p."userId" = ${userId} AND p."deletedAt" IS NULL AND n."createdAt" >= ${since}
        AND n.status IN ('PENDING', 'SENDING', 'FAILED') AND n.attempts > 0
        AND n."deliveryPayload"->>'ownerId' = ${userId} AND ${currentUptimeNotificationTargetSql}
      ORDER BY n."createdAt" DESC, n.id DESC LIMIT 5)`,
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  const history: EmailDeliveryView[] = receipts.map(receipt => ({ id: receipt.providerId, channel: receipt.channel,
    state: emailDeliveryState(receipt), at: receipt.acceptedAt.toISOString() })).map(receipt => ({ ...receipt,
      channel: z.enum(['summary', 'watch', 'uptime', 'onboarding']).parse(receipt.channel) }))
  history.push(...savedAcceptances.map(receipt => ({ id: receipt.providerId, channel: receipt.channel,
    state: 'accepted' as const, at: receipt.acceptedAt.toISOString() })))
  const unsettled = [...monitoring, ...summaries.map(receipt => ({ ...receipt, channel: 'summary' as const, at: receipt.createdAt, ceiling: 5 }))]
  history.push(...unsettled.map(receipt => ({ id: receipt.id, channel: receipt.channel,
    // A live final request is still sending. Exhaustion without acceptance is
    // uncertain, since a provider may accept before its response is lost.
    state: (receipt.channel === 'summary' || receipt.status !== 'PENDING') && receipt.attempts >= receipt.ceiling &&
      !(receipt.status === 'SENDING' && receipt.leaseUntil && receipt.leaseUntil > now)
      ? 'unconfirmed' as const : 'sending' as const, at: receipt.at.toISOString() })))
  return history.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0, 5)
}
