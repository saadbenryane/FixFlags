import { CARD_CATALOG } from './card-areas'
import { readExecutionSpec } from './domain/execution-spec'

/** A trend needs at least two comparable observations. Missing checks stay gaps. */
export function hasFlagTrend(points: ReadonlyArray<{ flagCount: number | null }>): boolean {
  return points.filter(point => point.flagCount !== null).length >= 2
}

export type MonitoringHistoryEntry = {
  id?: string
  checkedAt: string
  flagCount: number
  status?: 'COMPLETED' | 'FAILED'
  evidenceAt?: string | null
  completionState?: 'COMPLETED' | 'PARTIAL' | 'FAILED'
  flags?: Array<{ id: string; title: string }>
  scope?: 'SITE' | 'CATEGORY' | 'OUTCOMES' | 'DIAGNOSTIC' | 'UNKNOWN'
  targetLabel?: string | null
  trigger?: 'MANUAL' | 'SCHEDULED' | 'OTHER' | 'UNKNOWN'
  afterFix?: boolean
  result?: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY' | null
}

type HistoryRun = {
  source: string
  executionSpec?: unknown
  verificationTarget: unknown
  selections: Array<{ outcome: { name: string } }>
  assessments: Array<{ state: string }>
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Scope comes from the recorded execution, never from its Flag count. */
export function monitoringHistoryMetadata(input: {
  executionSpec: unknown
  legacySiteAnalysis?: boolean
  recheckTrigger?: string | null
  status: string
  flagCount: number
  runRequests?: HistoryRun[]
  verificationAttempts?: Array<{ id?: string; outcome: string | null; comparable: boolean | null }>
}): Pick<MonitoringHistoryEntry, 'scope' | 'targetLabel' | 'trigger' | 'afterFix' | 'result'> {
  const run = input.runRequests?.[0]
  const spec = record(input.executionSpec) ?? record(run?.executionSpec)
  const target = record(run?.verificationTarget) ?? record(spec?.verificationTarget)
  const afterFix = target?.kind === 'OUTCOME' || target?.kind === 'DIAGNOSTIC'
  const scope = target?.kind === 'DIAGNOSTIC' ? 'DIAGNOSTIC' : target?.kind === 'OUTCOME' ? 'OUTCOMES'
    : spec?.scope === 'SITE' || spec?.scope === 'OUTCOMES' || spec?.scope === 'DIAGNOSTIC' || spec?.scope === 'CATEGORY' ? spec.scope
      : run?.selections.length ? 'OUTCOMES' : input.legacySiteAnalysis === true ? 'SITE' : 'UNKNOWN'
  const source = run?.source
  const trigger = source === 'WATCH' ? 'SCHEDULED' : source === 'WEB' ? 'MANUAL'
    : source ? 'OTHER' : input.recheckTrigger === 'WATCH' ? 'SCHEDULED'
      : input.recheckTrigger === 'MANUAL' ? 'MANUAL' : 'UNKNOWN'
  let targetLabel: string | null = null
  const category = readExecutionSpec(spec)?.category
  if (scope === 'CATEGORY' && category) targetLabel = CARD_CATALOG[category.area].name
  if (scope === 'OUTCOMES') targetLabel = run?.selections.map(selection => selection.outcome.name).join(', ') || null
  if (scope === 'DIAGNOSTIC') {
    const url = typeof target?.pageUrl === 'string' ? target.pageUrl : spec?.targetUrl
    if (typeof url === 'string') {
      try { targetLabel = new URL(url).pathname } catch { /* An invalid stored URL cannot label the checked scope. */ }
    }
  }
  const attempts = input.verificationAttempts ?? []
  const assessments = run?.assessments ?? []
  let result: MonitoringHistoryEntry['result'] = null
  if (input.status === 'FAILED') result = 'COULD_NOT_VERIFY'
  else if (input.flagCount > 0 || assessments.some(item => item.state === 'FLAG')) result = 'FLAG'
  else if (scope !== 'SITE' && scope !== 'CATEGORY') {
    if (afterFix) result = typeof target?.attemptId === 'string' && attempts.some(item => item.id === target.attemptId && item.outcome === 'IMPROVED' && item.comparable === true) ? 'CLEAR' : 'COULD_NOT_VERIFY'
    else result = assessments.length > 0 && assessments.length === run?.selections.length && assessments.every(item => item.state === 'CLEAR') ? 'CLEAR' : 'COULD_NOT_VERIFY'
  }
  return { scope, targetLabel, trigger, afterFix, result }
}

/** Failed broad executions remain gaps. Unknown legacy scope never implies broad evidence. */
export function siteTrendChecks(entries: readonly MonitoringHistoryEntry[]): MonitoringHistoryEntry[] {
  return entries.filter(item => item.scope === 'SITE')
}
