import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { markOutcomeRunsCouldNotVerify } from '@/lib/sites/application/run-reconciliation'
import { claimExecution, executionWrite, withExecutionOwnership } from './execution-ownership'

export const LEGACY_EXECUTION_RETIRED = 'LEGACY_EXECUTION_RETIRED'
const message = 'This earlier check cannot resume safely. Retry to start a fresh check. Recorded evidence has been preserved.'

/** Retiring a delivery never replays its external effects or replaces its evidence. */
export async function retireLegacyExecution(auditId: string): Promise<boolean> {
  const owner = await claimExecution(auditId, { resume: true })
  if (!owner) return false
  return withExecutionOwnership(owner, async () => {
    const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { status: true, executionSpec: true } })
    if (!audit || ['COMPLETED', 'FAILED'].includes(audit.status) || readExecutionSpec(audit.executionSpec)?.engine === 'progressive-v1') return false
    // Reconcile before the terminal transition, so an interrupted reconciliation
    // leaves this admission discoverable by the next bounded retirement sweep.
    await markOutcomeRunsCouldNotVerify(auditId, LEGACY_EXECUTION_RETIRED, message)
    const retired = await executionWrite(tx => tx.audit.updateMany({
      where: { id: auditId, status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: { status: 'FAILED', failureCode: LEGACY_EXECUTION_RETIRED, failureStage: 'admission',
        errorMsg: message, completedAt: new Date(), dispatchState: 'FAILED', dispatchLeaseUntil: null },
    }))
    return retired.count === 1
  })
}
