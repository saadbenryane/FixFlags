import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { FROM_EMAIL } from './from'
import { logger } from '@/lib/logger'
import { emailDeliveryState, type EmailDeliveryView } from './delivery-state'

const eventTypes = ['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced',
  'email.complained', 'email.failed', 'email.suppressed'] as const
export const emailProviderEventSchema = z.object({
  type: z.enum(eventTypes), created_at: z.string().datetime({ offset: true }),
  data: z.object({ email_id: z.string().uuid(), from: z.string().max(512), to: z.array(z.string().email()).min(1).max(20) }),
})
const retentionMs = 90 * 86400_000
const eventFields: Record<string, 'deliveredAt' | 'delayedAt' | 'bouncedAt' | 'complainedAt' | 'failedAt' | undefined> = {
  'email.delivered': 'deliveredAt', 'email.delivery_delayed': 'delayedAt', 'email.bounced': 'bouncedAt',
  'email.complained': 'complainedAt', 'email.failed': 'failedAt', 'email.suppressed': 'failedAt',
}
const address = (value: string) => (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase()
export const emailRecipientHash = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export async function notificationRecipientAllowed(email: string): Promise<boolean> {
  return !(await prisma.emailSuppression.findUnique({ where: { recipientHash: emailRecipientHash(email) }, select: { recipientHash: true } }))
}

export async function recordEmailAcceptance(input: {
  providerId: string; userId: string; email: string; channel: 'summary' | 'watch' | 'uptime' | 'onboarding'; sourceId: string; acceptedAt: Date;
  firstAttemptAt?: Date;
}) {
  const { email, ...identity } = input, recipientHash = emailRecipientHash(email)
  const receipt = await prisma.emailDelivery.upsert({ where: { providerId: input.providerId }, update: {},
    create: { ...identity, firstAttemptAt: input.firstAttemptAt ?? input.acceptedAt, recipientHash } })
  if (receipt.userId !== input.userId || receipt.recipientHash !== recipientHash || receipt.channel !== input.channel || receipt.sourceId !== input.sourceId)
    throw new Error('Email provider receipt identity changed')
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

export async function acceptEmailProviderEvent(id: string, payload: string, now = new Date()) {
  const parsed = emailProviderEventSchema.safeParse(JSON.parse(payload))
  if (!parsed.success) return
  const event = parsed.data, occurredAt = new Date(event.created_at)
  if (address(event.data.from) !== address(FROM_EMAIL) || occurredAt.getTime() > now.getTime() + 300_000) return
  const recipientHashes = event.data.to.map(emailRecipientHash).sort()
  const bodyHash = createHash('sha256').update(JSON.stringify({ providerId: event.data.email_id,
    type: event.type, at: occurredAt.toISOString(), from: address(event.data.from), recipientHashes })).digest('hex')
  const stored = await prisma.emailProviderEvent.upsert({ where: { id }, update: {}, create: { id,
    providerId: event.data.email_id, type: event.type, occurredAt, bodyHash,
    recipientHashes, expiresAt: new Date(now.getTime() + 86400_000) } })
  if (stored.bodyHash !== bodyHash) throw new Error('Provider event identity changed')
  await reconcileEmailEvents(event.data.email_id, now)
}

async function applyEvent(tx: Prisma.TransactionClient, event: { id: string; type: string; occurredAt: Date },
  receipt: { providerId: string; recipientHash: string }, now: Date) {
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
  await tx.emailProviderEvent.update({ where: { id: event.id }, data: { processedAt: now, expiresAt: new Date(now.getTime() + retentionMs) } })
}

/** Correlation cannot revive an event after its stored reconciliation window. */
export async function reconcileEmailEvents(providerId: string, now = new Date()) {
  await prisma.$transaction(async tx => {
    const receipt = await tx.emailDelivery.findUnique({ where: { providerId } })
    if (!receipt) return
    const events = await tx.emailProviderEvent.findMany({ where: { providerId, processedAt: null, expiresAt: { gt: now },
      recipientHashes: { has: receipt.recipientHash }, occurredAt: { gte: new Date(receipt.firstAttemptAt.getTime() - 60_000) } },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 50 })
    for (const event of events) await applyEvent(tx, event, receipt, now)
  })
}

export async function loadEmailDeliveryHistory(userId: string): Promise<EmailDeliveryView[]> {
  const now = new Date(), since = new Date(now.getTime() - retentionMs)
  const [receipts, summaries] = await Promise.all([
    prisma.emailDelivery.findMany({ where: { userId, acceptedAt: { gte: since } }, orderBy: { acceptedAt: 'desc' }, take: 5 }),
    prisma.notificationDigest.findMany({ where: { userId, createdAt: { gte: since }, status: { in: ['PENDING', 'SENDING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, status: true, attempts: true, leaseUntil: true, createdAt: true } }),
  ])
  const history: EmailDeliveryView[] = receipts.map(receipt => ({ id: receipt.providerId, channel: receipt.channel,
    state: emailDeliveryState(receipt), at: receipt.acceptedAt.toISOString() })).map(receipt => ({ ...receipt,
      channel: z.enum(['summary', 'watch', 'uptime', 'onboarding']).parse(receipt.channel) }))
  history.push(...summaries.map(receipt => ({ id: receipt.id, channel: 'summary' as const,
    // A live final request is still sending. Exhaustion without acceptance is
    // uncertain, since a provider may accept before its response is lost.
    state: receipt.attempts >= 5 && !(receipt.status === 'SENDING' && receipt.leaseUntil && receipt.leaseUntil > now)
      ? 'unconfirmed' as const : 'sending' as const, at: receipt.createdAt.toISOString() })))
  return history.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
}
