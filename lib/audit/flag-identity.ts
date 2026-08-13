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

export function flagFingerprint(input: {
  checkId: string | null
  problem: string
  rubric: string
}): string {
  const checkId = durableCheckId(input.checkId)
  return checkId ? `check:${checkId}` : buildAiFlagMatchKey(input.problem, input.rubric)
}
