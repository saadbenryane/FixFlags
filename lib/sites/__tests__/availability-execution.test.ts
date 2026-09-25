import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assessRequiredBindings } from '@/lib/sites/application/binding-assessment'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  executionFindUnique: vi.fn(),
  executionUpsert: vi.fn(),
  flagCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    runRequest: {
      findFirst: mocks.runFindFirst,
      updateMany: mocks.runUpdateMany,
    },
    outcomeBindingExecution: {
      findUnique: mocks.executionFindUnique,
      upsert: mocks.executionUpsert,
    },
    flag: { create: mocks.flagCreate },
  },
}))

import { runBoundCheckoutForAudit } from '@/lib/sites/application/checkout-execution'

const binding = {
  key: 'page-availability-v1',
  required: true,
}

function availabilityRun() {
  return {
    id: 'run-1',
    selections: [{
      outcome: {
        id: 'page-1',
        kind: 'AVAILABILITY',
        bindings: [{
          ...binding,
          mechanism: 'HTTP_AVAILABILITY',
          config: { startUrl: 'https://example.net/' },
        }],
      },
    }],
    audit: { url: 'https://example.net/' },
  }
}

describe('availability Outcome execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runFindFirst.mockResolvedValue(availabilityRun())
    mocks.executionFindUnique.mockResolvedValue(null)
    mocks.executionUpsert.mockResolvedValue({})
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.flagCreate.mockResolvedValue({ id: 'flag-1' })
  })

  it('records a successful public response and that is the only Clear', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })))

    await expect(runBoundCheckoutForAudit('audit-1')).resolves.toBe(true)

    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        mechanism: 'HTTP_AVAILABILITY',
        disposition: 'SUCCEEDED',
        reason: 'available',
      }),
    }))
    expect(assessRequiredBindings([binding], [
      { key: binding.key, disposition: 'SUCCEEDED', reason: 'available' },
    ]).state).toBe('CLEAR')
  })

  it('keeps a missing or blocked check as Couldn\'t verify and flags an unsuccessful response', async () => {
    expect(assessRequiredBindings([binding], []).state).toBe('COULD_NOT_VERIFY')

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'BLOCKED', reason: 'request_failed' }),
    }))
    expect(assessRequiredBindings([binding], [
      { key: binding.key, disposition: 'BLOCKED', reason: 'request_failed' },
    ]).state).toBe('COULD_NOT_VERIFY')

    mocks.executionUpsert.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })))
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.flagCreate).toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'FAILED', reason: 'http_unavailable' }),
    }))
    expect(assessRequiredBindings([binding], [
      { key: binding.key, disposition: 'FAILED', reason: 'http_unavailable' },
    ]).state).toBe('FLAG')
  })
})
