import { capturePageKey } from '../browser/observation-scope'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { readSupportingObservations } from '../flag-observations'
import { recordedTargetBatches } from '../recorded-targets'
import { readSlowActionTargets, slowActionContextSchema, slowActionForObservation, SLOW_REPLAY_VERIFICATION_RULE, type SlowActionIdentity } from './slow-replay-contract'

type Source = { verificationRule: string | null; evidenceTargets: unknown; supportingObservations?: unknown }

/** Capture conditions constrain comparison separately. Do not spend the native
 * action sample repeatedly on the same name and destination from old captures. */
function actionsForTargets(targets: unknown[], pageUrl: string) {
  const actions = new Map<string, SlowActionIdentity>()
  for (const target of targets) for (const action of readSlowActionTargets([target])) {
    const identity = slowActionContextSchema.parse(JSON.parse(action.context))
    if (identity.sourcePageKey ? identity.sourcePageKey !== capturePageKey(pageUrl)
      : normalizeVerifierUrl(identity.pageUrl) !== normalizeVerifierUrl(pageUrl)) continue
    const observed = slowActionForObservation(action)
    actions.set(JSON.stringify([observed.label, observed.context]), observed)
  }
  return [...actions.values()]
}

export function originalSlowActions(sources: Source[], pageUrl: string): SlowActionIdentity[] {
  return actionsForTargets(sources.flatMap(source => [source, ...(readSupportingObservations(source.supportingObservations)?.items ?? [])])
    .flatMap(source => source.verificationRule === SLOW_REPLAY_VERIFICATION_RULE && Array.isArray(source.evidenceTargets) ? source.evidenceTargets : []), pageUrl)
}

export async function loadRecordedSlowActions(input: {
  projectId: string; environment: string; pageUrl: string; excludeAuditId: string;
}): Promise<SlowActionIdentity[]> {
  const actions = new Map<string, SlowActionIdentity>()
  for await (const targets of recordedTargetBatches({ ...input, verificationRule: SLOW_REPLAY_VERIFICATION_RULE }))
    for (const action of actionsForTargets(targets, input.pageUrl)) actions.set(JSON.stringify([action.label, action.context]), action)
  return [...actions.values()]
}
