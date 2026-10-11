import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  owner: vi.fn(), admitted: vi.fn(), eventFindFirst: vi.fn(), eventCreate: vi.fn(), fixtureFindUnique: vi.fn(), fixtureFindFirst: vi.fn(),
  assertPublicUrl: vi.fn(),
  getBrowser: vi.fn(),
  createAuditPage: vi.fn(),
  fill: vi.fn(),
  click: vi.fn(),
  isVisible: vi.fn(),
  close: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { outcomeFixture: { findFirst: mocks.fixtureFindFirst, findUniqueOrThrow: mocks.fixtureFindUnique },
  audit: { findFirst: mocks.admitted }, auditPipelineEvent: { findFirst: mocks.eventFindFirst, create: mocks.eventCreate },
  $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ outcomeFixture: { findFirst: mocks.fixtureFindFirst } }),
} }))
vi.mock('@/lib/audit/execution-ownership', async () => {
  const { prisma } = await import('@/lib/db')
  return { currentExecutionOwnership: mocks.owner, executionWrite: (work: (tx: typeof prisma) => unknown) => work(prisma),
    executionTransaction: (work: (tx: typeof prisma) => unknown) => work(prisma) }
})
vi.mock('@/lib/security/crypto', () => ({ decryptSecret: (value: string) => value }))
vi.mock('@/lib/audit/url', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/audit/url')>(), assertPublicAuditUrl: mocks.assertPublicUrl,
}))
vi.mock('@/lib/audit/screenshot', () => ({ getBrowser: mocks.getBrowser }))
vi.mock('@/lib/audit/browser/page-session', () => ({ createAuditPage: mocks.createAuditPage }))

import { executeSafeFormFixture } from '@/lib/sites/application/safe-form-executor'

const fixture = {
  id: 'fixture-1',
  projectId: 'site-1',
  targetUrl: 'https://example.com/signup',
  resetUrl: 'https://example.com/test/reset',
  cleanupUrl: 'https://example.com/test/cleanup',
  encryptedHookSecret: 'hook-secret',
  encryptedValues: JSON.stringify({ email: 'synthetic@example.test' }),
  fieldMapping: {
    fields: { email: { by: 'label', value: 'Email' } },
    submit: { by: 'role', role: 'button', value: 'Create account' },
  },
  successCriterion: { type: 'text', value: 'Check your inbox' },
  authorizedAt: new Date(),
  version: 1,
  lastDryRunVersion: 1,
}

