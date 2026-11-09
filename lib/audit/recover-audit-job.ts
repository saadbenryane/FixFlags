import { prisma } from '@/lib/db'
import { claimExecution, executionSiteAuthoritySql, withExecutionOwnership } from './execution-ownership'
import { STUCK_AUDIT_MINUTES } from './pipeline-config'
import { stuckAuditCutoff } from './stuck-audit-recovery'
import { persistImprovementCycle } from './finalize'
import { retireLegacyExecution } from './retire-legacy-execution'
import { logger } from '@/lib/logger'

export const IMPROVEMENT_PROJECTION_RECOVERY_LIMIT = 25
const PROJECTION_RECOVERY_CONCURRENCY = 4
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
  // Match completedProjectionWhere and the live authority check before LIMIT.
  // Claims and fenced releases advance activity after this short selection.
  const audits = await prisma.$queryRaw<Array<{ id: string; parentId: string | null; projectId: string | null }>>`
    SELECT a.id, a."parentId", a."projectId" FROM audits a
    LEFT JOIN projects p ON p.id = a."projectId" LEFT JOIN users u ON u.id = p."userId"
    WHERE a.status = 'COMPLETED' AND a."improvementProjectedAt" IS NULL
      AND (a."executionLeaseUntil" IS NULL OR a."executionLeaseUntil" <= ${now})
      AND (a."projectId" IS NULL OR (${executionSiteAuthoritySql}))
      AND NOT EXISTS (SELECT 1 FROM audit_execution_tasks t WHERE t."auditId" = a.id
        AND t."workKind" = 'finalize' AND t."workState" = 'RUNNING' AND t."workLeaseUntil" > ${now})
    ORDER BY a."updatedAt", a.id
    LIMIT ${Math.max(1, Math.min(limit, IMPROVEMENT_PROJECTION_RECOVERY_LIMIT))}
    FOR NO KEY UPDATE OF a SKIP LOCKED
  `

  let projected = 0
  let failed = 0
  const sites = [...Map.groupBy(audits, audit => audit.projectId ?? `audit:${audit.id}`).values()]
  let nextSite = 0
  async function project(audit: (typeof audits)[number]) {
    try {
      const owner = await claimExecution(audit.id, { projectionOnly: true, skipLocked: true,
        expectedScope: { projectId: audit.projectId, parentId: audit.parentId } })
      if (!owner) return
      await withExecutionOwnership(owner, () => persistImprovementCycle(audit.id, audit.parentId, { recoverLegacyUsage: true }))
      projected++
    } catch (error) {
      failed++
      logger.error('Improvement projection recovery failed', {
        auditId: audit.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  await Promise.all(Array.from({ length: Math.min(PROJECTION_RECOVERY_CONCURRENCY, sites.length) }, async () => {
    while (nextSite < sites.length) {
      for (const audit of sites[nextSite++]) await project(audit)
    }
  }))
  return { projected, failed, checked: audits.length }
}

/**
 * Find audits stuck beyond STUCK_AUDIT_MINUTES and recover each. Single source
 * of truth shared by the HTTP endpoint (/api/cron/recover-stuck-audits) and the
 * internal recovery scheduler, so both behave identically.
 */
async function queryStuckAudits(now: Date, cutoff: Date, retries = 2): Promise<Array<{ id: string }>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT a.id FROM audits a
        LEFT JOIN projects p ON p.id = a."projectId" LEFT JOIN users u ON u.id = p."userId"
        WHERE a.status NOT IN ('COMPLETED', 'FAILED') AND a."updatedAt" < ${cutoff}
          AND a."executionSpec"->>'engine' IS DISTINCT FROM 'progressive-v1'
          AND (a."executionLeaseUntil" IS NULL OR a."executionLeaseUntil" <= ${now})
          AND (a."projectId" IS NULL OR (${executionSiteAuthoritySql}))
        ORDER BY a."updatedAt", a.id LIMIT 50 FOR NO KEY UPDATE OF a SKIP LOCKED`
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
  const now = new Date()
  const cutoff = stuckAuditCutoff(now.getTime(), STUCK_AUDIT_MINUTES)
  const stuckAudits = await queryStuckAudits(now, cutoff)

  const requeued = 0
  let failed = 0
  for (const audit of stuckAudits) {
    try {
      if (await retireLegacyExecution(audit.id, cutoff)) failed++
    } catch (error) {
      logger.error('Audit recovery interrupted; remaining candidates will continue', { auditId: audit.id, error })
    }
  }

  return { requeued, failed, checked: stuckAudits.length }
}
