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
  workState: 'EXHAUSTED', status: 'FAILED',
  OR: [{ workKind: null }, { workKind: { notIn: [...excludedFromSiteRecovery] } }],
} satisfies Prisma.AuditExecutionTaskWhereInput

/** SQL counterpart for cohorts joined to the existing "source" Audit alias.
 * Native parity cases cover the ORM and SQL forms together. */
export const interruptedAnalysisWorkSql = Prisma.sql`EXISTS (
  SELECT 1 FROM audit_execution_tasks interrupted
  WHERE interrupted."auditId" = "source".id
    AND interrupted."workState" = 'EXHAUSTED' AND interrupted.status = 'FAILED'
    AND (interrupted."workKind" IS NULL OR interrupted."workKind" NOT IN (${Prisma.join([...excludedFromSiteRecovery])})))`

export const unavailableBrowserPageWhere = { failureCode: 'BROWSER_SCOPE_UNAVAILABLE' } satisfies Prisma.AuditPageWhereInput

const pageResponseInterruptionPath = ['data', 'pageResponseInterrupted']
const interruptedPageResponseWhere = {
  workKind: 'check', workState: 'COMPLETED', status: 'COMPLETED',
  targetKey: { startsWith: 'task:p', endsWith: ':page-response' },
  workResult: { path: pageResponseInterruptionPath, equals: true },
} satisfies Prisma.AuditExecutionTaskWhereInput

/** A Run can settle with useful evidence beside a documented collection
 * interruption. Retry the scope without rewriting the completed result. */
export const incompleteScheduledAnalysisWhere = { OR: [
  { verifierExecutions: { some: interruptedAnalysisWorkWhere } }, { pages: { some: unavailableBrowserPageWhere } },
  { executionTasks: { some: interruptedPageResponseWhere } },
] } satisfies Prisma.AuditWhereInput

export const incompleteScheduledAnalysisSql = Prisma.sql`(${interruptedAnalysisWorkSql} OR EXISTS (
  SELECT 1 FROM audit_pages page WHERE page."auditId" = "source".id AND page."failureCode" = ${unavailableBrowserPageWhere.failureCode}) OR EXISTS (
  SELECT 1 FROM audit_execution_tasks response WHERE response."auditId" = "source".id AND response."workKind" = 'check'
    AND response."workState" = 'COMPLETED' AND response.status = 'COMPLETED' AND response."targetKey" LIKE 'task:p%:page-response'
    AND response."workResult" #> ARRAY[${Prisma.join(pageResponseInterruptionPath)}]::text[] = 'true'::jsonb))`

export type RecordedCompletionTask = {
  recordKind?: string; targetKey: string; status: string; workKind?: string | null; workState?: string | null;
  workDependencies?: readonly string[];
}

/** The recorded finalization dependencies own an execution's obligations.
 * Replanning with current code would change the meaning of historical work. */
export function recordedWorkComplete(records: readonly RecordedCompletionTask[], optionalFailures: readonly string[] = []): boolean {
  const tasks = records.filter(record => (record.recordKind === 'task' || record.workState != null || record.workKind != null) && record.workKind !== 'prescription')
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
      task.status === 'NOT_APPLICABLE' && taskIsSettled(task.workState ?? null) ||
      task.status === 'FAILED' && taskIsSettled(task.workState ?? null) && optionalFailures.includes(task.workKind))) return false
    visiting.add(key)
    for (const dependency of task.workDependencies) if (!visit(dependency)) return false
    visiting.delete(key); complete.add(key)
    return true
  }
  return visit('finalize') && complete.size === tasks.length
}
