import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { verificationResultLabel } from '@/lib/sites/presentation'
import SiteFlagPage from '../page'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

const ATTEMPTED = '2026-09-23T22:57:11.000Z'

const mocks = vi.hoisted(() => ({
  currentSiteViewer: vi.fn(),
  requestedPath: vi.fn(),
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
  currentSiteViewer: mocks.currentSiteViewer,
  requireSiteAccess: mocks.requireSiteAccess,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/', useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  redirect: (href: string) => { throw new Error('NEXT_REDIRECT:' + href) },
}))

vi.mock('@/lib/auth/redirect-path', () => ({ getRequestedPath: mocks.requestedPath,
  signInUrl: (path: string) => '/sign-in?next=' + encodeURIComponent(path) }))

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
  SiteShell: ({ children, title }: { children: ReactNode; title?: string }) => (
    <div>
      {title ? <h1>{title}</h1> : null}
      {children}
    </div>
  ),
}))

vi.mock('@/components/sites/SiteFlagDetailRefresh', () => ({ SiteFlagDetailRefresh: ({ siteId, flagId, sourceFlagId }: { siteId: string; flagId: string; sourceFlagId: string }) =>
  <span data-testid="live-flag-detail" data-site={siteId} data-flag={flagId} data-source={sourceFlagId} /> }))

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
    vi.clearAllMocks()
    mocks.currentSiteViewer.mockResolvedValue({ userId: 'user-1' })
    mocks.requestedPath.mockImplementation(async fallback => fallback)
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

  it.each(['site-1', 'unknown-site'])('preserves an anonymous notification destination for %s before revealing evidence', async siteId => {
    mocks.requireSiteAccess.mockResolvedValue({ ok: false, status: 404 })
    mocks.currentSiteViewer.mockResolvedValue({ userId: null })
    mocks.requestedPath.mockResolvedValue(`/sites/${siteId}/flags/flag-1?source=watch-email`)
    await expect(SiteFlagPage({ params: Promise.resolve({ siteId, flagId: 'flag-1' }),
      searchParams: Promise.resolve({ source: 'watch-email' }) })).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?next=' + encodeURIComponent(`/sites/${siteId}/flags/flag-1?source=watch-email`))
    expect(mocks.loadSiteBoardFlag).not.toHaveBeenCalled()
    expect(mocks.loadSiteHome).not.toHaveBeenCalled()
  })

  it('keeps a foreign authenticated notification private', async () => {
    mocks.requireSiteAccess.mockResolvedValue({ ok: false, status: 404 })
    await expect(SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }),
      searchParams: Promise.resolve({ source: 'watch-email' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.loadSiteBoardFlag).not.toHaveBeenCalled()
  })

  it('retains an ordinary private link through sign-in', async () => {
    mocks.requireSiteAccess.mockResolvedValue({ ok: false, status: 404 })
    mocks.currentSiteViewer.mockResolvedValue({ userId: null })
    await expect(SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }),
      searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT:/sign-in?next=%2Fsites%2Fsite-1%2Fflags%2Fflag-1')
    expect(mocks.loadSiteBoardFlag).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'pages view', view: 'pages', label: 'Pages', href: '/sites/site-1?view=pages#pages' },
    { name: 'timeline view', view: 'timeline', label: 'Timeline', href: '/sites/site-1?view=timeline#timeline' },
    { name: 'home view', view: 'home', label: 'Overview', href: '/sites/site-1' },
    { name: 'search category view', view: 'home', category: 'search', label: 'Overview', href: '/sites/site-1?category=search#category-search' },
  ])('returns full Flag details to the originating $label workspace from the $name', async ({ view, category, label, href }) => {
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({ view, category }) }))
    expect(screen.getByRole('link', { name: C.backTo(label) })).toHaveAttribute('href', href)
  })

  it('keeps the established category return for a direct notification or shared link', async () => {
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({ source: 'watch-email' }) }))
    expect(screen.getByRole('link', { name: C.backTo(C.overview) })).toHaveAttribute('href', '/sites/site-1?category=conversion#category-conversion')
  })

  it('carries the originating workspace into related verification details', async () => {
    const home = await mocks.loadSiteHome()
    mocks.loadSiteHome.mockResolvedValue({ ...home, outcomes: [{ ...home.outcomes[0], id: 'checkout', name: 'Checkout', flagId: 'flag-1' }] })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({ view: 'pages' }) }))
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/sites/site-1/outcomes/checkout?view=pages')
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
    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.fixStep })).toBeVisible()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Recheck' })).toBeVisible()
    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.verificationHistory })).toBeVisible()
    expect(screen.getByTestId('live-flag-detail')).toHaveAttribute('data-site', 'site-1')
    expect(screen.getByTestId('live-flag-detail')).toHaveAttribute('data-flag', 'flag-1')
    expect(screen.getByTestId('live-flag-detail')).toHaveAttribute('data-source', 'flag-1')
    expect(screen.getByRole('link', { name: C.open('https://shop.example/products/tote') })).toHaveAttribute('href', 'https://shop.example/products/tote')
  })

  it.each(['still_open', 'could_not_verify'])('shows the recorded %s check in the full Flag view', async result => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag,
      verificationFeedback: { result, checkedAt: '2026-11-03T00:00:00.000Z' } } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
    const notice = screen.getByText(result === 'still_open' ? C.flagVerificationStillOpen : C.flagVerificationInconclusive, { exact: false })
    expect(notice).toBeVisible()
    expect(notice.querySelector('time')).toHaveAttribute('datetime', '2026-11-03T00:00:00.000Z')
  })

  it('gives an incomparable historical attempt an uncertain label and icon even if its stored outcome says improved', async () => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag,
      attempts: [{ ...attempt('historical', 'site', 'IMPROVED'), comparable: false }] } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
    const label = screen.getByText(verificationResultLabel('incomparable_scope'))
    expect(label).toBeVisible()
    expect(label.closest('li')?.querySelector('svg')).not.toHaveClass('text-success')
  })

  it('does not give a browser-measured input Flag a PageSpeed provenance or action', async () => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag, area: 'performance',
      checkId: 'mobile-input-zoom', performanceEvidenceSource: null, evidenceContext: { source: 'DETERMINISTIC', references: [] } } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
    expect(screen.queryByText(/Google PageSpeed lab measurement/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Run a new PageSpeed measurement' })).not.toBeInTheDocument()
  })

  it.each(['displayed-capture', 'grouped-incident'])('keeps the requested repair scope when the loaded Flag has an incident identity: %s', async reference => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag,
      id: 'grouped-incident', sourceFlagId: 'displayed-capture' } })
    const fetch = vi.fn(async (_url, options) => Response.json(JSON.parse(options.body).action === 'prepare'
      ? { ok: true, prompt: 'Canonical instructions for the requested scope', sourceFlagId: 'displayed-capture', referenceFlagId: reference, promptHash: 'a'.repeat(64) }
      : { ok: true, prompt: 'Canonical instructions for the requested scope', handoff: {
        flagId: 'displayed-capture', action: 'HANDOFF_COPIED', improvementId: 'grouped-incident', sourceReviewId: 'audit-1',
      } }))
    vi.stubGlobal('fetch', fetch)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: reference }), searchParams: Promise.resolve({}) }))
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/sites/site-1/flags/${reference}/fix`, expect.objectContaining({ body: JSON.stringify({ action: 'copy', promptHash: 'a'.repeat(64) }) })))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Canonical instructions for the requested scope')
    const repairCalls = fetch.mock.calls.filter(([url]) => String(url).endsWith('/fix'))
    expect(repairCalls).toHaveLength(2)
    expect(repairCalls.every(([url]) => url === `/api/sites/site-1/flags/${reference}/fix`)).toBe(true)
  })

  it('does not call an unproven recovery recovered when the completed audit is still on file', async () => {
    vi.mocked(prisma.audit.findFirst).mockResolvedValue({
      id: 'audit-recovery',
      status: 'COMPLETED',
      completedAt: new Date('2026-09-20T17:58:10.414Z'),
      createdAt: new Date('2026-09-20T17:00:00.000Z'),
    } as never)
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({
      ...detail,
      site: { ...detail.site, projectId: 'project-1' },
      flag: { ...detail.flag, status: 'UNVERIFIED', resolvedInId: 'audit-recovery' },
    })
    render(await SiteFlagPage({
      params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }),
      searchParams: Promise.resolve({}),
    }))
    expect(screen.getAllByText(SITE_BOARD_COPY.flagProofMissing).length).toBeGreaterThan(0)
    expect(screen.getByText(SITE_BOARD_COPY.flagProofMissingBody)).toBeVisible()
    expect(screen.getByRole('heading', { name: detail.flag.problem })).toBeVisible()
    expect(screen.queryByRole('heading', { name: SITE_BOARD_COPY.problemRecovered })).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.flagRecovered)).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.checkoutRecovered)).not.toBeInTheDocument()
    expect(prisma.audit.findFirst).not.toHaveBeenCalled()
  })

  it.each([false, true])('presents independently recovered evidence without denying verification, with manual history: %s', async hasManualHistory => {
    vi.mocked(prisma.audit.findFirst).mockResolvedValue({ id: 'audit-recovery', status: 'COMPLETED',
      completedAt: new Date(ATTEMPTED), createdAt: new Date(ATTEMPTED) } as never)
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, site: { ...detail.site, projectId: 'project-1' },
      flag: { ...detail.flag, status: 'FIXED', resolvedInId: 'audit-recovery',
        attempts: hasManualHistory ? [attempt('earlier-manual-check', 'site', 'UNCHANGED')] : [] } })

    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.previousFailure })).toBeVisible()
    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.flagRecovered })).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.noVerificationYet)).not.toBeInTheDocument()
    if (hasManualHistory) {
      expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.verificationHistory })).toBeVisible()
      expect(screen.getByText('Repaired the purchase control.')).toBeVisible()
    } else expect(screen.queryByRole('heading', { name: SITE_BOARD_COPY.verificationHistory })).not.toBeInTheDocument()
  })

  it('sends the visitor who started the check back to the Site results gate before reading the Flag', async () => {
    mocks.requireSiteAccess.mockResolvedValue({ ok: true, decision: { role: 'provisional_session', site: { siteId: 'site-1' } } })
    mocks.loadSiteBoardFlag.mockClear()
    await expect(SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_REDIRECT:/sites/site-1')
    expect(mocks.loadSiteBoardFlag).not.toHaveBeenCalled()
  })

  it('retains its recorded primary page when no additional affected paths were projected', async () => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag, affectedPaths: [] } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
    // The page appears once, beside the back link, as a link to the live page.
    const link = screen.getByRole('link', { name: C.open(detail.flag.pageUrl) })
    expect(link).toHaveAttribute('href', detail.flag.pageUrl)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('/products/tote')
  })

  it.each(['javascript:alert(1)', 'https://user:secret@example.com/', '/relative-page'])('retains an invalid affected address as non-interactive scope: %s', async url => {
    const detail = await mocks.loadSiteBoardFlag()
    mocks.loadSiteBoardFlag.mockResolvedValue({ ...detail, flag: { ...detail.flag, affectedPaths: [url] } })
    render(await SiteFlagPage({ params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }), searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('link', { name: C.open(url) })).toBeNull()
    expect(screen.queryByText('secret', { exact: false })).toBeNull()
    expect(screen.getByText('The cart stayed empty.')).toBeVisible()
  })
})
