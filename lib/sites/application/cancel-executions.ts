import type { Prisma } from '@prisma/client'
import { readExecutionSpec } from '../domain/execution-spec'
import { ACTIVE_RUN_STATUSES } from './run-leases'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

/** Called under the owning Project lock. Completed facts remain immutable;
 * unfinished admissions settle with uncertainty and lose their write leases. */
export async function cancelSiteExecutions(tx: Prisma.TransactionClient, projectId: string, now: Date) {
  const errorCode = 'SITE_REMOVED', errorMessage = SITE_ACTION_COPY.removedDuringCheck
  const runs = await tx.runRequest.findMany({ where: { projectId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    select: { id: true, auditId: true, environment: true, executionSpec: true, selections: { select: { outcomeId: true } } } })
  const audits = await tx.audit.findMany({ where: { projectId, status: { notIn: ['COMPLETED', 'FAILED'] } }, select: { id: true } })
  const auditIds = [...new Set([...audits.map(audit => audit.id), ...runs.flatMap(run => run.auditId ?? [])])]
  if (auditIds.length) {
    await tx.audit.updateMany({ where: { id: { in: auditIds }, projectId },
      data: { executionToken: null, executionLeaseUntil: null, executionGeneration: { increment: 1 } } })
    await tx.audit.updateMany({ where: { id: { in: auditIds }, projectId, status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: { status: 'FAILED', completedAt: now, failureCode: errorCode, failureStage: 'site-removal', errorMsg: errorMessage } })
    await tx.auditVerifierExecution.updateMany({ where: { auditId: { in: auditIds }, workState: { in: ['WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'] } },
      data: { workState: 'BLOCKED', status: 'FAILED', workToken: null, workLeaseUntil: null, workGeneration: { increment: 1 },
        workDispatchLeaseUntil: null, workRetryAt: null, workErrorCode: errorCode } })
    const attempts = await tx.improvementAttempt.findMany({ where: { verificationAuditId: { in: auditIds }, outcome: null, improvement: { projectId } },
      select: { id: true, sourceAuditId: true, verificationAuditId: true } })
    for (const attempt of attempts) await tx.improvementAttempt.updateMany({
      where: { id: attempt.id, verificationAuditId: attempt.verificationAuditId, outcome: null },
      data: { outcome: 'INCONCLUSIVE', comparable: false, verificationReason: errorMessage,
        evidenceReference: { beforeAuditId: attempt.sourceAuditId, afterAuditId: attempt.verificationAuditId, reason: errorCode } },
    })
  }
  for (const run of runs) {
    const spec = readExecutionSpec(run.executionSpec)
    if (run.auditId) for (const selection of run.selections) await tx.outcomeAssessment.upsert({
      where: { runRequestId_outcomeId: { runRequestId: run.id, outcomeId: selection.outcomeId } }, update: {},
      create: { runRequestId: run.id, outcomeId: selection.outcomeId, auditId: run.auditId, state: 'COULD_NOT_VERIFY', summary: errorMessage,
        assessedAt: now, validUntil: now, evidence: { reason: errorCode }, coverage: { environment: run.environment,
          requiredBindings: spec?.outcomes.find(outcome => outcome.id === selection.outcomeId)?.bindings.filter(binding => binding.required).map(binding => binding.key) ?? [], observedBindings: [] } },
    })
  }
  await tx.runRequest.updateMany({ where: { projectId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    data: { status: 'FAILED', errorCode, errorMessage, completedAt: now, leaseUntil: null } })
}
