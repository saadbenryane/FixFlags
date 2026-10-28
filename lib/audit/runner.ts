import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { enqueuePendingAiReview } from './enqueue-ai-review'
import { claimExecution, withExecutionOwnership } from './execution-ownership'
import { persistImprovementCycle } from './finalize'
import { coordinateProgressiveAudit } from './progressive/runtime'
import { retireLegacyExecution } from './retire-legacy-execution'

/** One coordinator for all newly admitted checks. Historical evidence is retained. */
export async function runAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } })
  if (!audit) throw new Error(`Audit ${auditId} not found`)
  if (audit.status === 'FAILED') return
  if (audit.status === 'COMPLETED') {
    await enqueuePendingAiReview(auditId)
    const owner = await claimExecution(auditId, { projectionOnly: true })
    if (owner) await withExecutionOwnership(owner, () => persistImprovementCycle(auditId, audit.parentId))
    return
  }
  if (readExecutionSpec(audit.executionSpec)?.engine !== 'progressive-v1') {
    await retireLegacyExecution(auditId)
    return
  }
  await coordinateProgressiveAudit(auditId)
}
