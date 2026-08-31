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

export type ObservationIdentityInput = {
  checkId?: string | null
  problem: string
  rubric: string
  fingerprint?: string | null
}

const SHA256_HEX = /^[a-f0-9]{64}$/i

function isStableStoredIdentity(value: string): boolean {
  if (value.startsWith('check:')) return true
  if (value.startsWith('ai:') && value.includes('::')) return true
  return value.includes('::') && !SHA256_HEX.test(value)
}

/**
 * One Product-level identity for persist, collapse, diff, and Improvements.
 * Deterministic Flags use the durable check. AI Flags keep a stable stored
 * identity when one exists; otherwise they key on rubric plus normalized title.
 */
export function observationIdentity(input: ObservationIdentityInput): string {
  const checkId = durableCheckId(input.checkId)
  if (checkId) return `check:${checkId}`
  const stored = input.fingerprint?.trim()
  if (stored && isStableStoredIdentity(stored)) {
    return stored.startsWith('ai:') ? stored.slice(3) : stored
  }
  return buildAiFlagMatchKey(input.problem, input.rubric)
}

/** Every key that should match this observation, including legacy stored hashes. */
export function observationMatchKeys(input: ObservationIdentityInput): string[] {
  const keys = new Set<string>()
  keys.add(observationIdentity({ ...input, fingerprint: undefined }))
  keys.add(observationIdentity(input))
  const stored = input.fingerprint?.trim()
  if (stored) {
    keys.add(stored)
    if (stored.startsWith('ai:')) keys.add(stored.slice(3))
    else keys.add(`ai:${stored}`)
  }
  return [...keys]
}

export function flagFingerprint(input: {
  checkId?: string | null
  problem: string
  rubric: string
  fingerprint?: string | null
}): string {
  return observationIdentity(input)
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
    const key = observationIdentity(flag)
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
