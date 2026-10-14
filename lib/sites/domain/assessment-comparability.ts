import { z } from 'zod'

const recordedCoverage = z.object({ environment: z.string(), requiredBindings: z.array(z.string()),
  bindings: z.array(z.object({ key: z.string(), version: z.number().int().positive(), mechanism: z.string(),
    fixture: z.object({ id: z.string(), version: z.number().int().positive() }).optional() })) })
export type CurrentBindingRevision = { key: string; version: number; required: boolean; mechanism: string;
  fixture?: { id: string; version: number; authorized: boolean } }

function bindingMatches(before: z.infer<typeof recordedCoverage>['bindings'][number], current: CurrentBindingRevision) {
  if (before.key !== current.key || before.version !== current.version || before.mechanism !== current.mechanism) return false
  return current.mechanism !== 'SAFE_FORM' || Boolean(current.fixture?.authorized && before.fixture &&
    before.fixture.id === current.fixture.id && before.fixture.version === current.fixture.version)
}

/** One method may remain evidenced while another required method is incomplete. */
export function bindingEvidenceIsComparable(coverage: unknown, current: CurrentBindingRevision, environment: string) {
  const parsed = recordedCoverage.safeParse(coverage)
  if (!parsed.success || parsed.data.environment !== environment) return false
  const before = parsed.data.bindings.filter(binding => binding.key === current.key)
  return before.length === 1 && bindingMatches(before[0], current)
}

/** Unversioned receipts remain history. They cannot certify a configuration whose
 * correspondence was never recorded, even when today's binding happens to be v1. */
export function assessmentIsComparable(coverage: unknown, current: CurrentBindingRevision[], environment: string) {
  const parsed = recordedCoverage.safeParse(coverage)
  if (!parsed.success || parsed.data.environment !== environment) return false
  const required = current.filter(binding => binding.required)
  if (!required.length || required.length !== parsed.data.requiredBindings.length) return false
  return required.every(binding => {
    const before = parsed.data.bindings.filter(value => value.key === binding.key)
    return before.length === 1 && parsed.data.requiredBindings.includes(binding.key) && bindingMatches(before[0], binding)
  })
}
