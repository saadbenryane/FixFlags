export type MonitoringHistoryEntry = {
  id?: string
  checkedAt: string
  flagCount: number
  status?: 'COMPLETED' | 'FAILED'
  flags?: Array<{ id: string; title: string }>
  scope?: 'SITE' | 'OUTCOMES' | 'DIAGNOSTIC' | 'UNKNOWN'
  targetLabel?: string | null
  trigger?: 'MANUAL' | 'SCHEDULED' | 'OTHER' | 'UNKNOWN'
  afterFix?: boolean
  result?: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY' | null
}

type HistoryRun = {
  source: string
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
  recheckTrigger?: string | null
  status: string
  flagCount: number
  runRequests?: HistoryRun[]
  verificationAttempts?: Array<{ id?: string; outcome: string | null; comparable: boolean | null }>
}): Pick<MonitoringHistoryEntry, 'scope' | 'targetLabel' | 'trigger' | 'afterFix' | 'result'> {
  const spec = record(input.executionSpec)
  const run = input.runRequests?.[0]
  const target = record(run?.verificationTarget) ?? record(spec?.verificationTarget)
  const afterFix = target?.kind === 'OUTCOME' || target?.kind === 'DIAGNOSTIC'
  const scope = target?.kind === 'DIAGNOSTIC' ? 'DIAGNOSTIC' : target?.kind === 'OUTCOME' ? 'OUTCOMES'
    : spec?.scope === 'SITE' || spec?.scope === 'OUTCOMES' || spec?.scope === 'DIAGNOSTIC' ? spec.scope
      : !spec && !run?.selections.length ? 'SITE' : 'UNKNOWN'
  const source = run?.source
  const trigger = source === 'WATCH' ? 'SCHEDULED' : source === 'WEB' ? 'MANUAL'
    : source ? 'OTHER' : input.recheckTrigger === 'WATCH' ? 'SCHEDULED'
      : input.recheckTrigger === 'MANUAL' ? 'MANUAL' : 'UNKNOWN'
  let targetLabel: string | null = null
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
  else if (scope !== 'SITE') {
    if (afterFix) result = typeof target?.attemptId === 'string' && attempts.some(item => item.id === target.attemptId && item.outcome === 'IMPROVED' && item.comparable === true) ? 'CLEAR' : 'COULD_NOT_VERIFY'
    else result = assessments.length > 0 && assessments.length === run?.selections.length && assessments.every(item => item.state === 'CLEAR') ? 'CLEAR' : 'COULD_NOT_VERIFY'
  }
  return { scope, targetLabel, trigger, afterFix, result }
}

/** Older payloads predate scope metadata and describe the historical Site trend. */
export function siteTrendChecks(entries: readonly MonitoringHistoryEntry[]): MonitoringHistoryEntry[] {
  return entries.filter(item => (item.scope === 'SITE' || item.scope === undefined) && item.status !== 'FAILED')
}
