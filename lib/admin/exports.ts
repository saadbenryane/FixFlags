import { escapeCsvCell as csvCell } from '@/lib/security/csv'
import { prisma } from '@/lib/db'
import type { AdminActor } from '@/lib/auth/require-admin'
import { adminRead } from './workspace-queries'
import { appendAdminActivity } from './activity'
import { AdminActionError } from './errors'
import { redactAdminContent } from './security'
export { escapeCsvCell as csvCell } from '@/lib/security/csv'
export async function authorizeAdminExport(actor: AdminActor, id: string) {
  return adminRead(actor, async (db) => {
    const operation = await db.adminOperation.findFirst({
      where: {
        id,
        actorId: actor.id,
        actorSessionId: actor.sessionId,
        action: 'DATA_EXPORT',
        status: 'SUCCEEDED',
        intentExpiresAt: { gt: new Date() },
      },
    })
    if (!operation)
      throw new AdminActionError(
        'Export authorization expired or belongs to another session.',
        403,
        'EXPORT_ACCESS_EXPIRED',
      )
    await appendAdminActivity(db, operation, 'EXPORT_DOWNLOADED', {
      format: operation.targetId === 'waitlist' ? 'csv' : 'markdown',
    })
    return operation
  })
}
export async function* adminExportChunks(
  operation: Awaited<ReturnType<typeof authorizeAdminExport>>,
) {
  const input = operation.input as { asOf: string; days: number; plan?: 'BUILDER' | 'TEAM' },
    asOf = new Date(input.asOf),
    since = new Date(asOf.getTime() - input.days * 86400000)
  if (operation.targetId === 'waitlist') {
    yield [
      'member_id',
      'plan',
      'joined_at_utc',
      'batch',
      'access_granted_at_utc',
      'invited_at_utc',
      'converted_at_utc',
    ].join(',') + '\n'
    let cursor: string | undefined
    while (true) {
      const rows = await prisma.paidPlanWaitlistEntry.findMany({
        where: { joinedAt: { lte: asOf }, ...(input.plan ? { plan: input.plan } : {}) },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          plan: true,
          joinedAt: true,
          batch: true,
          accessGrantedAt: true,
          invitedAt: true,
          convertedAt: true,
        },
      })
      for (const row of rows)
        yield [
          row.id,
          row.plan,
          row.joinedAt.toISOString(),
          row.batch,
          row.accessGrantedAt?.toISOString(),
          row.invitedAt?.toISOString(),
          row.convertedAt?.toISOString(),
        ]
          .map(csvCell)
          .join(',') + '\n'
      if (rows.length < 500) return
      cursor = rows.at(-1)!.id
    }
  }
  yield `# FixFlags feedback digest\n\nWindow: ${since.toISOString()} to ${asOf.toISOString()}. Identifiers and credential patterns are redacted.\n\n`
  let cursor: string | undefined
  while (true) {
    const rows = await prisma.supportMessage.findMany({
      where: { createdAt: { gte: since, lte: asOf }, role: { not: 'SYSTEM' } },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        sessionId: true,
        role: true,
        body: true,
        createdAt: true,
        sequence: true,
      },
    })
    for (const row of rows)
      yield `Conversation ${row.sessionId}, message ${row.sequence.toString()} (${row.createdAt.toISOString()}), ${row.role.toLowerCase()}:\n${redactAdminContent(row.body)}\n\n`
    if (rows.length < 500) break
    cursor = rows.at(-1)!.id
  }
  for (const kind of ['report', 'flag'] as const) {
    cursor = undefined
    while (true) {
      const args = {
        where: { createdAt: { gte: since, lte: asOf } },
        orderBy: { id: 'asc' as const },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, vote: true, comment: true, createdAt: true },
      }
      const rows: Array<{ id: string; vote: number; comment: string | null; createdAt: Date }> =
        kind === 'report'
          ? await prisma.auditFeedback.findMany(args)
          : await prisma.flagFeedback.findMany(args)
      for (const row of rows)
        yield `${kind} reaction ${row.id} (${row.createdAt.toISOString()}), vote ${row.vote}: ${redactAdminContent(row.comment ?? 'No written comment')}\n\n`
      if (rows.length < 500) break
      cursor = rows.at(-1)!.id
    }
  }
}
