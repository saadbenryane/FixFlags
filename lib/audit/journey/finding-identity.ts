import { durableCheckId } from '../flag-identity'

type Finding = { checkId?: string | null; problem: string; evidence?: string; url?: string | null; pageUrl?: string | null }

/** A repeated sentence cannot establish that two recorded conditions are equivalent. */
export function journeyFindingIdentity(finding: Finding): string {
  const checkId = durableCheckId(finding.checkId)
  const scope = finding.url ?? finding.pageUrl ?? null
  // Evaluator-generated labels describe a class of judgment, not a measured condition.
  if (!checkId || checkId.startsWith('journey-funnel-'))
    return JSON.stringify([checkId, scope, finding.problem, finding.evidence ?? null])
  return JSON.stringify([checkId, scope])
}
