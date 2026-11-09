import { prisma } from '@/lib/db'
import { executionSiteAuthoritySql, executionTransaction, lockExecutionScope } from './execution-ownership'
import { dispatchTask } from './progressive/engine'
import { MAX_TASKS_PER_AUDIT } from './progressive/contracts'
import { recordProgress } from './progressive/events'
import { flagKeyForRow } from './flag-key'
import { freezePrescriptionScope } from './prescription-scope'
import { prescriptionTaskPlans } from './prescription-plan'
import { logger } from '@/lib/logger'
import { systemClock, type Clock } from '@/lib/time/clock'

const PRESCRIPTION_HANDOFF_RETRY_MS = 60_000

function prescriptionIdentity(index: number | null) {
  const suffix = index === null ? '' : `:${index}`
  return { targetKey: `task:prescription${suffix}`, scopeKey: `audit:prescription${suffix}` }
}

/** The completed report is the durable handoff. Replays never repeat triage. */
export async function enqueuePendingAiReview(auditId: string): Promise<number> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId },
    select: { status: true, userId: true, includeAi: true, triageAt: true, completedAt: true, aiReviewAt: true } })
  if (audit && ['COMPLETED', 'JUDGING'].includes(audit.status) && audit.userId && audit.includeAi && audit.triageAt && audit.completedAt && !audit.aiReviewAt) {
    return enqueueAiReview(auditId)
  }
  return 0
}

/** Completed observations stand on their own. The prescription sweep retries a failed handoff. */
export async function scheduleOptionalAiReview(auditId: string): Promise<void> {
  try { await enqueuePendingAiReview(auditId) }
  catch (error) { logger.warn('Optional AI review handoff deferred to recovery', error, { auditId }) }
}

export async function enqueueAiReview(auditId: string, delayMs = 0): Promise<number> {
  const taskIds = await executionTransaction(async tx => {
    // Use the worker's authority and Project-before-Audit lock order. A
    // completed report cannot lend its former owner's Site to a new task.
    if (!await lockExecutionScope(tx, auditId)) return []
    const audit = await tx.audit.findUnique({ where: { id: auditId },
      select: { status: true, userId: true, url: true, triageAt: true, completedAt: true, aiReviewAt: true, executionLeaseUntil: true,
        user: { select: { lifecycleStatus: true } }, project: { select: { deletedAt: true } } } })
    if (!audit || !['COMPLETED', 'JUDGING'].includes(audit.status) || !audit.userId || !audit.triageAt || !audit.completedAt || audit.aiReviewAt) return []
    if (audit.user?.lifecycleStatus !== 'ACTIVE' || audit.project?.deletedAt) return []
    const existing = await tx.auditExecutionTask.findMany({ where: { auditId, workKind: 'prescription' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
    if (existing.length > 0) return existing.map(task => task.id)
    const flags = await tx.flag.findMany({ where: { auditId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
    const plans = prescriptionTaskPlans(flags.map(flag => ({ ...flag, flagKey: flagKeyForRow(flag) })))
    const count = await tx.auditExecutionTask.count({ where: { auditId } })
    if (count + plans.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
    const created: string[] = []
    for (const plan of plans) {
      const task = await tx.auditExecutionTask.create({ data: { auditId, ...prescriptionIdentity(plan.index),
        pageUrl: audit.url, source: 'EXECUTION', status: 'PENDING', workKind: 'prescription', workState: 'READY',
        workInput: { pageUrl: audit.url, primary: true, position: 0, role: 'prescription',
          prescriptionScope: freezePrescriptionScope(flags, plan.flagKeys), prescriptionContractVersion: 2,
          ...(plan.flagKeys ? { prescriptionFlagKeys: plan.flagKeys } : {}) }, workDependencies: [],
        workRetryAt: new Date(Date.now() + Math.max(0, delayMs)), workDispatchState: 'PENDING' } })
      created.push(task.id)
      await recordProgress(tx, auditId, { taskId: task.id, kind: 'prescription', state: 'admitted' })
    }
    const expiredLegacy = audit.status === 'JUDGING' && (!audit.executionLeaseUntil || audit.executionLeaseUntil <= new Date())
    await tx.audit.update({ where: { id: auditId }, data: { includeAi: true, prescriptionHandoffRetryAt: null,
      ...(expiredLegacy ? { status: 'COMPLETED', progress: 100 } : {}) } })
    return created
  })
  // Redis is a delivery adapter. Its outage cannot erase the committed task or
  // prevent a signed claim; normal task recovery reconstructs delivery.
  for (const taskId of taskIds) {
    await dispatchTask(taskId).catch(error => logger.warn('Prescription delivery deferred to task recovery', { auditId, taskId, message: String(error) }))
  }
  return taskIds.length
}

/** Backfill interrupted handoffs and legacy jobs through the same admission. */
export async function recoverPendingAiReviews(limit = 25, clock: Clock = systemClock): Promise<number> {
  const now = clock.now()
  // Retained former-owner reports are history, not recoverable execution.
  // Filter them before the batch limit; admission rechecks under the Site lock.
  const audits = await prisma.$queryRaw<Array<{ id: string; userId: string }>>`
    SELECT a.id, a."userId" FROM audits a JOIN users u ON u.id = a."userId"
    LEFT JOIN projects p ON p.id = a."projectId"
    WHERE a."includeAi" = true AND a."aiReviewAt" IS NULL AND a."triageAt" IS NOT NULL
      AND a."completedAt" IS NOT NULL AND a."userId" IS NOT NULL AND a.status IN ('COMPLETED', 'JUDGING')
      AND u."lifecycleStatus" = 'ACTIVE'
      AND (a."projectId" IS NULL OR (p."deletedAt" IS NULL AND ${executionSiteAuthoritySql}))
      AND (a."executionLeaseUntil" IS NULL OR a."executionLeaseUntil" <= ${now})
      AND (a."prescriptionHandoffRetryAt" IS NULL OR a."prescriptionHandoffRetryAt" <= ${now})
      AND NOT EXISTS (SELECT 1 FROM audit_execution_tasks task WHERE task."auditId" = a.id AND task."workKind" = 'prescription')
    ORDER BY COALESCE(a."prescriptionHandoffRetryAt", a."completedAt"), a.id LIMIT ${Math.max(1, Math.min(100, limit))}`
  let admitted = 0
  for (const audit of audits) {
    try { if (await enqueuePendingAiReview(audit.id) > 0) admitted++ }
    catch (error) {
      logger.error('Prescription handoff recovery interrupted', error, { auditId: audit.id })
      // Admission rolled back. Save the cooldown separately so a persistent
      // failure cannot reclaim the head of each bounded batch.
      await executionTransaction(async tx => {
        if (!await lockExecutionScope(tx, audit.id)) return
        await tx.audit.updateMany({ where: { id: audit.id, userId: audit.userId, includeAi: true, aiReviewAt: null,
          status: { in: ['COMPLETED', 'JUDGING'] }, triageAt: { not: null }, completedAt: { not: null },
          user: { lifecycleStatus: 'ACTIVE' }, executionTasks: { none: { workKind: 'prescription' } },
          OR: [{ prescriptionHandoffRetryAt: null }, { prescriptionHandoffRetryAt: { lte: now } }],
        }, data: { prescriptionHandoffRetryAt: new Date(clock.now().getTime() + PRESCRIPTION_HANDOFF_RETRY_MS) } })
      }).catch(error => logger.error('Prescription handoff retry time could not be recorded', error, { auditId: audit.id }))
    }
  }
  return admitted
}
