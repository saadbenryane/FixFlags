import type { RankableFlag } from './flag-types'

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  POLISH: 1,
}

export interface ConsolidatedFlag extends RankableFlag {
  occurrenceCount: number
  occurrencePageUrls: string[]
}

export function baseCheckId(checkId: string | null | undefined): string | null {
  return checkId?.split('::page:')[0] ?? null
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
    const severity =
      (SEVERITY_RANK[right.severity] ?? 0) - (SEVERITY_RANK[left.severity] ?? 0)
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
    return `${evidence[0]} Seen on ${flags.length} scanned pages: ${pageSummary}.`
  }

  const byPage = flags
    .slice(0, 6)
    .map(
      (flag) =>
        `${flag.pageUrl ? pageLabel(flag.pageUrl) : 'site-wide'}: ${flag.evidence?.trim()}`
    )
    .join(' | ')
  return `Seen on ${flags.length} scanned pages. ${byPage}`
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
    const checkId = baseCheckId(flag.checkId)
    const key = checkId ? `check:${checkId}` : `flag:${flag.id}`
    const group = groups.get(key)
    if (group) group.push(flag)
    else groups.set(key, [flag])
  }

  return [...groups.values()].map((group) => {
    const representative = selectRepresentative(group, options.demonstratedFlagId)
    const occurrencePageUrls = [
      ...new Set(
        group.map((flag) => flag.pageUrl).filter((url): url is string => Boolean(url))
      ),
    ]
    return {
      ...representative,
      checkId: baseCheckId(representative.checkId),
      evidence: consolidateEvidence(group, occurrencePageUrls),
      occurrenceCount: group.length,
      occurrencePageUrls,
    }
  })
}
