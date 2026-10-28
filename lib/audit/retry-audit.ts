import { prisma } from '@/lib/db'
import { createAndEnqueueAudit, ParentAuditError } from './create-audit'
import { canManageAudit, canRetryAnonymousAudit } from './access'
import { retryAdmittedRun } from '@/lib/sites/application/run-retry'

export type AuditRetryViewer = { userId: string | null; anonymousAuditIds: string[]; visitorKey: string; clientId?: string }

/** A user retry is a new linked admission. Never reopen a terminal execution,
 * remove its queue job, or let completed checkpoints certify another run. */
export async function retryAudit(auditId: string, viewer: AuditRetryViewer) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId },
    select: { id: true, status: true, url: true, userId: true, projectId: true, isPublic: true, auditMode: true } })
  if (!audit) throw new ParentAuditError('Audit not found', 404)
  if (!canManageAudit(audit, viewer.userId ? { id: viewer.userId } : null) &&
    !canRetryAnonymousAudit(audit, audit.id, viewer.anonymousAuditIds)) throw new ParentAuditError('You do not have access to this report', 403)
  if (!['FAILED', 'COMPLETED'].includes(audit.status)) throw new ParentAuditError('Can only retry a terminal execution', 409)
  if (audit.userId === null && !viewer.visitorKey) throw new ParentAuditError('Restore this Site’s browser identity before retrying.', 409)
  if (audit.projectId && audit.userId && audit.userId === viewer.userId) {
    const admitted = await retryAdmittedRun(audit.id, { kind: 'owner', userId: audit.userId })
    const current = admitted.auditId ? await prisma.audit.findUnique({ where: { id: admitted.auditId }, select: { status: true } }) : null
    if (!current) throw new ParentAuditError('The retry was admitted but its current state is unavailable.', 503)
    return { status: current.status, auditId: admitted.auditId, siteId: audit.projectId, runId: admitted.runId, reused: admitted.reused }
  }
  const admitted = await createAndEnqueueAudit({
    admission: { kind: 'retry', parentId: audit.id },
    url: audit.url,
    userId: audit.userId,
    visitorKey: viewer.visitorKey,
    clientId: viewer.clientId,
    auditMode: audit.auditMode,
    useProjectScanAccess: Boolean(audit.userId),
  })
  return { status: admitted.status, auditId: admitted.auditId, siteId: admitted.siteId, reused: admitted.reused }
}
