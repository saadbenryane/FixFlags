import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fixtureFindFirst: vi.fn(),
  getBrowser: vi.fn(),
  createAuditPage: vi.fn(),
  fill: vi.fn(),
  click: vi.fn(),
  isVisible: vi.fn(),
  close: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: { outcomeFixture: { findFirst: mocks.fixtureFindFirst } } }))
vi.mock('@/lib/security/crypto', () => ({ decryptSecret: (value: string) => value }))
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
    vi.clearAllMocks()
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
