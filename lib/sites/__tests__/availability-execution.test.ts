import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assessRequiredBindings } from '@/lib/sites/application/binding-assessment'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  executionFindUnique: vi.fn(),
  executionUpsert: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCreateMany: vi.fn(),
  attemptUpdateMany: vi.fn(),
  flagCreate: vi.fn(),
  auditFindUnique: vi.fn(),
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
    outcomeBindingAttempt: {
      findFirst: mocks.attemptFindFirst,
      createMany: mocks.attemptCreateMany,
      updateMany: mocks.attemptUpdateMany,
    },
    flag: { create: mocks.flagCreate },
    audit: { findUnique: mocks.auditFindUnique },
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
    mocks.executionUpsert.mockResolvedValue({ id: 'execution-1' })
    mocks.attemptFindFirst.mockResolvedValue(null)
    mocks.attemptCreateMany.mockResolvedValue({ count: 1 })
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 })
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.flagCreate.mockResolvedValue({ id: 'flag-1' })
    mocks.auditFindUnique.mockResolvedValue({ htmlMetadata: { pageText: 'Example page is ready.' } })
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

  it('confirms an unavailable response with a second request before opening a Flag', async () => {
    const fetchMock = vi.fn(async () => new Response('no', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await runBoundCheckoutForAudit('audit-1')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mocks.attemptCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ attempt: 1, disposition: 'FAILED', reason: 'http_unavailable' }),
        expect.objectContaining({ attempt: 2, disposition: 'FAILED', reason: 'http_unavailable' }),
      ],
    })
    expect(mocks.flagCreate).toHaveBeenCalledTimes(1)
  })

  it('keeps a first unavailable response as transient flakiness when the retry succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('no', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await runBoundCheckoutForAudit('audit-1')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ disposition: 'FAILED', transient: false }),
      data: { transient: true },
    }))
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'SUCCEEDED', reason: 'available' }),
    }))
  })

  it('does not open a Flag when a 200 does not render the expected surface', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      selections: [{
        outcome: {
          id: 'page-1',
          kind: 'AVAILABILITY',
          bindings: [{
            ...binding,
            mechanism: 'HTTP_AVAILABILITY',
            config: { startUrl: 'https://example.net/', expectedText: 'Pricing' },
          }],
        },
      }],
      audit: { url: 'https://example.net/' },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })))

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.flagCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fingerprint: `outcome:availability:${binding.key}` }),
    }))
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'FAILED', reason: 'expected_surface_missing' }),
    }))
  })

  it('treats a bot wall as Couldn\'t verify and does not retry it', async () => {
    const fetchMock = vi.fn(async () => new Response('Checking your browser before accessing', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await runBoundCheckoutForAudit('audit-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'BLOCKED', reason: 'bot_wall' }),
    }))
    expect(assessRequiredBindings([binding], [
      { key: binding.key, disposition: 'BLOCKED', reason: 'bot_wall' },
    ]).state).toBe('COULD_NOT_VERIFY')
  })

  it('treats a successful response with no rendered capture as Couldn\'t verify', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })))

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'BLOCKED', reason: 'rendered_surface_unavailable' }),
    }))
  })
})
