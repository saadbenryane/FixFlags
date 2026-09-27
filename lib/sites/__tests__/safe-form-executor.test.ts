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
  fieldMapping: { fields: { email: '#email' }, submit: 'button[type=submit]' },
  successCriterion: { type: 'text', value: 'Check your inbox' },
  authorizedAt: new Date(),
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
        locator: () => locator,
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
})
