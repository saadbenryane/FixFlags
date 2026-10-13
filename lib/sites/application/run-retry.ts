import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { canonicalIntent, readExecutionSpec, readVerificationTarget, type ExecutionSpec } from '../domain/execution-spec'
import { canonicalExecutionOutcomes } from './execution-spec'
import { requestSiteRun } from './run-requests'
import type { AdminDomainActor } from '@/lib/admin/domain-actor'
import { SiteRunRefusal } from './run-refusal'

export function admittedResponsibilityHash(spec: ExecutionSpec) {
  return createHash('sha256').update(canonicalIntent({ ...spec, outcomes: canonicalExecutionOutcomes(spec.outcomes),
    reviewDepth: undefined, verificationScopes: undefined, consoleObservationMs: undefined, consoleObservationScopes: undefined })).digest('hex')
}

export async function retryAdmittedRun(auditId: string, operator: AdminDomainActor) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { id: true, userId: true, projectId: true, status: true } })
  const previous = await prisma.runRequest.findFirst({ where: { auditId }, orderBy: { requestedAt: 'desc' }, include: { selections: { select: { outcomeId: true } } } })
  const spec = readExecutionSpec(previous?.executionSpec)
  if (!audit || audit.status !== 'FAILED' || !audit.userId || !audit.projectId || !previous || !spec)
    throw new SiteRunRefusal('This check has no reproducible admitted scope.', 409, 'RETRY_SCOPE_UNAVAILABLE')
  const target = readVerificationTarget(previous.verificationTarget)
  return requestSiteRun({ projectId: audit.projectId, userId: audit.userId, source: 'INTERNAL', operator,
    outcomeIds: spec.scope === 'SITE' || spec.scope === 'CATEGORY' || spec.scope === 'ACCOUNT_CHECKS' || spec.scope === 'FIXTURE_SETUP' ? [] : previous.selections.map(value => value.outcomeId),
    scope: spec.scope === 'DIAGNOSTIC' ? 'OUTCOMES' : spec.scope,
    ...(spec.category ? { categoryArea: spec.category.area } : {}), ...(spec.fixtureSetup ? { fixtureId: spec.fixtureSetup.id } : {}),
    ...(spec.accountChecks ? { accountMode: spec.accountChecks.mode } : {}),
    ...(target ? { verificationTarget: target, verificationAttemptId: target.attemptId, parentAuditId: target.parentAuditId } : {}),
    environment: spec.environment, idempotencyKey: `admin-retry:${operator.operationId}`,
    expectedResponsibilityHash: admittedResponsibilityHash(spec), context: { previousRunId: previous.id, adminOperationId: operator.operationId } })
}
