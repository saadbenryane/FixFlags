import { describe, expect, it, vi } from 'vitest'
import { appendImprovementCycleEvent } from './cycle-ledger'

describe('appendImprovementCycleEvent', () => {
  it('uses the cycle and semantic action as durable idempotency boundaries', async () => {
    const cycleUpsert = vi.fn().mockResolvedValue({ id: 'cycle-1' })
    const eventUpsert = vi.fn().mockResolvedValue({ id: 'event-1' })
    const db = {
      improvementCycle: { upsert: cycleUpsert },
      improvementCycleEvent: { upsert: eventUpsert },
    }
    const input = {
      projectId: 'product-1',
      improvementId: 'improvement-1',
      sourceAuditId: 'review-1',
      idempotencyKey: 'handoff:flag-1:web',
      type: 'HANDOFF_COPIED' as const,
      transport: 'web',
    }

    await appendImprovementCycleEvent(input, db as never)
    await appendImprovementCycleEvent(input, db as never)

    expect(eventUpsert).toHaveBeenCalledTimes(2)
    expect(eventUpsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        cycleId_idempotencyKey: {
          cycleId: 'cycle-1',
          idempotencyKey: 'handoff:flag-1:web',
        },
      },
    }))
  })
})
