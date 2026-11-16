import { prisma } from '@/lib/db'
import { recordSiteLifecycleEvent } from './site-events'

/** First authorized evidence read is distinct from analysis completion or a verified repair. */
export async function recordSiteEvidenceRead(input: { projectId: string; userId: string; flagId: string; auditId: string; area?: string; severity?: string }) {
  const audit = await prisma.audit.findFirst({ where: { id: input.auditId, projectId: input.projectId, userId: input.userId }, select: { createdAt: true } })
  if (!audit) return
  const elapsedMs = Date.now() - audit.createdAt.getTime()
  await Promise.all([
    recordSiteLifecycleEvent({ name: 'flag_opened', idempotencyKey: `flag_opened:${input.projectId}:${input.flagId}`,
      userId: input.userId, projectId: input.projectId, properties: { area: input.area, severity: input.severity } }),
    ...(Number.isFinite(elapsedMs) && elapsedMs >= 0 ? [recordSiteLifecycleEvent({ name: 'first_evidence_read',
      idempotencyKey: `first_evidence_read:${input.auditId}`, userId: input.userId, projectId: input.projectId,
      properties: { auditId: input.auditId, elapsedMs } })] : []),
  ])
}
