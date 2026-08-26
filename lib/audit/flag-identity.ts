import { buildAiFlagMatchKey } from '@/lib/audit/validate-judge-output'

export function baseCheckId(checkId: string | null | undefined): string | null {
  return checkId?.split('::page:')[0] ?? null
}

/** Stable Product-level identity for equivalent observations from different journeys. */
export function durableCheckId(checkId: string | null | undefined): string | null {
  const base = baseCheckId(checkId)
  if (!base) return null
  if (/^journey-.+-hidden-cta$/.test(base)) return 'journey-hidden-cta'
  if (/^journey-.+-dead-end$/.test(base)) return 'journey-dead-end'
  return base
}

export function parseAffectedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

export function flagFingerprint(input: {
  checkId: string | null
  problem: string
  rubric: string
}): string {
  const checkId = durableCheckId(input.checkId)
  return checkId ? `check:${checkId}` : buildAiFlagMatchKey(input.problem, input.rubric)
}

function identityKey(flag: {
  checkId?: string | null
  problem: string
  rubric: string
}): string {
  const checkId = durableCheckId(flag.checkId)
  return checkId ? `check:${checkId}` : `text:${flag.rubric}:${flag.problem.trim().toLowerCase()}`
}

function severityWeight(severity: string): number {
  if (severity === 'CRITICAL') return 0
  if (severity === 'IMPORTANT') return 1
  return 2
}

/**
 * One underlying issue, many affected paths. Collapse repeated shared chrome
 * into one Flag. Do not collapse distinct issues because titles look similar.
 */
export function collapseFlagsWithAffectedPaths<
  T extends {
    checkId?: string | null
    pageUrl?: string | null
    problem: string
    rubric: string
    severity: string
    evidence?: string
    affectedPaths?: string[]
  },
>(flags: T[]): Array<T & { affectedPaths: string[] }> {
  const groups = new Map<string, T[]>()
  for (const flag of flags) {
    const key = identityKey(flag)
    const group = groups.get(key)
    if (group) group.push(flag)
    else groups.set(key, [flag])
  }

  return [...groups.values()].map((group) => {
    const representative = [...group].sort(
      (left, right) => severityWeight(left.severity) - severityWeight(right.severity)
    )[0]!
    const affectedPaths = [
      ...new Set(
        group.flatMap((flag) => [
          ...(flag.affectedPaths ?? []),
          ...(flag.pageUrl ? [flag.pageUrl] : []),
        ])
      ),
    ]
    const evidence =
      group.length === 1
        ? representative.evidence
        : [
            representative.evidence,
            `Observed on ${affectedPaths.length} pages.`,
          ]
            .filter(Boolean)
            .join(' ')
    return {
      ...representative,
      checkId: durableCheckId(representative.checkId) ?? representative.checkId,
      evidence,
      affectedPaths,
      pageUrl: affectedPaths[0] ?? representative.pageUrl,
    }
  })
}
