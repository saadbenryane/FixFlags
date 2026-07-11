import type { PageRun } from './types'
import type { TriageFailure, TriageFailureReason } from './triage-failure'

export type AuditOutcome =
  | { kind: 'triage_complete'; pageRuns: PageRun[] }
  | {
      kind: 'triage_degraded'
      pageRuns: PageRun[]
      reason: TriageFailureReason
      message: string
    }

/** Primary page triage is required; secondary critical-path pages are deterministic-only. */
export function primaryPageRun(pageRuns: PageRun[]): PageRun | undefined {
  return pageRuns[0]
}

export function hasPrimaryTriage(pageRuns: PageRun[]): boolean {
  return Boolean(primaryPageRun(pageRuns)?.triage)
}

export function primaryTriageFailure(pageRuns: PageRun[]): TriageFailure | undefined {
  return primaryPageRun(pageRuns)?.triageFailure
}

/** Resolve how the audit run should finalize from collected page results. */
export function resolveAuditOutcome(pageRuns: PageRun[]): AuditOutcome {
  if (hasPrimaryTriage(pageRuns)) {
    return { kind: 'triage_complete', pageRuns }
  }

  const failure = primaryTriageFailure(pageRuns)
  return {
    kind: 'triage_degraded',
    pageRuns,
    reason: failure?.reason ?? 'unknown',
    message: failure?.message ?? 'Triage did not complete',
  }
}
