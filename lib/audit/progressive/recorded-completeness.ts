import { Prisma } from '@prisma/client'
import { MAX_TASKS_PER_AUDIT, taskIsSettled } from './contracts'

/** PageSpeed, Search Console, and written review can exhaust without a measurement.
 * That does not make the collected website evidence unfinished. */
const enrichmentWithoutSiteRecovery = ['pagespeed', 'google', 'judge'] as const
const excludedFromSiteRecovery = ['prescription', ...enrichmentWithoutSiteRecovery] as const

/** Exhaustion records interrupted execution, unlike a completed inconclusive
 * observation, a blocked authorization, an inapplicable capability, or provider
 * enrichment that can finish without a result. */
export const interruptedAnalysisWorkWhere = {
  targetKey: { startsWith: 'task:' }, workState: 'EXHAUSTED', status: 'FAILED',
  OR: [{ workKind: null }, { workKind: { notIn: [...excludedFromSiteRecovery] } }],
} satisfies Prisma.AuditVerifierExecutionWhereInput

/** SQL counterpart for cohorts joined to the existing "source" Audit alias.
 * Native parity cases cover the ORM and SQL forms together. */
export const interruptedAnalysisWorkSql = Prisma.sql`EXISTS (
  SELECT 1 FROM audit_verifier_executions interrupted
  WHERE interrupted."auditId" = "source".id AND interrupted."targetKey" LIKE 'task:%'
    AND interrupted."workState" = 'EXHAUSTED' AND interrupted.status = 'FAILED'
    AND (interrupted."workKind" IS NULL OR interrupted."workKind" NOT IN (${Prisma.join([...excludedFromSiteRecovery])})))`

export type RecordedCompletionTask = {
  targetKey: string; status: string; workKind?: string | null; workState?: string | null;
  workDependencies?: readonly string[];
}

/** The recorded finalization dependencies own an execution's obligations.
 * Replanning with current code would change the meaning of historical work. */
export function recordedWorkComplete(records: readonly RecordedCompletionTask[]): boolean {
  const tasks = records.filter(record => record.targetKey.startsWith('task:') && record.workKind !== 'prescription')
  if (!tasks.length || tasks.length > MAX_TASKS_PER_AUDIT) return false
  const byKey = new Map(tasks.map(task => [task.targetKey.slice(5), task]))
  if (byKey.size !== tasks.length) return false
  const final = byKey.get('finalize')
  if (final?.workKind !== 'finalize' || !final.workDependencies?.length) return false
  const visiting = new Set<string>(), complete = new Set<string>()
  function visit(key: string): boolean {
    if (complete.has(key)) return true
    if (visiting.has(key)) return false
    const task = byKey.get(key)
    if (!task?.workKind || !Array.isArray(task.workDependencies) || task.workDependencies.length > MAX_TASKS_PER_AUDIT) return false
    if (key !== 'finalize' && !(task.workState === 'COMPLETED' && task.status === 'COMPLETED' ||
      task.status === 'NOT_APPLICABLE' && taskIsSettled(task.workState ?? null))) return false
    visiting.add(key)
    for (const dependency of task.workDependencies) if (!visit(dependency)) return false
    visiting.delete(key); complete.add(key)
    return true
  }
  return visit('finalize') && complete.size === tasks.length
}
