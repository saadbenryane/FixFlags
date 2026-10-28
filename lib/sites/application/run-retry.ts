import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { canonicalIntent, readExecutionSpec, readVerificationTarget, type ExecutionSpec } from '../domain/execution-spec'
import { canonicalExecutionOutcomes } from './execution-spec'
import { requestSiteRun } from './run-requests'
import type { AdminDomainActor } from '@/lib/admin/domain-actor'
import { SiteRunRefusal } from './run-refusal'

export function admittedResponsibilityHash(spec: ExecutionSpec) {
  return createHash('sha256').update(canonicalIntent({ ...spec, outcomes: canonicalExecutionOutcomes(spec.outcomes),
    engine: undefined, scanAccess: undefined, reviewDepth: undefined, monitoringPages: undefined, monitoringEntryPages: undefined, monitoringBehaviors: undefined, verificationScopes: undefined, consoleObservationMs: undefined, consoleObservationScopes: undefined })).digest('hex')
}

type RetryActor = AdminDomainActor | { kind: 'owner'; userId: string }

/** All owned retry callers reproduce the admitted responsibility through normal
 * admission, including current authorization and configuration checks. */
export async function retryAdmittedRun(auditId: string, actor: RetryActor) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: {
    id: true, userId: true, projectId: true, status: true, url: true, executionSpec: true, triageAt: true, failureCode: true,
  } })
  if (actor.kind === 'owner' && audit?.userId !== actor.userId)
    throw new SiteRunRefusal('You do not have access to this report', 403)
  const degraded = actor.kind === 'owner' && audit?.status === 'COMPLETED' && !audit.triageAt && Boolean(audit.failureCode)
  if (!audit || audit.status !== 'FAILED' && !degraded || !audit.userId || !audit.projectId)
    throw new SiteRunRefusal('This check has no reproducible admitted scope.', 409, 'RETRY_SCOPE_UNAVAILABLE')
  const previous = await prisma.runRequest.findFirst({ where: { auditId, projectId: audit.projectId },
    orderBy: { requestedAt: 'desc' }, include: { selections: { select: { outcomeId: true } } } })
  const spec = readExecutionSpec(previous ? previous.executionSpec : audit.executionSpec)
  const operator = actor.kind === 'admin' ? actor : undefined
  const idempotencyKey = operator ? `admin-retry:${operator.operationId}` : `owner-retry:${audit.id}`
  // Claimed historical analyses may predate RunRequest. Their known original
  // URL supports a fresh broad check, not invented targeted responsibilities.
  if (!previous && !audit.executionSpec && actor.kind === 'owner')
    return requestSiteRun({ projectId: audit.projectId, userId: audit.userId, source: 'WEB', scope: 'SITE',
      outcomeIds: [], url: audit.url, idempotencyKey, context: { previousAuditId: audit.id } })
  if (!spec || actor.kind === 'admin' && !previous)
    throw new SiteRunRefusal('This check has no reproducible admitted scope.', 409, 'RETRY_SCOPE_UNAVAILABLE')
  const target = readVerificationTarget(previous?.verificationTarget ?? spec.verificationTarget)
  return requestSiteRun({ projectId: audit.projectId, userId: audit.userId, source: operator ? 'INTERNAL' : 'WEB', operator,
    outcomeIds: spec.scope === 'SITE' || spec.scope === 'CATEGORY' || spec.scope === 'ACCOUNT_CHECKS' || spec.scope === 'FIXTURE_SETUP' ? [] : spec.outcomes.map(value => value.id),
    scope: spec.scope === 'DIAGNOSTIC' ? 'OUTCOMES' : spec.scope,
    ...(spec.scope === 'CATEGORY' || spec.scope === 'FIXTURE_SETUP' ? {} : { url: spec.targetUrl }),
    ...(spec.category ? { categoryArea: spec.category.area } : {}), ...(spec.fixtureSetup ? { fixtureId: spec.fixtureSetup.id } : {}),
    ...(spec.accountChecks ? { accountMode: spec.accountChecks.mode } : {}),
    ...(target ? { verificationTarget: target, verificationAttemptId: target.attemptId, parentAuditId: target.parentAuditId } : {}),
    environment: spec.environment, idempotencyKey,
    expectedResponsibilityHash: admittedResponsibilityHash(spec), context: {
      previousAuditId: audit.id, ...(previous ? { previousRunId: previous.id } : {}),
      ...(operator ? { adminOperationId: operator.operationId } : {}),
    } })
}
