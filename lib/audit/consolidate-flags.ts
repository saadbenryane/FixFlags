import type { RankableFlag } from './flag-types'
import { baseCheckId, durableCheckId, parseAffectedPaths } from './flag-identity'
import { severityRank } from '@/lib/utils'

export { baseCheckId, durableCheckId } from './flag-identity'

export interface ConsolidatedFlag extends RankableFlag {
  occurrenceCount: number
  occurrencePageUrls: string[]
}

function pageLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname === '/' ? 'homepage' : parsed.pathname
  } catch {
    return url
  }
}

function selectRepresentative(
  flags: RankableFlag[],
  demonstratedFlagId?: string | null
): RankableFlag {
  const demonstrated = demonstratedFlagId
    ? flags.find((flag) => flag.id === demonstratedFlagId)
    : null
  if (demonstrated) return demonstrated

  // Highest severity wins so a CRITICAL occurrence is never diluted by a POLISH
  // sibling of the same check on another page. Confidence is the tie-break.
  return [...flags].sort((left, right) => {
    const severity = severityRank(left.severity) - severityRank(right.severity)
    if (severity !== 0) return severity
    return (right.confidence ?? 0) - (left.confidence ?? 0)
  })[0]!
}

function consolidateEvidence(flags: RankableFlag[], urls: string[]): string | undefined {
  const evidence = [
    ...new Set(
      flags
        .map((flag) => flag.evidence?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ]
  if (evidence.length === 0) return undefined
  if (flags.length === 1) return evidence[0]

  const pageSummary =
    urls.length > 0 ? urls.map(pageLabel).join(', ') : `${flags.length} occurrences`
  if (evidence.length === 1) {
    return `${evidence[0]} Seen in ${flags.length} Review observations: ${pageSummary}.`
  }

  const byPage = flags
    .slice(0, 6)
    .map(
      (flag) =>
        `${flag.pageUrl ? pageLabel(flag.pageUrl) : 'site-wide'}: ${flag.evidence?.trim()}`
    )
    .join(' | ')
  return `Seen in ${flags.length} Review observations. ${byPage}`
}

/**
 * Turn repeated per-route deterministic detections into one fix while
 * retaining every occurrence for page filtering and evidence.
 */
export function consolidateFlagsByCheck(
  flags: RankableFlag[],
  options: { demonstratedFlagId?: string | null } = {}
): ConsolidatedFlag[] {
  const groups = new Map<string, RankableFlag[]>()

  for (const flag of flags) {
    const checkId = durableCheckId(flag.checkId)
    const key = checkId ? `check:${checkId}` : `flag:${flag.id}`
    const group = groups.get(key)
    if (group) group.push(flag)
    else groups.set(key, [flag])
  }

  return [...groups.values()].map((group) => {
    const representative = selectRepresentative(group, options.demonstratedFlagId)
    const occurrencePageUrls = [
      ...new Set(
        group.flatMap((flag) => [
          ...parseAffectedPaths((flag as { affectedPaths?: unknown }).affectedPaths),
          ...(flag.pageUrl ? [flag.pageUrl] : []),
        ])
      ),
    ]
    return {
      ...representative,
      checkId: baseCheckId(representative.checkId),
      evidence: consolidateEvidence(group, occurrencePageUrls),
      occurrenceCount:
        occurrencePageUrls.length > 0 ? occurrencePageUrls.length : group.length,
      occurrencePageUrls,
    }
  })
}
