import { describe, expect, it, vi } from 'vitest'

const error = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', () => ({
  logger: { error },
}))

import { reportOperationalError } from '@/lib/observability/report-error'

describe('reportOperationalError', () => {
  it('logs a structured operational_error from the shipped helper', () => {
    reportOperationalError('integrity-probe', new Error('browser closed'), { pathId: 'p1' })
    expect(error).toHaveBeenCalledWith('operational_error', {
      operation: 'integrity-probe',
      outcome: 'failure',
      error: 'browser closed',
      stack: expect.any(String),
      pathId: 'p1',
    })
  })
})
