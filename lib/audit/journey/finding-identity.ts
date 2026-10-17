import { baseCheckId, durableCheckId } from '../flag-identity'

type Finding = { conditionId?: string; fingerprint?: string | null; source?: string | null; checkId?: string | null; problem: string; evidence?: string; url?: string | null; pageUrl?: string | null }

/** A repeated sentence cannot establish that two recorded conditions are equivalent. */
export function journeyFindingIdentity(finding: Finding): string {
  if (finding.fingerprint?.startsWith('journey-observation:v1::')) return finding.fingerprint
  const original = baseCheckId(finding.checkId)
  if (finding.source === 'JOURNEY' && finding.conditionId && original?.startsWith('journey-funnel-'))
    return `journey-observation:v1::${JSON.stringify([original, finding.url ?? finding.pageUrl ?? null, finding.conditionId])}`
  const checkId = durableCheckId(finding.checkId)
  const scope = finding.url ?? finding.pageUrl ?? null
  // Evaluator-generated labels describe a class of judgment, not a measured condition.
  if (!checkId || baseCheckId(finding.checkId)?.startsWith('journey-funnel-'))
    return JSON.stringify([checkId, scope, finding.source ?? 'JOURNEY', finding.problem, finding.evidence ?? null])
  return JSON.stringify([checkId, scope])
}
