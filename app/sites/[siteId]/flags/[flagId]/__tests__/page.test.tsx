import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import SiteFlagPage from '../page'

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
  beforeEach(() => {
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'viewer', site: { siteId: 'site-1' } },
    })
    mocks.loadSiteHome.mockResolvedValue({
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
    expect(screen.getByRole('heading', { name: 'Fix and verify' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy fix prompt' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Verify fix' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Verification history' })).toBeVisible()
    expect(
      screen.getByRole('link', {
        name: /https:\/\/shop\.example\/products\/tote/,
      }),
    ).toHaveAttribute('href', 'https://shop.example/products/tote')
  })
})
