import { describe, expect, it, vi } from 'vitest'
import { runBestEffort } from '@/lib/observability/best-effort'

describe('runBestEffort', () => {
  it('reports success without logging', async () => {
    const logger = { warn: vi.fn() }

    await expect(runBestEffort(async () => undefined, {
      operation: 'worker_heartbeat',
      logger,
    })).resolves.toBe(true)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('continues with a structured failure event', async () => {
    const logger = { warn: vi.fn() }

    await expect(runBestEffort(async () => {
      throw new Error('redis unavailable')
    }, {
      operation: 'worker_heartbeat',
      logger,
      context: { phase: 'idle' },
    })).resolves.toBe(false)
    expect(logger.warn).toHaveBeenCalledWith('Best-effort operation failed', {
      operation: 'worker_heartbeat',
      outcome: 'failure',
      phase: 'idle',
      error: 'redis unavailable',
    })
  })
})
