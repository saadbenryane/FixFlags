import { sumPrescriptionResponses } from '../prescription-usage'
import { getUserFacingAuditError } from '../user-facing-errors'
import { Prisma, type AuditVerifierExecution } from '@prisma/client'
import { prisma } from '@/lib/db'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { logger } from '@/lib/logger'
import { MAX_TASKS_PER_AUDIT, prescriptionResultSchema, taskArtifactSchema, taskInputSchema, taskIsSettled } from './contracts'
import { checkReceiptSchema } from '../checks/receipt'
import { searchReceiptSchema } from '../search/contracts'
import { settleRecordedPages } from './page-settlement'

const PRESCRIPTION_TERMINAL = new Set(['COMPLETED', 'BLOCKED', 'EXHAUSTED'])

export function prescriptionSettlement(tasks: readonly { workState: string | null; workErrorCode: string | null }[]) {
  if (tasks.length === 0 || tasks.some(task => !PRESCRIPTION_TERMINAL.has(task.workState ?? ''))) return { kind: 'open' as const }
  const failed = tasks.filter(task => task.workState !== 'COMPLETED')
  if (failed.length === 0) return { kind: 'complete' as const }
  const reasons = failed.map(task => task.workErrorCode).filter((code): code is string => Boolean(code))
  const reason = reasons.includes('AI_CONTRACT_INVALID') ? 'AI_CONTRACT_INVALID' : reasons[0] ?? 'AI_REVIEW_FAILED'
  return {
    kind: 'failed' as const,
    failureCode: reason === 'AI_CONTRACT_INVALID' ? 'AI_CONTRACT_INVALID' as const : 'AI_REVIEW_FAILED' as const,
    reason,
  }
}

/** Publish review completion only after every prescription task has finished. */
export async function settlePrescriptionAudit(tx: Prisma.TransactionClient, auditId: string) {
  const tasks = await tx.auditVerifierExecution.findMany({
    where: { auditId, workKind: 'prescription' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { workState: true, workErrorCode: true },
    take: MAX_TASKS_PER_AUDIT + 1,
  })
  if (tasks.length > MAX_TASKS_PER_AUDIT) return { kind: 'open' as const }
  const decision = prescriptionSettlement(tasks)
  if (decision.kind === 'open') return decision
  const where = { id: auditId, status: 'COMPLETED' as const, triageAt: { not: null }, aiReviewAt: null }
  const ownFailure = { failureCode: { in: ['AI_CONTRACT_INVALID', 'AI_REVIEW_FAILED'] },
    failureMetadata: { path: ['phase'], equals: 'prescription' } } satisfies Prisma.AuditWhereInput
  if (decision.kind === 'complete') {
    const aiReviewAt = new Date()
    // Guidance owns only its recorded phase failure. A completed batch cannot
    // erase a collection or finalization failure on the same analysis.
    const recovered = await tx.audit.updateMany({ where: { ...where, ...ownFailure }, data: {
      aiReviewAt, failureCode: null, failureStage: null, errorMsg: null, failureMetadata: Prisma.DbNull,
    } })
    if (!recovered.count) await tx.audit.updateMany({ where, data: { aiReviewAt } })
    return decision
  }
  await tx.audit.updateMany({ where: { ...where, OR: [{ failureCode: null }, ownFailure] }, data: {
    failureCode: decision.failureCode, failureStage: 'judging', errorMsg: getUserFacingAuditError(decision.failureCode),
    failureMetadata: { version: 1, phase: 'prescription', reason: decision.reason },
  } })
  return decision
}

export type SettledPrescriptionUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  model: string
}

/** Sum measured prescription usage once the whole set is terminal. Legacy artifacts contribute nothing. */
export function summedPrescriptionUsage(tasks: readonly { workState: string | null; workResult: unknown }[]): SettledPrescriptionUsage | null {
  if (tasks.length === 0 || tasks.length > MAX_TASKS_PER_AUDIT || tasks.some(task => !taskIsSettled(task.workState))) return null
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  const models: string[] = []
  let counted = 0
  for (const task of tasks) {
    if (task.workState !== 'COMPLETED') continue
    const artifact = taskArtifactSchema.safeParse(task.workResult)
    if (!artifact.success) continue
    const usage = prescriptionResultSchema.safeParse(artifact.data.data)
    if (!usage.success || typeof usage.data.inputTokens !== 'number') continue
    counted += 1
    inputTokens += usage.data.inputTokens
    outputTokens += usage.data.outputTokens ?? 0
    cacheReadTokens += usage.data.cacheReadTokens ?? 0
    cacheWriteTokens += usage.data.cacheWriteTokens ?? 0
    if (usage.data.model && !models.includes(usage.data.model)) models.push(usage.data.model)
  }
  if (counted === 0 || inputTokens + outputTokens === 0) return null
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, model: models.join(',') }
}