describe('Safe Form executor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.assertPublicUrl.mockImplementation(async (url: string) => new URL(url))
    mocks.owner.mockReturnValue(null)
    mocks.fixtureFindUnique.mockResolvedValue(fixture)
    mocks.eventFindFirst.mockResolvedValue(null)
    mocks.eventCreate.mockResolvedValue({})
    mocks.fixtureFindFirst.mockResolvedValue(fixture)
    mocks.getBrowser.mockResolvedValue({})
    mocks.fill.mockResolvedValue(undefined)
    mocks.click.mockResolvedValue(undefined)
    mocks.isVisible.mockResolvedValue(true)
    mocks.close.mockResolvedValue(undefined)
    const locator = { first: () => ({ fill: mocks.fill, click: mocks.click, isVisible: mocks.isVisible }) }
    mocks.createAuditPage.mockResolvedValue({
      page: {
        getByLabel: () => locator,
        getByPlaceholder: () => locator,
        getByRole: () => locator,
        getByText: () => locator,
        url: () => 'https://example.com/signup',
        context: () => ({ close: mocks.close }),
      },
    })
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('bounds hook DNS resolution and never resets after its deadline', async () => {
    const controller = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    let resolveDns!: (url: URL) => void
    mocks.assertPublicUrl.mockImplementationOnce(() => new Promise<URL>(resolve => { resolveDns = resolve }))
    vi.stubGlobal('fetch', vi.fn())
    const pending = executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id,
      startUrl: fixture.targetUrl, allowLocalhost: false })
    await vi.waitFor(() => expect(mocks.assertPublicUrl).toHaveBeenCalledTimes(1))
    controller.abort()
    expect(await pending).toMatchObject({ reason: 'fixture_reset_unproven' })
    resolveDns(new URL(fixture.resetUrl))
    await Promise.resolve()
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.getBrowser).not.toHaveBeenCalled()
  })

  it('checks current fixture consent after resolving the reset hook', async () => {
    mocks.owner.mockReturnValue({ auditId: 'current', taskId: 'current-task', generation: 1 })
    mocks.assertPublicUrl.mockImplementationOnce(async (url: string) => {
      mocks.fixtureFindFirst.mockResolvedValue(null)
      return new URL(url)
    })
    vi.stubGlobal('fetch', vi.fn())
    const result = await executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id,
      startUrl: fixture.targetUrl, allowLocalhost: false })
    expect(result.reason).toBe('fixture_reset_unproven')
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.getBrowser).not.toHaveBeenCalled()
  })

  it('refuses an authorization bypass without durable setup consent', async () => {
    const result = await executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id, startUrl: fixture.targetUrl,
      allowLocalhost: false, requireAuthorization: false })
    expect(result.reason).toBe('fixture_setup_not_admitted')
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('executes an admitted exact-version setup once and records cleanup before certification', async () => {
    mocks.owner.mockReturnValue({ auditId: 'setup', taskId: 'setup-task', generation: 1 })
    mocks.fixtureFindFirst.mockResolvedValue({ ...fixture, authorizedAt: null, lastDryRunVersion: null })
    mocks.admitted.mockResolvedValue({ executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: fixture.targetUrl,
      environment: 'production', scope: 'FIXTURE_SETUP', fixtureSetup: { id: fixture.id, version: 1 }, checks: {}, outcomes: [], verificationTarget: null } })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })))
    const result = await executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id, startUrl: fixture.targetUrl,
      allowLocalhost: false, requireAuthorization: false, expectedVersion: 1 })
    expect(result).toMatchObject({ disposition: 'SUCCEEDED', detail: { cleanupStatus: 'succeeded' } })
    expect(mocks.click).toHaveBeenCalledTimes(1)
    expect(mocks.eventCreate.mock.calls.map(call => call[0].data.event)).toEqual(['protected_submission_admitted', 'protected_cleanup_completed'])
  })

  it('refuses an unresolved submission from a previous Audit before reset or another click', async () => {
    mocks.owner.mockReturnValue({ auditId: 'current', taskId: 'current-task', generation: 1 })
    mocks.eventFindFirst.mockResolvedValueOnce({ detail: { operationId: 'previous:g2', fixtureId: fixture.id, fixtureVersion: 1 } }).mockResolvedValueOnce(null)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })))
    const result = await executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id, startUrl: fixture.targetUrl, allowLocalhost: false })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'protected_effect_unresolved' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(fixture.cleanupUrl, expect.objectContaining({ body: JSON.stringify({ fixtureId: fixture.id, operationId: 'previous:g2' }) }))
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('can proceed only after cleanup acknowledges the same settled previous operation', async () => {
    mocks.owner.mockReturnValue({ auditId: 'current', taskId: 'current-task', generation: 1 })
    mocks.eventFindFirst.mockResolvedValueOnce({ detail: { operationId: 'previous:g2', fixtureId: fixture.id, fixtureVersion: 1 } }).mockResolvedValueOnce(null)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ ok: true, settled: true, operationId: 'previous:g2' }))
      .mockImplementation(async () => Response.json({ ok: true })))
    const result = await executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id, startUrl: fixture.targetUrl, allowLocalhost: false })
    expect(result.disposition).toBe('SUCCEEDED')
    expect(mocks.click).toHaveBeenCalledTimes(1)
    expect(mocks.eventCreate.mock.calls[0][0].data).toMatchObject({ event: 'protected_cleanup_completed', executionId: 'previous:g2' })
  })

  it('does not replay an interrupted operation through edited fixture hooks', async () => {
    mocks.owner.mockReturnValue({ auditId: 'current', taskId: 'current-task', generation: 1 })
    mocks.eventFindFirst.mockResolvedValueOnce({ detail: { operationId: 'previous:g2', fixtureId: fixture.id, fixtureVersion: 2 } }).mockResolvedValueOnce(null)
    vi.stubGlobal('fetch', vi.fn())
    const result = await executeSafeFormFixture({ projectId: 'site-1', fixtureId: fixture.id, startUrl: fixture.targetUrl, allowLocalhost: false })
    expect(result.reason).toBe('protected_effect_unresolved')
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.click).not.toHaveBeenCalled()
  })

  it('does not submit when the pre-run reset cannot be proven', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })))
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_reset_unproven' })
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('submits once and requires successful cleanup before reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'SUCCEEDED', reason: 'success_criterion_observed', detail: { cleanupStatus: 'succeeded' } })
    expect(mocks.click).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('blocks cross-origin reset or cleanup hooks', async () => {
    mocks.fixtureFindFirst.mockResolvedValue({ ...fixture, cleanupUrl: 'https://other.example/cleanup' })
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_hook_origin_mismatch' })
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('will not submit a form the customer has not authorized', async () => {
    mocks.fixtureFindFirst.mockResolvedValue({ ...fixture, authorizedAt: null })
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_not_authorized' })
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('will not submit a form bound to a different target than the Site authorized', async () => {
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: 'https://example.com/other-form', allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_target_mismatch' })
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('blocks a form whose encrypted values cannot be read instead of guessing', async () => {
    mocks.fixtureFindFirst.mockResolvedValue({ ...fixture, encryptedValues: '{not json' })
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_secret_unavailable' })
    expect(mocks.createAuditPage).not.toHaveBeenCalled()
  })

  it('Flags a submitted form that does not show its success criterion', async () => {
    mocks.isVisible.mockResolvedValue(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({
      disposition: 'FAILED',
      reason: 'success_text_missing',
      detail: { cleanupStatus: 'succeeded' },
    })
    // A failed submission is still cleaned up, and is never blindly resubmitted.
    expect(mocks.click).toHaveBeenCalledTimes(1)
  })

  it('does not report a result when cleanup cannot be proven', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ disposition: 'BLOCKED', reason: 'fixture_cleanup_unproven', detail: { cleanupStatus: 'failed' } })
  })

  it('refuses a form that submits away from the authorized origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
    mocks.createAuditPage.mockResolvedValue({
      page: {
        getByLabel: () => ({ first: () => ({ fill: mocks.fill, click: mocks.click, isVisible: mocks.isVisible }) }),
        getByPlaceholder: () => ({ first: () => ({ fill: mocks.fill, click: mocks.click, isVisible: mocks.isVisible }) }),
        getByRole: () => ({ first: () => ({ fill: mocks.fill, click: mocks.click, isVisible: mocks.isVisible }) }),
        getByText: () => ({ first: () => ({ isVisible: mocks.isVisible }) }),
        url: () => 'https://elsewhere.example/redirected',
        context: () => ({ close: mocks.close }),
      },
    })
    const result = await executeSafeFormFixture({
      projectId: 'site-1', fixtureId: 'fixture-1', startUrl: fixture.targetUrl, allowLocalhost: false,
    })
    expect(result).toMatchObject({ reason: 'form_left_authorized_origin' })
  })
})
