import type { Prisma, VerifierExecutionStatus, AuditVerificationReceipt } from '@prisma/client'
import { prisma } from '@/lib/db'
import { baseCheckId } from '@/lib/audit/check-identity'
import { currentExecutionOwnership, executionWrite } from '@/lib/audit/execution-ownership'
import { registeredCheck } from '@/lib/audit/check-registry'

type DbClient = typeof prisma | Prisma.TransactionClient

import { verifierScopeKey, verifierTargetKey } from './verifier-scope'

export async function recordVerifierExecution(input: {
  auditId: string
  source: string
  checkId: string | null
  fingerprint?: string | null
  pageUrl: string | null
  status: VerifierExecutionStatus
  evidenceReference?: Prisma.InputJsonValue
  detail?: Prisma.InputJsonValue
}, db: DbClient = prisma): Promise<AuditVerificationReceipt> {
  if (db === prisma && currentExecutionOwnership()) return executionWrite(tx => recordVerifierExecution(input, tx))
  const targetKey = verifierTargetKey(input)
  if (!targetKey) throw new Error('Verifier execution requires a stable target identity')
  const scopeKey = verifierScopeKey(input.pageUrl)
  return db.auditVerificationReceipt.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey, scopeKey } },
    create: {
      auditId: input.auditId,
      taskId: currentExecutionOwnership()?.taskId,
      targetKey,
      source: input.source,
      checkId: baseCheckId(input.checkId),
      pageUrl: input.pageUrl,
      scopeKey,
      status: input.status,
      evidenceReference: input.evidenceReference,
      detail: input.detail,
      checkVersion: currentExecutionOwnership() ? registeredCheck(input.checkId)?.version : undefined,
      executionGeneration: currentExecutionOwnership()?.generation,
    },
    update: {
      taskId: currentExecutionOwnership()?.taskId,
      source: input.source,
      checkId: baseCheckId(input.checkId),
      pageUrl: input.pageUrl,
      status: input.status,
      evidenceReference: input.evidenceReference,
      detail: input.detail,
    },
  })
}
