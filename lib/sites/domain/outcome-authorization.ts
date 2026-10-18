import { z } from 'zod'

const authorizationSchema = z.object({ version: z.literal(1), outcomes: z.array(z.object({
  id: z.string().min(1), revision: z.number().int().positive(),
}).strict()) }).strict().refine(value => new Set(value.outcomes.map(outcome => outcome.id)).size === value.outcomes.length)

/** Server-owned permission provenance is separate from executable responsibility. */
export function snapshotOutcomeAuthorization(outcomes: readonly { id: string; authorizationRevision: number }[]) {
  return authorizationSchema.parse({ version: 1, outcomes: outcomes.map(outcome => ({
    id: outcome.id, revision: outcome.authorizationRevision,
  })) })
}

export function admittedOutcomeAuthorization(context: unknown, outcomeId: string): number | null {
  if (!context || typeof context !== 'object' || Array.isArray(context) || !('outcomeAuthorization' in context)) {
    // The additive migration establishes revision one for retained permissions.
    // Historical requests cannot cross the first subsequent revocation.
    return 1
  }
  const parsed = authorizationSchema.safeParse(context.outcomeAuthorization)
  return parsed.success ? parsed.data.outcomes.find(outcome => outcome.id === outcomeId)?.revision ?? null : null
}
