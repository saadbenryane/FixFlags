import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { claimExecution, withExecutionOwnership } from './execution-ownership'
import { incrementUsageOnCompleteForAudit } from './usage'
import { STUCK_AUDIT_MINUTES } from './pipeline-config'
import { stuckAuditCutoff } from './stuck-audit-recovery'
import { persistImprovementCycle } from './finalize'
import { retireLegacyExecution } from './retire-legacy-execution'
import { logger } from '@/lib/logger'

export const IMPROVEMENT_PROJECTION_RECOVERY_LIMIT = 25
export interface StuckAuditSweepResult { requeued: number; failed: number; checked: number }

export interface ImprovementProjectionRecoveryResult {
  projected: number
  failed: number
  checked: number
}

/**
 * Resume bounded durable Product projections that were interrupted after the
 * Review reached COMPLETED. Projection services and ledger writes are
 * idempotent, so both immediate runner retry and this scheduler use the same
 * boundary without fabricating a second lifecycle event.
 */
export async function recoverCompletedImprovementProjections(
  limit = IMPROVEMENT_PROJECTION_RECOVERY_LIMIT
): Promise<ImprovementProjectionRecoveryResult> {
  const now = new Date()
  const audits = await prisma.audit.findMany({
    where: { status: 'COMPLETED', improvementProjectedAt: null,
      OR: [{ executionLeaseUntil: null }, { executionLeaseUntil: { lte: now } }],
      executionTasks: { none: { workKind: 'finalize', workState: 'RUNNING', workLeaseUntil: { gt: now } } } },
    // Claims and fenced releases already advance activity. A failed oldest
    // completion must yield its next bounded turn to untouched work.
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: Math.max(1, Math.min(limit, IMPROVEMENT_PROJECTION_RECOVERY_LIMIT)),
    select: { id: true, parentId: true, userId: true },
  })

  let projected = 0
  let failed = 0
  for (const audit of audits) {
    try {
      const owner = await claimExecution(audit.id, { projectionOnly: true })
      if (!owner) continue
      await withExecutionOwnership(owner, async () => {
        if (audit.userId) await incrementUsageOnCompleteForAudit(audit.id, audit.userId)
        await persistImprovementCycle(audit.id, audit.parentId)
      })
      projected++
    } catch (error) {
      failed++
      logger.error('Improvement projection recovery failed', {
        auditId: audit.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { projected, failed, checked: audits.length }
}

/**
 * Find audits stuck beyond STUCK_AUDIT_MINUTES and recover each. Single source
 * of truth shared by the HTTP endpoint (/api/cron/recover-stuck-audits) and the
 * internal recovery scheduler, so both behave identically.
 */
async function queryStuckAudits(cutoff: Date, retries = 2): Promise<Array<{ id: string; status: string; startedAt: Date | null; reviewDepth: number }>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.audit.findMany({
        where: {
          status: { notIn: ['COMPLETED', 'FAILED'] },
          updatedAt: { lt: cutoff },
          OR: [{ executionSpec: { equals: Prisma.DbNull } }, { NOT: { executionSpec: { path: ['engine'], equals: 'progressive-v1' } } }],
        },
        select: { id: true, status: true, startedAt: true, reviewDepth: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 50,
      })
    } catch (err) {
      if (attempt < retries) {
        const delay = 1_000 * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
  return []
}

export async function runStuckAuditRecoverySweep(): Promise<StuckAuditSweepResult> {
  const cutoff = stuckAuditCutoff(Date.now(), STUCK_AUDIT_MINUTES)
  const stuckAudits = await queryStuckAudits(cutoff)

  const requeued = 0
  let failed = 0
  for (const audit of stuckAudits) {
    try {
      if (await retireLegacyExecution(audit.id)) failed++
    } catch (error) {
      logger.error('Audit recovery interrupted; remaining candidates will continue', { auditId: audit.id, error })
    }
  }

  return { requeued, failed, checked: stuckAudits.length }
}
