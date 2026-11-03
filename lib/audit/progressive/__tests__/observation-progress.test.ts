import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { nextObservationBatch, observationArtifact, observationBatchStart } from '../observation-progress'
import type { TaskContext } from '../registry'

const context = (workResult: unknown = null) => ({ task: { workResult } }) as TaskContext

describe('bounded observation cohorts', () => {
  it('freezes every original member and observes the tail without rereading changing history', async () => {
    const originals = Array.from({ length: 41 }, (_, i) => 'original-' + i)
    const load = vi.fn(async () => originals)
    const first = await nextObservationBatch(context(), 'slow-replay', z.string(), load, 20)
    const committed = observationArtifact('slow-replay', { flags: [] }, first.progress)
    expect(first.members).toEqual(originals.slice(0, 20))
    expect(committed.continuation).toBe(true)
    expect(observationBatchStart(context(), committed, 20)).toBe(0)
    load.mockRejectedValue(new Error('History changed after the first observation'))
    const second = await nextObservationBatch(context(committed), 'slow-replay', z.string(), load, 20)
    const next = observationArtifact('slow-replay', { flags: [] }, second.progress)
    expect(second.members).toEqual(originals.slice(20, 40))
    expect(observationBatchStart(context(committed), next, 20)).toBe(20)
    const last = await nextObservationBatch(context(next), 'slow-replay', z.string(), load, 20)
    const completed = observationArtifact('slow-replay', { flags: [] }, last.progress)
    expect(last.members).toEqual(['original-40'])
    expect(completed.continuation).toBeUndefined()
    expect(observationBatchStart(context(next), completed, 20)).toBe(40)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps a single observation on its established artifact shape', async () => {
    const batch = await nextObservationBatch(context(), 'journeys', z.string(), async () => ['only'], 1)
    const artifact = observationArtifact('journeys', { flags: [] }, batch.progress)
    expect(artifact.data).toEqual({ flags: [] })
    expect(observationBatchStart(context(), artifact, 1)).toBeNull()
  })

  it('keeps member identity when PostgreSQL JSONB returns object keys in another order', async () => {
    const member = z.object({ selector: z.string(), label: z.string() })
    const first = await nextObservationBatch(context(), 'journeys', member, async () => [
      { selector: '#first', label: 'First' }, { selector: '#second', label: 'Second' },
    ], 1)
    const recorded = observationArtifact('journeys', {}, first.progress)
    recorded.data.observationProgress = { version: 1, batchSize: 1, completed: 1,
      members: [{ label: 'First', selector: '#first' }, { label: 'Second', selector: '#second' }] }
    const next = await nextObservationBatch(context(recorded), 'journeys', member, async () => [], 1)
    expect(next.members).toEqual([{ selector: '#second', label: 'Second' }])
    expect(observationBatchStart(context(recorded), observationArtifact('journeys', {}, next.progress), 1)).toBe(1)
  })

  it('refuses changed, skipped, dropped and already completed checkpoints', async () => {
    const first = await nextObservationBatch(context(), 'journeys', z.string(), async () => ['a', 'b', 'c'], 1)
    const committed = observationArtifact('journeys', { flags: [] }, first.progress)
    const next = await nextObservationBatch(context(committed), 'journeys', z.string(), async () => [], 1)
    const valid = observationArtifact('journeys', { flags: [] }, next.progress)
    expect(() => observationBatchStart(context(committed), observationArtifact('journeys', { flags: [] }), 1))
      .toThrow('OBSERVATION_CHECKPOINT_INVALID')
    for (const progress of [{ ...next.progress!, members: ['a', 'changed', 'c'] }, { ...next.progress!, completed: 3 }])
      expect(() => observationBatchStart(context(committed), observationArtifact('journeys', {}, progress), 1))
        .toThrow('OBSERVATION_CHECKPOINT_INVALID')
    expect(() => observationBatchStart(context(committed), { ...valid, continuation: undefined }, 1))
      .toThrow('OBSERVATION_CHECKPOINT_INVALID')
    await expect(nextObservationBatch(context(observationArtifact('journeys', {}, { version: 1, batchSize: 1, members: ['a'], completed: 1 })),
      'journeys', z.string(), async () => [], 1)).rejects.toThrow('OBSERVATION_CHECKPOINT_INVALID')
  })
})
