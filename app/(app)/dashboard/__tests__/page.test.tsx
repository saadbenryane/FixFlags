import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MeProvider } from '@/hooks/useMe'
import DashboardPage from '@/app/(app)/dashboard/page'

const mocks = vi.hoisted(() => ({
  getAppViewer: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`)
  }),
  loadSiteSummaries: vi.fn(),
  startScanWithHandoff: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/app-viewer', () => ({ getAppViewer: mocks.getAppViewer }))
vi.mock('@/lib/sites/application/list-sites', () => ({
  loadSiteSummaries: mocks.loadSiteSummaries,
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff: mocks.startScanWithHandoff,
  trackStartedAudit: vi.fn(),
}))

vi.mock('@/components/dashboard/DashboardCheckoutToast', () => ({
  DashboardCheckoutToast: () => null,
}))
vi.mock('@/components/sites/SitesOverviewGrid', () => ({
  SitesOverviewGrid: () => null,
}))

// The page relies on app/(app)/layout.tsx for the MeProvider in the real app.
async function renderPage(searchParams: { url?: string | string[] }) {
  const element = await DashboardPage({ searchParams: Promise.resolve(searchParams) })
  return render(
    <MeProvider initialUser={{ id: 'owner-1', email: 'a@b.com', plan: 'FREE' } as never}>
      {element}
    </MeProvider>,
  )
}

describe('/dashboard handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.startScanWithHandoff.mockResolvedValue({ ok: true, siteId: 'site-1' })
    mocks.getAppViewer.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.loadSiteSummaries.mockResolvedValue([])
  })

  it('redirects an unauthenticated viewer to sign-in', async () => {
    mocks.getAppViewer.mockResolvedValue(null)
    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('REDIRECT:/sign-in')
  })

  it('resumes the handed-off URL by starting the scan exactly once', async () => {
    await renderPage({ url: 'https://example.com' })

    await waitFor(() => expect(mocks.startScanWithHandoff).toHaveBeenCalledTimes(1))
    expect(mocks.startScanWithHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        body: expect.objectContaining({ url: 'https://example.com', source: 'dashboard' }),
      })
    )
  })

  it('keeps the URL visible so the customer can see what is being scanned', async () => {
    await renderPage({ url: 'https://example.com' })

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    )
    // The field is locked only while the resumed scan is in flight.
    expect(screen.getByRole('button', { name: /Analyzing/i })).toBeDisabled()
  })

  it('ignores an uncheckable handoff URL rather than offering a dead scan', async () => {
    await renderPage({ url: 'http://localhost:3000' })

    await waitFor(() => expect(screen.getByText('Your Sites')).toBeInTheDocument())
    expect(mocks.startScanWithHandoff).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Website URL' })).not.toBeInTheDocument()
  })

  it('starts no scan when no handoff URL is present', async () => {
    await renderPage({})

    await waitFor(() => expect(screen.getByText('Your Sites')).toBeInTheDocument())
    expect(mocks.startScanWithHandoff).not.toHaveBeenCalled()
  })
})
