import { prisma } from '@/lib/db'
import type { CurrentBindingRevision } from '../domain/assessment-comparability'

type OutcomeBindings = {
  projectId?: string | null
  bindings: Array<Omit<CurrentBindingRevision, 'fixture'> & { config?: unknown }>
}

/** Read current fixture authority once for a batch, preserving exact Site ownership. */
export async function loadOutcomeBindingRevisions(outcomes: OutcomeBindings[]): Promise<CurrentBindingRevision[][]> {
  const identity = (projectId: string, fixtureId: string) => JSON.stringify([projectId, fixtureId])
  const fixtureId = (config: unknown) => {
    const value = config && typeof config === 'object' && 'fixtureId' in config ? config.fixtureId : null
    return typeof value === 'string' && value ? value : null
  }
  const requested = new Map<string, { projectId: string; id: string }>()
  for (const outcome of outcomes) for (const binding of outcome.bindings) {
    const id = binding.mechanism === 'SAFE_FORM' ? fixtureId(binding.config) : null
    if (id && outcome.projectId) requested.set(identity(outcome.projectId, id), { projectId: outcome.projectId, id })
  }
  const fixtures = requested.size ? await prisma.outcomeFixture.findMany({
    where: { OR: [...requested.values()] },
    select: { id: true, projectId: true, version: true, enabled: true, authorizedAt: true, lastDryRunVersion: true },
  }) : []
  const byScope = new Map(fixtures.map(fixture => [identity(fixture.projectId, fixture.id), fixture]))
  return outcomes.map(outcome => outcome.bindings.map(binding => {
    const id = binding.mechanism === 'SAFE_FORM' ? fixtureId(binding.config) : null
    const fixture = id && outcome.projectId ? byScope.get(identity(outcome.projectId, id)) : undefined
    return { key: binding.key, required: binding.required, version: binding.version, mechanism: binding.mechanism,
      ...(fixture ? { fixture: { id: fixture.id, version: fixture.version,
        authorized: fixture.enabled && Boolean(fixture.authorizedAt) && fixture.lastDryRunVersion === fixture.version } } : {}) }
  }))
}
