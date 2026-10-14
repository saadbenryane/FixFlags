export type ExecutionTaskSummary = {
  total: number
  recorded: number
  limited: number
  failed: number
  notApplicable: number
  pending: number
  recovering: number
  state: 'active' | 'finished' | 'limited' | 'failed'
  reasons: string[]
}

/** Execution settlement does not imply that any customer assertion passed. */
export function summarizeExecutionTasks(rows: readonly {
  status: string; workState: string | null; workErrorCode?: string | null; count?: number
}[]): ExecutionTaskSummary {
  const summary: ExecutionTaskSummary = { total: rows.reduce((sum, row) => sum + (row.count ?? 1), 0), recorded: 0, limited: 0, failed: 0,
    notApplicable: 0, pending: 0, recovering: 0, state: 'finished', reasons: [] }
  for (const row of rows) {
    const count = row.count ?? 1
    if (row.status === 'NOT_APPLICABLE') summary.notApplicable += count
    else if (row.workState === 'COMPLETED') summary.recorded += count
    else if (row.workState === 'EXHAUSTED') summary.failed += count
    else if (row.workState === 'BLOCKED' || row.workState == null) summary.limited += count
    else if (row.workState === 'RETRY_WAIT') summary.recovering += count
    else summary.pending += count
    if (['BLOCKED', 'EXHAUSTED'].includes(row.workState ?? '') && row.workErrorCode && !summary.reasons.includes(row.workErrorCode))
      summary.reasons.push(row.workErrorCode)
  }
  summary.state = summary.pending || summary.recovering ? 'active' : summary.failed ? 'failed' : summary.limited ? 'limited' : 'finished'
  return summary
}
