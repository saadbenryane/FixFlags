import { z } from 'zod'
import { comparableOutcomeCoverage, completeOutcomeEvidence } from './outcome-proof'

export const outcomeIncidentSchema = z.object({ version: z.literal(1),
  transition: z.enum(['clear', 'failure', 'ongoing_failure', 'recovery', 'regression', 'unknown']),
  incidentRunRequestId: z.string().nullable(), rootFlagIds: z.array(z.string()).max(100),
  flagIds: z.array(z.string()).max(100), recoveredFlagIds: z.array(z.string()).max(100),
  previousAssessmentId: z.string().nullable(),
}).strict()
export type OutcomeIncident = z.infer<typeof outcomeIncidentSchema>
export function readOutcomeIncident(evidence: unknown): OutcomeIncident | null {
  const raw = evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? (evidence as Record<string, unknown>).incident : undefined
  const parsed = outcomeIncidentSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Unknown checks do not end an incident. Recovery requires the same admitted
 * responsibility and positive observation of every required binding. */
export function outcomeIncidentTransition(input: {
  state: string; coverage: unknown; evidence: unknown; runRequestId: string; flagIds: string[];
  previous: { id: string; state: string; coverage: unknown; evidence: unknown } | null;
}): OutcomeIncident {
  const before = input.previous, prior = before && comparableOutcomeCoverage(before.coverage, input.coverage) ? readOutcomeIncident(before.evidence) : null
  const base: OutcomeIncident = { version: 1, transition: 'unknown', incidentRunRequestId: prior?.incidentRunRequestId ?? null,
    rootFlagIds: prior?.rootFlagIds ?? [], flagIds: input.flagIds, recoveredFlagIds: [], previousAssessmentId: prior ? before!.id : null }
  if (input.state === 'FLAG' && input.flagIds.length) {
    if (prior && before?.state === 'FLAG') return { ...base, transition: 'ongoing_failure' }
    return { ...base, transition: prior?.incidentRunRequestId ? 'regression' : 'failure',
      incidentRunRequestId: input.runRequestId, rootFlagIds: input.flagIds }
  }
  if (input.state === 'CLEAR' && completeOutcomeEvidence(input.coverage, input.evidence)) {
    const recovery = Boolean(prior?.incidentRunRequestId && prior.rootFlagIds.length && before?.state === 'FLAG')
    return { ...base, transition: recovery ? 'recovery' : 'clear', recoveredFlagIds: recovery ? prior!.rootFlagIds : [] }
  }
  return base
}
