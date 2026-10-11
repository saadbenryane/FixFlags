import { z } from 'zod'

const recordedCoverage = z.object({ environment: z.string(), requiredBindings: z.array(z.string()),
  bindings: z.array(z.object({ key: z.string(), version: z.number().int().positive(), mechanism: z.string(),
    fixture: z.object({ id: z.string(), version: z.number().int().positive() }).optional() })) })
export type CurrentBindingRevision = { key: string; version: number; required: boolean; mechanism: string;
  fixture?: { id: string; version: number; authorized: boolean } }

/** Unversioned receipts remain history. They cannot certify a configuration whose
 * correspondence was never recorded, even when today's binding happens to be v1. */
export function assessmentIsComparable(coverage: unknown, current: CurrentBindingRevision[], environment: string) {
  const parsed = recordedCoverage.safeParse(coverage)
  if (!parsed.success || parsed.data.environment !== environment) return false
  const required = current.filter(binding => binding.required)
  if (!required.length || required.length !== parsed.data.requiredBindings.length) return false
  return required.every(binding => {
    const before = parsed.data.bindings.find(value => value.key === binding.key)
    if (!before || !parsed.data.requiredBindings.includes(binding.key) || before.version !== binding.version || before.mechanism !== binding.mechanism) return false
    return binding.mechanism !== 'SAFE_FORM' || Boolean(binding.fixture?.authorized && before.fixture &&
      before.fixture.id === binding.fixture.id && before.fixture.version === binding.fixture.version)
  })
}
