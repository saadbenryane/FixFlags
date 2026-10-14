import type { SiteCheckResult } from './check-results'

/** Combine identical recorded facts for display, retaining every execution source. */
export function groupRecordedSearchResults(results: readonly SiteCheckResult[]) {
  const groups = new Map<string, { result: SiteCheckResult; executions: string[] }>()
  for (const result of results) {
    if (!result.search) continue
    const key = JSON.stringify([result.auditId, result.historical, result.search])
    const group = groups.get(key)
    if (group) {
      if (!group.executions.includes(result.evidenceReference.executionId)) group.executions.push(result.evidenceReference.executionId)
    } else groups.set(key, { result, executions: [result.evidenceReference.executionId] })
  }
  return [...groups.values()]
}
