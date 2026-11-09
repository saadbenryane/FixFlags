import type { Prisma, VerifierExecutionStatus, AuditVerificationReceipt } from '@prisma/client'
import { prisma } from '@/lib/db'
import { baseCheckId } from '@/lib/audit/check-identity'
import { currentExecutionOwnership, executionWrite } from '@/lib/audit/execution-ownership'
import { registeredCheck } from '@/lib/audit/check-registry'
import { searchVerifierSchema } from '@/lib/audit/search/contracts'

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
  const key = { auditId: input.auditId, targetKey, scopeKey }
  const update = { taskId: currentExecutionOwnership()?.taskId, source: input.source,
    checkId: baseCheckId(input.checkId), pageUrl: input.pageUrl, status: input.status,
    evidenceReference: input.evidenceReference, detail: input.detail }
  const search = searchVerifierSchema.safeParse(input.detail)
  const recorded = await db.auditVerificationReceipt.upsert({
    where: { auditId_targetKey_scopeKey: key },
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
    update: search.success ? {} : update,
  })
  if (!search.success || !search.data.comparable || search.data.verdict === 'unknown') return recorded
  const previous = searchVerifierSchema.safeParse(recorded.detail)
  if (!previous.success || previous.data.auditId !== input.auditId || previous.data.checkId !== update.checkId) return recorded
  // The conditional write gives failure precedence regardless of arrival order.
  const replaceable = search.data.verdict === 'failed' ? ['unknown', 'passed'] : ['unknown']
  if (!replaceable.includes(previous.data.verdict)) return recorded
  await db.auditVerificationReceipt.updateMany({
    where: { ...key, AND: [{ detail: { path: ['kind'], equals: 'search-verifier' } }],
      OR: replaceable.map(verdict => ({ detail: { path: ['verdict'], equals: verdict } })) }, data: update,
  })
  return db.auditVerificationReceipt.findUniqueOrThrow({ where: { auditId_targetKey_scopeKey: key } })
}
