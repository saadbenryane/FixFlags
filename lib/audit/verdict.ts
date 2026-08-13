import type { ProductContract } from './product-contract'
import { rankFlagsByPriority, type RankableFlag } from './priority-flags'

/** Internal verdict copy written by the audit pipeline - not user-facing summaries. */
export const DETERMINISTIC_SCAN_VERDICT =
  'Deterministic scan complete. Create a free account for AI review, fix prompts, and rubric analysis.'

export const AI_SUMMARY_UNAVAILABLE_VERDICT =
  'AI summary unavailable, deterministic checks and screenshots are shown below.'

const SYSTEM_VERDICTS = new Set([DETERMINISTIC_SCAN_VERDICT, AI_SUMMARY_UNAVAILABLE_VERDICT])

export const NO_SUPPORTED_PRIORITY_VERDICT =
  'No supported priority issue was found in the captured evidence.'

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
  const rationale = topFlag?.whyItMatters?.trim()
  return `Highest priority: ${sentence(problem)}${rationale ? ` ${sentence(rationale)}` : ''}`
}

export function groundedReportVerdict(
  flags: Array<Omit<RankableFlag, 'id'> & { id?: string }>,
  rubrics: Array<{ name: string; grade: string | null }> = [],
  contract?: ProductContract | null
): string {
  const topFlag = rankFlagsByPriority(
    flags.map((flag, index) => ({ ...flag, id: flag.id ?? `verdict-${index}` })),
    rubrics,
    1,
    contract
  )[0]?.flag
  return resolveReportVerdict(null, topFlag) ?? NO_SUPPORTED_PRIORITY_VERDICT
}

export function groundedRubricSummary(
  rubric: string,
  flags: Array<Omit<RankableFlag, 'id'> & { id?: string }>,
  grade: string | null,
  contract?: ProductContract | null
): string {
  const matching = flags.filter((flag) => flag.rubric === rubric)
  if (matching.length === 0) {
    return `No supported ${rubric.toLocaleLowerCase()} issue was found in the captured evidence.`
  }
  return groundedReportVerdict(matching, [{ name: rubric, grade }], contract)
}
