const COMPLETION_PREFIXES = ['analysis_completed:', 'first_useful_result:'] as const

/** Both event names record analysis completion. Neither assesses customer usefulness. */
export function analysisCompletionAuditId(key: string): string | null {
  const prefix = COMPLETION_PREFIXES.find(value => key.startsWith(value))
  const id = prefix ? key.slice(prefix.length) : ''
  return id && id.trim() === id ? id : null
}

export function analysisCompletionKeys(auditId: string): string[] {
  return COMPLETION_PREFIXES.map(prefix => prefix + auditId)
}
