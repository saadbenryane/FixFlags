import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assessRequiredBindings } from '@/lib/sites/application/binding-assessment'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  executionFindUnique: vi.fn(),
  executionCreate: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCreateMany: vi.fn(),
  attemptUpdateMany: vi.fn(),
  flagCreate: vi.fn(),
  auditFindUnique: vi.fn(),
  createAuditPage: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      $queryRaw: vi.fn(async () => [{ id: 'audit-1' }]),
      outcomeBindingExecution: { findUnique: mocks.executionFindUnique, create: mocks.executionCreate },
      outcomeBindingAttempt: { findFirst: mocks.attemptFindFirst, createMany: mocks.attemptCreateMany, updateMany: mocks.attemptUpdateMany },
      auditPipelineEvent: { create: vi.fn(async () => ({})) },
      flag: { create: mocks.flagCreate },
    }),
    runRequest: {
      findFirst: mocks.runFindFirst,
      updateMany: mocks.runUpdateMany,
    },
    outcomeBindingExecution: {
      findUnique: mocks.executionFindUnique,
      create: mocks.executionCreate,
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

vi.mock('@/lib/audit/screenshot', () => ({ getBrowser: async () => ({}) }))
vi.mock('@/lib/audit/browser/page-session', () => ({ createAuditPage: mocks.createAuditPage }))
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
        authorizationRevision: 1,
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
    mocks.executionCreate.mockResolvedValue({ id: 'execution-1' })
    mocks.attemptFindFirst.mockResolvedValue(null)
    mocks.attemptCreateMany.mockResolvedValue({ count: 1 })
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 })
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.flagCreate.mockResolvedValue({ id: 'flag-1' })
    mocks.auditFindUnique.mockResolvedValue({ htmlMetadata: { pageText: 'Unrelated old capture must never be read.' } })
    const frame = {}, page = { evaluate: async () => ({ text: 'Example page is ready.', html: '<main>Example page is ready.</main>', url: 'https://example.net/' }),
      url: () => 'https://example.net/', context: () => ({ close: async () => {} }), mainFrame: () => frame, off: vi.fn(),
      on: (_: string, listener: (response: unknown) => void) => listener({ status: () => 200, headers: () => ({}), url: () => 'https://example.net/',
        frame: () => frame, request: () => ({ isNavigationRequest: () => true }) }) }
    mocks.createAuditPage.mockImplementation(async (_browser, _url, options) => {
      options.onNavigationStart(page, Date.now())
      return { httpStatus: 200, responseHeaders: {}, page, disposeNetwork: vi.fn() }
    })
  })

  it('records a successful public response and that is the only Clear', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })))

    await expect(runBoundCheckoutForAudit('audit-1')).resolves.toBe(true)

    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
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
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'BLOCKED', reason: 'request_failed' }),
    }))
    expect(assessRequiredBindings([binding], [
      { key: binding.key, disposition: 'BLOCKED', reason: 'request_failed' },
    ]).state).toBe('COULD_NOT_VERIFY')

    mocks.executionCreate.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })))
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.flagCreate).toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'FAILED', reason: 'http_unavailable' }),
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
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'SUCCEEDED', reason: 'available' }),
    }))
  })

  it('confirms a missing expected surface before opening a Flag', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      selections: [{
        outcome: {
          id: 'page-1',
          authorizationRevision: 1,
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
      data: expect.objectContaining({ fingerprint: `outcome:v1:page-1:${binding.key}` }),
    }))
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'FAILED', reason: 'expected_surface_missing' }),
    }))
  })

  it('treats a bot wall as Couldn\'t verify and does not retry it', async () => {
    const fetchMock = vi.fn(async () => new Response('Checking your browser before accessing', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await runBoundCheckoutForAudit('audit-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'BLOCKED', reason: 'bot_wall' }),
    }))
    expect(assessRequiredBindings([binding], [
      { key: binding.key, disposition: 'BLOCKED', reason: 'bot_wall' },
    ]).state).toBe('COULD_NOT_VERIFY')
  })

  it.each([401, 403, 429])('keeps an ordinary HTTP %s access restriction unknown instead of opening an outage', async status => {
    const fetchMock = vi.fn(async () => new Response('The request is not permitted.', { status }))
    vi.stubGlobal('fetch', fetchMock)
    await runBoundCheckoutForAudit('audit-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      disposition: 'BLOCKED', reason: 'access_restricted', detail: expect.objectContaining({ status, source: 'public-http' }),
    }) }))
    expect(assessRequiredBindings([binding], [{ key: binding.key, disposition: 'BLOCKED', reason: 'access_restricted' }]).state)
      .toBe('COULD_NOT_VERIFY')
  })

  it('checks a healthy page containing Cloudflare and CAPTCHA resources instead of declaring a wall', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<title>Example</title><script src="https://static.cloudflareinsights.com/beacon.min.js"></script><div class="cf-turnstile">Captcha</div>', { status: 200 })))
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.createAuditPage).toHaveBeenCalledOnce()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ disposition: 'SUCCEEDED', reason: 'available' }) }))
  })

  it('does not certify a 200 challenge response as availability', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<title>Example</title>', { status: 200, headers: { 'cf-mitigated': 'challenge' } })))
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ disposition: 'BLOCKED', reason: 'bot_wall' }) }))
  })

  it('confirms a genuine error page mentioning Cloudflare as a failure', async () => {
    const fetchMock = vi.fn(async () => new Response('<title>Service unavailable</title><p>Please try later</p><footer>Cloudflare</footer>', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    await runBoundCheckoutForAudit('audit-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mocks.flagCreate).toHaveBeenCalledOnce()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ disposition: 'FAILED', reason: 'http_unavailable' }) }))
  })

  it('treats a successful response with no rendered capture as Couldn\'t verify', async () => {
    mocks.createAuditPage.mockRejectedValueOnce(new Error('Browser interrupted'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })))

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'BLOCKED', reason: 'rendered_surface_unavailable' }),
    }))
  })
})
