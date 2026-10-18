import { prisma } from '@/lib/db'
import { executionTransaction } from './execution-ownership'
import { dispatchTask } from './progressive/engine'
import { MAX_TASKS_PER_AUDIT } from './progressive/contracts'
import { recordProgress } from './progressive/events'
import { flagKeyForRow } from './flag-key'
import { freezePrescriptionScope } from './prescription-scope'
import { prescriptionTaskPlans } from './prescription-plan'
import { logger } from '@/lib/logger'

function prescriptionIdentity(index: number | null) {
  const suffix = index === null ? '' : `:${index}`
  return { targetKey: `task:prescription${suffix}`, scopeKey: `audit:prescription${suffix}` }
}

/** The completed report is the durable handoff. Replays never repeat triage. */
export async function enqueuePendingAiReview(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId },
    select: { status: true, userId: true, includeAi: true, triageAt: true, completedAt: true, aiReviewAt: true } })
  if (audit && ['COMPLETED', 'JUDGING'].includes(audit.status) && audit.userId && audit.includeAi && audit.triageAt && audit.completedAt && !audit.aiReviewAt) {
    await enqueueAiReview(auditId)
  }
}

export async function enqueueAiReview(auditId: string, delayMs = 0): Promise<void> {
  const taskIds = await executionTransaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
    const audit = await tx.audit.findUnique({ where: { id: auditId },
      select: { status: true, userId: true, url: true, triageAt: true, completedAt: true, aiReviewAt: true, executionLeaseUntil: true,
        user: { select: { lifecycleStatus: true } }, project: { select: { deletedAt: true } } } })
    if (!audit || !['COMPLETED', 'JUDGING'].includes(audit.status) || !audit.userId || !audit.triageAt || !audit.completedAt || audit.aiReviewAt) return []
    if (audit.user?.lifecycleStatus !== 'ACTIVE' || audit.project?.deletedAt) return []
    const existing = await tx.auditVerifierExecution.findMany({ where: { auditId, workKind: 'prescription' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
    if (existing.length > 0) return existing.map(task => task.id)
    const flags = await tx.flag.findMany({ where: { auditId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
    const plans = prescriptionTaskPlans(flags.map(flag => ({ flagKey: flagKeyForRow(flag) })))
    const count = await tx.auditVerifierExecution.count({ where: { auditId, targetKey: { startsWith: 'task:' } } })
    if (count + plans.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
    const created: string[] = []
    for (const plan of plans) {
      const task = await tx.auditVerifierExecution.create({ data: { auditId, ...prescriptionIdentity(plan.index),
        pageUrl: audit.url, source: 'EXECUTION', status: 'PENDING', workKind: 'prescription', workState: 'READY',
        workInput: { pageUrl: audit.url, primary: true, position: 0, role: 'prescription',
          prescriptionScope: freezePrescriptionScope(flags, plan.flagKeys),
          ...(plan.flagKeys ? { prescriptionFlagKeys: plan.flagKeys } : {}) }, workDependencies: [],
        workRetryAt: new Date(Date.now() + Math.max(0, delayMs)), workDispatchState: 'PENDING' } })
      created.push(task.id)
      await recordProgress(tx, auditId, { taskId: task.id, kind: 'prescription', state: 'admitted' })
    }
    const expiredLegacy = audit.status === 'JUDGING' && (!audit.executionLeaseUntil || audit.executionLeaseUntil <= new Date())
    await tx.audit.update({ where: { id: auditId }, data: { includeAi: true, ...(expiredLegacy ? { status: 'COMPLETED', progress: 100 } : {}) } })
    return created
  })
  // Redis is a delivery adapter. Its outage cannot erase the committed task or
  // prevent a signed claim; normal task recovery reconstructs delivery.
  for (const taskId of taskIds) {
    await dispatchTask(taskId).catch(error => logger.warn('Prescription delivery deferred to task recovery', { auditId, taskId, message: String(error) }))
  }
}

/** Backfill interrupted handoffs and legacy jobs through the same admission. */
export async function recoverPendingAiReviews(limit = 25): Promise<number> {
  const audits = await prisma.audit.findMany({ where: { includeAi: true, aiReviewAt: null, triageAt: { not: null },
    completedAt: { not: null }, status: { in: ['COMPLETED', 'JUDGING'] }, user: { lifecycleStatus: 'ACTIVE' },
    AND: [{ OR: [{ projectId: null }, { project: { deletedAt: null } }] }],
    OR: [{ executionLeaseUntil: null }, { executionLeaseUntil: { lte: new Date() } }],
    verifierExecutions: { none: { workKind: 'prescription' } } },
    orderBy: [{ completedAt: 'asc' }, { id: 'asc' }], take: Math.max(1, Math.min(100, limit)), select: { id: true } })
  let admitted = 0
  for (const audit of audits) {
    try { await enqueuePendingAiReview(audit.id); admitted++ }
    catch (error) { logger.error('Prescription handoff recovery interrupted', error, { auditId: audit.id }) }
  }
  return admitted
}
