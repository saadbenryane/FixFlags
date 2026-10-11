import type { Prisma, AuditVerifierExecution } from '@prisma/client'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { taskInputSchema } from './contracts'
import { checkReceiptSchema } from '../checks/receipt'
import { searchReceiptSchema } from '../search/contracts'

type CoverageTask = Pick<AuditVerifierExecution, 'id' | 'auditId' | 'workKind' | 'workInput'>
export async function settleFailedFinalization(tx: Prisma.TransactionClient, task: CoverageTask) {
  if (task.workKind !== 'finalize') return
  await tx.audit.updateMany({ where: { id: task.auditId, status: { notIn: ['COMPLETED', 'FAILED'] } },
    data: { status: 'COMPLETED', progress: 100, reportCompleteness: 'PARTIAL', verdict: null,
      completedAt: new Date(), failureCode: 'FINALIZATION_INCOMPLETE', failureStage: 'finalizing',
      errorMsg: 'Recorded results are preserved. Some final projections could not be published; background reconciliation will continue.' } })
}

/** Exhaustion is a recorded coverage gap, not disappearance of a failed check. */
export async function publishUnfinishedCoverage(tx: Prisma.TransactionClient, task: CoverageTask, reason: string) {
  const input = taskInputSchema.parse(task.workInput)
  if (task.workKind === 'fixture-setup') {
    const audit = await tx.audit.findUnique({ where: { id: task.auditId }, select: { projectId: true, executionSpec: true } })
    const setup = readExecutionSpec(audit?.executionSpec)?.fixtureSetup
    if (setup && audit?.projectId) await tx.outcomeFixture.updateMany({ where: { id: setup.id, projectId: audit.projectId, version: setup.version },
      data: { lastDryRunVersion: setup.version, lastDryRunAt: new Date(), authorizedAt: null,
        lastDryRunResult: { disposition: 'BLOCKED', reason, detail: { fieldCount: 0, cleanupStatus: 'unknown' } } } })
  }
  if (task.workKind === 'check' && input.module) {
    const scopeKey = 'page:' + input.pageUrl + (input.device ? ':device:' + input.device : '')
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: input.module,
      pageUrl: input.pageUrl, passed: false, applicable: true, failed: true, assertions: [] })
    await tx.auditVerifierExecution.upsert({ where: { auditId_targetKey_scopeKey: {
      auditId: task.auditId, targetKey: 'module:' + input.module, scopeKey } },
      create: { auditId: task.auditId, targetKey: 'module:' + input.module, scopeKey,
        pageUrl: input.pageUrl, source: 'DETERMINISTIC', status: 'FAILED', checkVersion: 1, detail: receipt,
        evidenceReference: { auditId: task.auditId, taskId: task.id, reason } }, update: {} })
  }
  if (task.workKind === 'google') {
    const attempt = await tx.auditPipelineEvent.findFirst({ where: { auditId: task.auditId, executionId: task.id, event: 'provider_attempt_observed' },
      orderBy: { sequence: 'desc' }, select: { detail: true } })
    const detail = attempt?.detail as { receipts?: unknown[] } | undefined
    for (const raw of detail?.receipts ?? []) {
      const receipt = searchReceiptSchema.parse(raw)
      const name = input.module === 'google-performance' ? 'search-google-performance' : 'search-google-index'
      await tx.auditVerifierExecution.upsert({ where: { auditId_targetKey_scopeKey: {
        auditId: task.auditId, targetKey: 'module:' + name, scopeKey: 'page:' + input.pageUrl } },
        create: { auditId: task.auditId, targetKey: 'module:' + name, scopeKey: 'page:' + input.pageUrl,
          pageUrl: input.pageUrl, source: 'GOOGLE', status: 'FAILED', checkVersion: 1, detail: receipt,
          evidenceReference: { auditId: task.auditId, taskId: task.id, reason } }, update: {} })
    }
  }
}
