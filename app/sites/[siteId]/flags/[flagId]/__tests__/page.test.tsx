import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import SiteFlagPage from '../page'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

const ATTEMPTED = '2026-09-23T22:57:11.000Z'

const mocks = vi.hoisted(() => ({
  requireSiteAccess: vi.fn(),
  loadSiteBoardFlag: vi.fn(),
  loadSiteHome: vi.fn(),
  listSiteOutcomes: vi.fn(),
  loadSiteConnectionViews: vi.fn(),
  recordSiteLifecycleEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { audit: { findFirst: vi.fn() } },
}))

vi.mock('@/lib/sites/request-access', () => ({
  requireSiteAccess: mocks.requireSiteAccess,
}))

vi.mock('@/lib/sites/application/queries', () => ({
  loadSiteBoardFlag: mocks.loadSiteBoardFlag,
  loadSiteHome: mocks.loadSiteHome,
}))

vi.mock('@/lib/sites/outcomes', () => ({
  listSiteOutcomes: mocks.listSiteOutcomes,
}))

vi.mock('@/lib/sites/connections/read', () => ({
  connectionLines: () => [],
  loadSiteConnectionViews: mocks.loadSiteConnectionViews,
}))

vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: mocks.recordSiteLifecycleEvent,
}))

vi.mock('@/components/sites/SiteShell', () => ({
  SiteShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function attempt(id: string, builder: string, outcome: string | null) {
  return {
    id,
    createdAt: ATTEMPTED,
    builder,
    outcome,
    comparable: true,
    reason: null,
    changeSummary: 'Repaired the purchase control.',
    verificationAuditId: null,
  }
}

describe('Flag verification attempts', () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    mocks.recordSiteLifecycleEvent.mockResolvedValue(undefined)
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1' } },
    })
    mocks.loadSiteHome.mockResolvedValue({
      ...siteViewFixture(),
      flags: [],
      watch: { state: 'off', label: 'Off' },
    })
    mocks.listSiteOutcomes.mockResolvedValue([])
    mocks.loadSiteConnectionViews.mockResolvedValue({ facts: [] })
    mocks.loadSiteBoardFlag.mockResolvedValue({
      site: {
        siteId: 'site-1',
        projectId: null,
        userId: 'user-1',
        canonicalHost: 'shop.example',
      },
      flag: {
        id: 'flag-1',
        problem: 'Add to cart did not update the cart.',
        whyItMatters: 'A customer cannot buy.',
        area: 'conversion',
        severity: 'CRITICAL',
        fix: 'Repair Add to cart.',
        verifying: false,
        status: 'OPEN',
        resolvedInId: null,
        sourceAuditId: 'audit-1',
        evidenceMissing: false,
        evidence: 'The cart stayed empty.',
        pageUrl: 'https://shop.example/products/tote',
        viewport: null,
        expectedBehavior: 'The selected product appears in the cart.',
        attempts: [attempt('attempt-site', 'site', 'IMPROVED'), attempt('attempt-copy', 'copy', null), attempt('attempt-unknown', 'custom_signal', 'UNCHANGED')],
      },
    })
  })

  it('names how the attempt was recorded and uses the shared UTC evidence clock', async () => {
    const clock = formatEvidenceTimestamp(ATTEMPTED)
    render(
      await SiteFlagPage({
        params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(screen.getByText('From this Site')).toBeVisible()
    expect(screen.getByText('Copied instructions')).toBeVisible()
    expect(screen.getByText('Recorded attempt')).toBeVisible()
    expect(screen.getAllByText(clock!, { exact: false }).length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/· site\b/)).not.toBeInTheDocument()
    expect(screen.queryByText(/· copy\b/)).not.toBeInTheDocument()
    expect(screen.queryByText(/custom_signal/)).not.toBeInTheDocument()
  })

  it('connects evidence with fix guidance, verification and preserved history', async () => {
    render(
      await SiteFlagPage({
        params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(screen.getByRole('heading', { name: 'What FixFlags saw' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Fix' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy fix prompt' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Check now' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Verification history' })).toBeVisible()
    expect(
      screen.getByRole('link', {
        name: /https:\/\/shop\.example\/products\/tote/,
      }),
    ).toHaveAttribute('href', 'https://shop.example/products/tote')
  })

  it('copies instructions for the displayed capture even when its incident can advance', async () => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag,
      id: 'grouped-incident', sourceFlagId: 'displayed-capture' } })
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, prompt: 'Instructions for the displayed capture', handoff: null }) })
    vi.stubGlobal('fetch', fetch)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'grouped-incident' }), searchParams: Promise.resolve({}) }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy fix prompt' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/sites/site-1/flags/displayed-capture/fix', expect.anything()))
    expect(fetch).not.toHaveBeenCalledWith('/api/sites/site-1/flags/grouped-incident/fix', expect.anything())
  })

  it('keeps anonymous evidence visible while requiring sign-in for fixes and private attempts', async () => {
    mocks.loadSiteHome.mockResolvedValue({ ...siteViewFixture(), actions: siteViewerActions(false) })
    mocks.requireSiteAccess.mockResolvedValue({ ok: true, decision: { role: 'provisional_session', site: { siteId: 'site-1' } } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { name: 'What FixFlags saw' })).toBeVisible()
    expect(screen.getByText('The cart stayed empty.')).toBeVisible()
    expect(screen.queryByText('Repair Add to cart.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy fix prompt' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Verification history' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to copy the fix prompt' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fsite-1%2Fflags%2Fflag-1')
  })
})
