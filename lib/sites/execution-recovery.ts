import type { SiteCardArea } from './card-areas'
import { taskArea } from './card-execution'

export type ExecutionRecovery = { action: 'retry' | 'access' | 'connections' | 'inspect' | 'support'; reasons: string[] }
type Task = { kind: string; module?: string | null; state: string; reason: string | null }
const accessReasons = new Set(['PUBLIC_ACCESS_CHALLENGE', 'PAGE_AUTH_REQUIRED', 'PAGE_BOT_WALL', 'PROTECTED_ACTION_REQUIRES_FIXTURE',
  'PROTECTED_EFFECT_UNRESOLVED', 'ACCOUNT_CHECKS_NOT_ADMITTED', 'FIXTURE_SETUP_INTENT_INVALID'])
const connectionReasons = new Set(['GOOGLE_AUTH_REQUIRED', 'GOOGLE_PROPERTY_MISMATCH', 'GOOGLE_REAUTH_REQUIRED', 'GOOGLE_NOT_CONNECTED'])
const supportReasons = new Set(['STORAGE_NOT_CONFIGURED', 'CHECK_NOT_REGISTERED', 'CHECK_VERSION_UNAVAILABLE',
  'EVALUATOR_NOT_REGISTERED', 'SEARCH_EVALUATOR_NOT_REGISTERED', 'EXECUTION_SPEC_INVALID', 'ARTIFACT_KIND_MISMATCH'])
const rank = { retry: 0, inspect: 1, support: 2, connections: 3, access: 4 }
const publicActionLimit = 'PROTECTED_ACTION_REQUIRES_FIXTURE'
export type RecheckReplacement = ExecutionRecovery & { action: Exclude<ExecutionRecovery['action'], 'retry'> }

/** A refused public action does not block another check of the saved page. Retry stays on Recheck. */
export function recoveryReplacesRecheck(recovery: ExecutionRecovery | null | undefined): recovery is RecheckReplacement {
  if (!recovery || recovery.action === 'retry') return false
  return !(recovery.action === 'access' && recovery.reasons.length > 0 && recovery.reasons.every(reason => reason === publicActionLimit))
}

/** A blocked collector is not retryable merely because its scope is incomplete. */
export function executionRecovery(tasks: readonly Task[]): ExecutionRecovery | null {
  const missing = tasks.filter(task => ['BLOCKED', 'EXHAUSTED'].includes(task.state))
  if (!missing.length) return null
  let action: ExecutionRecovery['action'] = 'retry'
  for (const task of missing) {
    const code = task.reason ?? ''
    const next: ExecutionRecovery['action'] = accessReasons.has(code) ? 'access' : connectionReasons.has(code) ? 'connections'
      : supportReasons.has(code) ? 'support' : task.state === 'EXHAUSTED' || code === 'PAGE_HTTP_ERROR' ? 'retry' : 'inspect'
    if (rank[next] > rank[action]) action = next
  }
  return { action, reasons: [...new Set(missing.flatMap(task => task.reason ? [task.reason] : []))] }
}

export function categoryExecutionRecovery(tasks: readonly Task[]): Partial<Record<SiteCardArea, ExecutionRecovery>> {
  const groups = new Map<SiteCardArea, Task[]>()
  for (const task of tasks) {
    const area = taskArea(task)
    if (area) groups.set(area, [...(groups.get(area) ?? []), task])
  }
  return Object.fromEntries([...groups].flatMap(([area, tasks]) => {
    const recovery = executionRecovery(tasks)
    return recovery ? [[area, recovery]] : []
  }))
}
