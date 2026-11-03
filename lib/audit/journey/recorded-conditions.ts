import { capturePageKey } from '../browser/observation-scope'
import { JOURNEY_VERIFICATION_RULE, readJourneyContext } from '../checks/journey-evidence'
import { readSupportingObservations } from '../flag-observations'
import { recordedTargetBatches } from '../recorded-targets'

type JourneyCondition = NonNullable<ReturnType<typeof readJourneyContext>>
type Source = { verificationRule: string | null; evidenceTargets: unknown; supportingObservations?: unknown }

function conditionsForContexts(contexts: string[], pageUrl: string): JourneyCondition[] {
  const pageKey = capturePageKey(pageUrl), conditions = new Map<string, JourneyCondition>()
  for (const context of contexts) {
    const condition = readJourneyContext(context)
    if (condition?.pageKey === pageKey) conditions.set(JSON.stringify(condition), condition)
  }
  return [...conditions.values()]
}

/** Grouped display evidence cannot replace the selected original journey routes. */
export function originalJourneyConditions(sources: Source[], pageUrl: string): JourneyCondition[] {
  return conditionsForContexts(sources.flatMap(source => [source, ...(readSupportingObservations(source.supportingObservations)?.items ?? [])])
    .flatMap(source => source.verificationRule === JOURNEY_VERIFICATION_RULE && Array.isArray(source.evidenceTargets)
      ? source.evidenceTargets.flatMap(target => target && typeof target === 'object' && typeof target.context === 'string' ? [target.context] : []) : []), pageUrl)
}

/** Traverse distinct original conditions, never the newest N display Flags.
 * Transfer only context strings; newer unrelated findings cannot retire care. */
export async function loadRecordedJourneyConditions(input: {
  projectId: string; environment: string; pageUrl: string; excludeAuditId: string;
}): Promise<JourneyCondition[]> {
  const conditions = new Map<string, JourneyCondition>()
  for await (const targets of recordedTargetBatches({ ...input, verificationRule: JOURNEY_VERIFICATION_RULE })) {
    for (const condition of originalJourneyConditions([{ verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: targets }], input.pageUrl))
      conditions.set(JSON.stringify(condition), condition)
  }
  return [...conditions.values()]
}
