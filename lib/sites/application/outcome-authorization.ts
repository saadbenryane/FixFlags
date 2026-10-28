import { Prisma } from '@prisma/client'
import type { SiteRecord } from '../types'

/** Permission commands take the same parent-first locks as worker publication. */
export async function lockOutcomeAuthority(tx: Prisma.TransactionClient, site: SiteRecord) {
  if (site.projectId) {
    if (!site.userId) return false
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${site.userId} FOR SHARE`
    const projects = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM projects WHERE id = ${site.projectId} AND "userId" = ${site.userId}
        AND url = ${site.url} AND "deletedAt" IS NULL FOR UPDATE
    `
    if (projects.length !== 1) return false
    await tx.$queryRaw`
      SELECT id FROM audits WHERE "projectId" = ${site.projectId}
        AND status NOT IN ('COMPLETED', 'FAILED') ORDER BY id FOR UPDATE
    `
    return true
  }
  if (!site.provisionalSiteId) return false
  const sites = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM provisional_sites WHERE id = ${site.provisionalSiteId} FOR UPDATE
  `
  if (sites.length !== 1) return false
  if (site.primaryAuditId) await tx.$queryRaw`SELECT id FROM audits WHERE id = ${site.primaryAuditId} FOR UPDATE`
  return true
}

/** Invalidate ownership before permission changes commit. The normal engine
 * settles dependent work, and its ownership watcher releases live resources. */
export async function fenceOutcomeBindingTasks(tx: Prisma.TransactionClient, site: SiteRecord, outcomeId: string,
  reason: 'OUTCOME_AUTHORIZATION_CHANGED' | 'BINDING_CHANGED') {
  const active = ['WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'] as const
  const tasks = await tx.auditVerifierExecution.findMany({ where: {
    audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' },
    workKind: 'bindings', workState: { in: [...active] }, workInput: { path: ['outcomeId'], equals: outcomeId },
  }, select: { id: true, auditId: true, workState: true, workGeneration: true } })
  for (const task of tasks) {
    const changed = await tx.auditVerifierExecution.updateMany({ where: { id: task.id, workState: { in: [...active] } },
      data: { workState: 'BLOCKED', status: 'FAILED', workToken: null, workLeaseUntil: null,
        workRetryAt: null, workDispatchLeaseUntil: null, workErrorCode: reason } })
    if (!changed.count) continue
    await tx.auditPipelineEvent.create({ data: { auditId: task.auditId, executionId: task.id, traceId: task.auditId,
      attempt: task.workGeneration, stage: 'checking', event: 'binding_authority_revoked', status: 'partial',
      detail: { version: 1, outcomeId, reason, previousWorkState: task.workState } } })
  }
}
