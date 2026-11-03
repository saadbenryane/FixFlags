import { Prisma, type RunRequestSource } from '@prisma/client'
import { prisma } from '@/lib/db'
import { productTransaction } from '@/lib/billing/product-transaction'
import { requireActiveAccountForWrite } from '@/lib/auth/account-availability'
import { assertAdminDomainActor, type AdminDomainActor } from '@/lib/admin/domain-actor'
import { SiteRunRefusal } from './run-refusal'

type RequestKey = { projectId: string; source: RunRequestSource; idempotencyKey: string }
const replayInclude = { selections: { select: { outcomeId: true } },
  audit: { select: { projectId: true, status: true } } } satisfies Prisma.RunRequestInclude
type RecordedRun = Prisma.RunRequestGetPayload<{ include: typeof replayInclude }> & { keyRequestedByUserId: string | null }

/** Every original or joined key resolves through one durable routing record. */
export async function loadRunRequestByKey(key: RequestKey, db: Pick<Prisma.TransactionClient, 'runRequestKey'> = prisma): Promise<RecordedRun | null> {
  const { projectId, source, idempotencyKey } = key
  const binding = await db.runRequestKey.findUnique({ where: { projectId_source_idempotencyKey: { projectId, source, idempotencyKey } },
    include: { runRequest: { include: replayInclude } } })
  return binding ? { ...binding.runRequest, keyRequestedByUserId: binding.requestedByUserId } : null
}

/** Joining work adds only a replay key. Its request, execution, charging and
 * result retain their original owners and immutable admission snapshots. */
export async function retainSharedRunKey(input: RequestKey & { userId: string; runRequestId: string;
  operator?: AdminDomainActor; cleanup: boolean }, accepts: (run: RecordedRun, exactReplay: boolean) => boolean): Promise<RecordedRun> {
  const cleanup = Boolean(input.operator && input.cleanup)
  return productTransaction(async tx => {
    if (cleanup) {
      const owner = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`
      if (!owner.length) throw new SiteRunRefusal('This account is unavailable.', 403, 'ACCOUNT_UNAVAILABLE')
    } else await requireActiveAccountForWrite(tx, input.userId)
    const site = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM projects WHERE id = ${input.projectId} AND "userId" = ${input.userId}
        AND (${cleanup} OR "deletedAt" IS NULL) FOR UPDATE`
    if (!site.length) throw new SiteRunRefusal('Site not found', 404)
    if (input.operator) await assertAdminDomainActor(input.operator, input.userId, input.projectId, tx)
    const existing = await loadRunRequestByKey(input, tx)
    if (existing) {
      if (!accepts(existing, true)) throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
      return existing
    }
    const run = await tx.runRequest.findFirst({ where: { id: input.runRequestId, projectId: input.projectId }, include: replayInclude })
    const candidate = run ? { ...run, keyRequestedByUserId: input.operator?.actorId ?? input.userId } : null
    if (!candidate || !accepts(candidate, false))
      throw new SiteRunRefusal('Another Site run is already in progress', 409, 'SITE_RUN_IN_PROGRESS')
    const created = await tx.runRequestKey.createMany({ data: [{ projectId: input.projectId, source: input.source, idempotencyKey: input.idempotencyKey,
      runRequestId: candidate.id, requestedByUserId: candidate.keyRequestedByUserId }], skipDuplicates: true })
    if (created.count === 1) return candidate
    const winner = await loadRunRequestByKey(input, tx)
    if (!winner || !accepts(winner, true)) throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    return winner
  })
}
