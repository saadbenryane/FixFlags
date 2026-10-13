import type { Prisma, SupportMessageRole } from '@prisma/client'
import { SupportError } from './errors'

export async function appendSupportMessage(tx: Prisma.TransactionClient, input: {
  sessionId: string; role: SupportMessageRole; body: string; senderId?: string; requestKey?: string;
}) {
  await tx.$queryRaw`SELECT "id" FROM "support_sessions" WHERE "id" = ${input.sessionId} FOR UPDATE`
  if (input.requestKey && input.senderId) {
    const prior = await tx.supportMessage.findUnique({ where: { sessionId_senderId_requestKey: {
      sessionId: input.sessionId, senderId: input.senderId, requestKey: input.requestKey,
    } } })
    if (prior) {
      if (prior.body !== input.body || prior.role !== input.role) throw new SupportError('This request belongs to another message.', 'MESSAGE_KEY_CONFLICT', 409)
      return prior
    }
  }
  const session = await tx.supportSession.findUnique({ where: { id: input.sessionId }, select: { id: true, status: true } })
  if (!session) throw new SupportError('Session not found', 'SESSION_NOT_FOUND', 404)
  if (session.status === 'CLOSED' && input.role !== 'SYSTEM') throw new SupportError('Session is closed', 'SESSION_CLOSED', 409)
  const sequenced = await tx.supportSession.update({ where: { id: input.sessionId }, data: { nextMessageSequence: { increment: 1 } }, select: { nextMessageSequence: true } })
  return tx.supportMessage.create({ data: { ...input, sequence: sequenced.nextMessageSequence } })
}