/** Record the summed prescription cost after the task transaction commits. A zero or legacy result leaves the existing cost alone. */
export async function recordSettledPrescriptionCost(auditId: string) {
  const tasks = await prisma.auditVerifierExecution.findMany({
    where: { auditId, workKind: 'prescription' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { workState: true, workResult: true },
    take: MAX_TASKS_PER_AUDIT + 1,
  })
  if (tasks.some(task => !taskIsSettled(task.workState))) return
  const responses = await prisma.auditPipelineEvent.findMany({ where: { auditId, event: { in: ['prescription_provider_attempt', 'prescription_provider_response'] } },
    orderBy: { sequence: 'asc' }, select: { event: true, detail: true } })
  const measured = responses.length ? sumPrescriptionResponses(responses) : null
  const usage = measured ?? summedPrescriptionUsage(tasks)
  if (!usage) return
  await persistAuditRunCost(auditId, {
    durationMs: 0,
    llmInputTokens: usage.inputTokens,
    llmOutputTokens: usage.outputTokens,
    llmModel: usage.model,
    pagespeedCalls: 0,
    llmCacheReadTokens: usage.cacheReadTokens,
    llmCacheWriteTokens: usage.cacheWriteTokens,
    phase: 'prescription',
    ...(measured ? { llmMeasurements: measured.measurements, llmUsageComplete: measured.complete } : {}),
  })
}

export function logUnrecordedPrescriptionCost(auditId: string, error: unknown) {
  logger.error('Prescription cost was not recorded', error, { auditId })
}

type CoverageTask = Pick<AuditVerifierExecution, 'id' | 'auditId' | 'workKind' | 'workInput'>
export async function settleFailedFinalization(tx: Prisma.TransactionClient, task: CoverageTask) {
  if (task.workKind !== 'finalize') return
  await settleRecordedPages(tx, task.auditId)
  await tx.audit.updateMany({ where: { id: task.auditId, status: { notIn: ['COMPLETED', 'FAILED'] } },
    data: { status: 'COMPLETED', progress: 100, reportCompleteness: 'PARTIAL', verdict: null,
      completedAt: new Date(), failureCode: 'FINALIZATION_INCOMPLETE', failureStage: 'finalizing',
      errorMsg: 'Recorded results are preserved. Some final projections could not be published; background reconciliation will continue.' } })
}

/** Exhaustion is a recorded coverage gap, not disappearance of a failed check. */
export async function publishUnfinishedCoverage(tx: Prisma.TransactionClient, task: CoverageTask, reason: string) {
  const input = taskInputSchema.parse(task.workInput)
  if (task.workKind === 'prescription') {
    await settlePrescriptionAudit(tx, task.auditId)
    return
  }

  if (task.workKind === 'fixture-setup') {
    const audit = await tx.audit.findUnique({ where: { id: task.auditId }, select: { projectId: true, userId: true, executionSpec: true } })
    const setup = readExecutionSpec(audit?.executionSpec)?.fixtureSetup
    if (setup && audit?.projectId) await tx.outcomeFixture.updateMany({ where: { id: setup.id, projectId: audit.projectId, configuredByUserId: audit.userId, version: setup.version },
      data: { lastDryRunVersion: setup.version, lastDryRunAt: new Date(), authorizedAt: null,
        lastDryRunResult: { disposition: 'BLOCKED', reason, detail: { fieldCount: 0, cleanupStatus: 'unknown' } } } })
  }
  const executionModule = task.workKind === 'slow-replay' ? 'slow-replay' : task.workKind === 'overlays' ? 'overlays' : input.module
  if ((task.workKind === 'check' || task.workKind === 'slow-replay' || task.workKind === 'overlays' || task.workKind === 'flow' && ['form-validation', 'mobile-navigation'].includes(executionModule ?? '')) && executionModule) {
    const scopeKey = 'page:' + input.pageUrl + (input.device ? ':device:' + input.device : '')
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: executionModule,
      pageUrl: input.pageUrl, passed: false, applicable: true, failed: true, assertions: [] })
    await tx.auditVerifierExecution.upsert({ where: { auditId_targetKey_scopeKey: {
      auditId: task.auditId, targetKey: 'module:' + executionModule, scopeKey } },
      create: { auditId: task.auditId, targetKey: 'module:' + executionModule, scopeKey,
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
