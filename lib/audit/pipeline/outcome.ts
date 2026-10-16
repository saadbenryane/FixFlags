import type { PageEvidence, PageRun } from './types'
import type { TriageFailure, TriageFailureReason } from './triage-failure'

export type AuditOutcome =
  | { kind: 'triage_complete'; pageRuns: PageEvidence[] }
  | {
      kind: 'triage_degraded'
      pageRuns: PageEvidence[]
      reason: TriageFailureReason
      message: string
    }

/** Primary page is the pasted URL; reviewed pages may all carry triage. */
export function primaryPageRun(pageRuns: PageRun[]): PageRun | undefined {
  return pageRuns[0]
}

export function hasReviewedPageTriage(pageRuns: PageEvidence[]): boolean {
  return pageRuns.some((page) => Boolean(page.triage))
}

export function primaryTriageFailure(pageRuns: PageEvidence[]): TriageFailure | undefined {
  return pageRuns.find((page) => page.triageFailure)?.triageFailure
}

/** Resolve how the audit run should finalize from collected page results. */
export function resolveAuditOutcome(pageRuns: PageEvidence[]): AuditOutcome {
  if (hasReviewedPageTriage(pageRuns)) {
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
