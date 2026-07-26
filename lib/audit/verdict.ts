/** Internal verdict copy written by the audit pipeline - not user-facing summaries. */
export const DETERMINISTIC_SCAN_VERDICT =
  'Deterministic scan complete. Create a free account for AI review, fix prompts, and rubric analysis.'

export const AI_SUMMARY_UNAVAILABLE_VERDICT =
  'AI summary unavailable, deterministic checks and screenshots are shown below.'

const SYSTEM_VERDICTS = new Set([DETERMINISTIC_SCAN_VERDICT, AI_SUMMARY_UNAVAILABLE_VERDICT])

export function isSystemVerdict(verdict: string | null | undefined): boolean {
  if (!verdict) return false
  return SYSTEM_VERDICTS.has(verdict)
}

/** Returns null for pipeline stub verdicts so UI can omit them. */
export function displayVerdict(verdict: string | null | undefined): string | null {
  if (!verdict || isSystemVerdict(verdict)) return null
  return verdict
}

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.!?]+$/, '')
  return trimmed ? `${trimmed}.` : ''
}

export function resolveReportVerdict(
  verdict: string | null | undefined,
  topFlag?: { title?: string; problem?: string; whyItMatters?: string | null } | null
): string | null {
  const problem = topFlag?.problem?.trim() || topFlag?.title?.trim()
  if (!problem) return displayVerdict(verdict)
  const normalizedVerdict = displayVerdict(verdict)
  if (normalizedVerdict?.toLocaleLowerCase().includes(problem.toLocaleLowerCase())) {
    return normalizedVerdict
  }
  const rationale = topFlag?.whyItMatters?.trim()
  return `Fix ${sentence(problem)}${rationale ? ` ${sentence(rationale)}` : ''}`
}
