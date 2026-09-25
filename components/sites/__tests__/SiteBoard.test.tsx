import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteBoard } from '../SiteBoard'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import { AUDIT_ERRORS, CARE_HOME } from '@/lib/marketing/copy'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

const SITE_PATH = '/sites/p_example'

const push = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => SITE_PATH,
}))

const signedInUser = {
  id: 'u1',
  email: 'owner@example.com',
  plan: 'FREE',
} as MeUser

function card(partial: Partial<BoardCardView> & Pick<BoardCardView, 'id' | 'name' | 'state'>): BoardCardView {
  return {
    question: partial.question ?? 'Checked area',
    status: partial.status ?? 'Not checked yet',
    answer: partial.answer ?? 'Not checked yet',
    detail: null,
    facts: [],
    coverage: null,
    score: null,
    openFlagCount: 0,
    checkedAt: null,
    flagIds: [],
    flagChips: [],
    sources: ['FixFlags browser'],
    activity: null,
    wide: partial.id === 'site',
    captureUrl: null,
    captureAlt: null,
    cropUrl: null,
    cropAlt: null,
    problem: null,
    ...partial,
  }
}

function boardView(overrides: Partial<SiteHomeView> = {}): SiteHomeView {
  return {
    site: {
      siteId: 'p_example',
      kind: 'provisional',
      url: 'https://example.com',
      canonicalHost: 'example.com',
      name: 'example.com',
      projectId: null,
      provisionalSiteId: 'example',
      primaryAuditId: 'audit-1',
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId: null,
    },
    host: 'example.com',
    statusLabel: '1 Flag',
    statusState: 'attention',
    audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, score: 80, walkFinished: false, failureCode: null },
    cards: [
      card({ id: 'site', name: 'Pages', state: 'attention', answer: '2 Flags', status: 'Needs a fix' }),
      card({
        id: 'conversion',
        name: 'Conversion',
        state: 'problem',
        answer: 'Headline does not convey usage context',
        status: 'Needs a fix',
        openFlagCount: 1,
      }),
      card({
        id: 'search',
        name: 'Search',
        state: 'attention',
        answer: 'Meta description is missing',
        status: 'Needs a fix',
        openFlagCount: 1,
      }),
      card({
        id: 'performance',
        name: 'Performance',
        state: 'healthy',
        answer: 'Looking good',
        status: '0 Flags',
      }),
      card({ id: 'security', name: 'Security', state: 'unknown', answer: SITE_BOARD_COPY.notCheckedYet }),
      card({ id: 'tracking', name: 'Tracking', state: 'unknown', answer: SITE_BOARD_COPY.notCheckedYet }),
      card({ id: 'uptime', name: 'Uptime', state: 'unknown', answer: SITE_BOARD_COPY.notCheckedYet }),
      card({ id: 'accessibility', name: 'Accessibility', state: 'unknown', answer: SITE_BOARD_COPY.notCheckedYet }),
    ],
    flags: [],
    recommendations: [],
    outcomes: [],
    watching: false,
    watch: {
      state: 'off',
      interval: null,
      nextRunAt: null,
      lastError: null,
      covered: false,
      label: 'Not watching',
    },
    coverageSummary: 'Checked recently · 0 open Flags',
    ...overrides,
  }
}

function renderBoard(user: MeUser | null, activeView: 'home' | 'settings' = 'home') {
  return render(
    <MeProvider initialUser={user}>
      <SiteBoard siteId="p_example" initial={boardView()} activeView={activeView} />
    </MeProvider>
  )
}

describe('SiteBoard chrome', () => {
  it('offers to watch the page after a finished walk with no Outcome', () => {
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, score: 80, walkFinished: true, failureCode: null },
          })}
          activeView="home"
        />
      </MeProvider>
    )
    expect(screen.getByRole('heading', { name: 'No Outcome yet' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirm this page' })).toBeVisible()
    expect(screen.getByText(/did not confirm a purchase path/)).toBeVisible()
  })

  it('confirms the page and does not say a watch schedule started', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => boardView(),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, score: 80, walkFinished: true, failureCode: null },
          })}
        />
      </MeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this page' }))
    expect(await screen.findByText('This page is confirmed')).toBeVisible()
    expect(screen.queryByText(/outcome saved/i)).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/p_example/outcomes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ watchPage: true }),
      }),
    )
    vi.unstubAllGlobals()
  })

  it('shows This page loads before the board reload finishes', async () => {
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const outcome = {
      id: 'out-1',
      name: 'This page loads',
      slug: 'page-loads',
      description: null,
      inferenceSource: 'user' as const,
      confirmedAt: '2026-09-24T00:00:00.000Z',
      pageIds: [],
      pageUrls: ['https://example.com'],
      kind: 'AVAILABILITY' as const,
      criticality: 'IMPORTANT' as const,
      environment: 'production',
      expectation: 'The public page responds successfully.',
      bindings: [{ key: 'availability', required: true, scope: null }],
      coverage: null,
      state: 'COULD_NOT_VERIFY' as const,
      summary: 'Not verified yet.',
      lastVerifiedAt: null,
      validUntil: null,
      flagId: null,
      latestRunId: null,
      running: false,
    }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/outcomes')) {
        return { ok: true, status: 200, json: async () => ({ ok: true, outcome }) }
      }
      await refreshGate
      return { ok: true, status: 200, json: async () => boardView() }
    }))
    const view = render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, score: 80, walkFinished: true, failureCode: null },
            flags: [{
              id: 'f1',
              sourceFlagId: 'f1',
              confidence: null,
              improvementId: null,
              checkId: 'meta-description-missing',
              rubric: 'REACH',
              severity: 'IMPORTANT',
              impactTag: 'SEO',
              problem: 'Meta description is missing',
              evidence: 'The page has no meta description.',
              whyItMatters: 'Search results have less to show.',
              fix: 'Add a meta description.',
              pageUrl: 'https://example.com',
              status: 'OPEN',
              area: 'search',
            }],
          })}
        />
      </MeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this page' }))
    expect(await screen.findByRole('heading', { name: 'This page loads' })).toBeVisible()
    expect(screen.queryByText('No Outcome yet')).not.toBeInTheDocument()
    expect(screen.getByText('The Flags that need you.')).toBeVisible()
    expect(screen.queryByText(/watching/i)).not.toBeInTheDocument()
    releaseRefresh()
    view.unmount()
    vi.unstubAllGlobals()
  })

  it('sends an unsigned visitor to sign in when confirming the page is refused', async () => {
    push.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, score: 80, walkFinished: true, failureCode: null },
          })}
        />
      </MeProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this page' }))
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/sign-in?next=${encodeURIComponent(SITE_PATH)}`)
    })
    vi.unstubAllGlobals()
  })

  it('shows a failed check as failed and retries that check', async () => {
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/retry')) {
        return { ok: true, json: async () => ({ status: 'QUEUED' }) }
      }
      expect(init?.cache).toBe('no-store')
      await refreshGate
      return {
        ok: true,
        json: async () => boardView({
          statusLabel: 'Learning your website',
          statusState: 'checking',
          coverageSummary: 'Learning your website. Cards update as each area finishes.',
          audit: { id: 'audit-1', status: 'QUEUED', progress: 0, score: null, walkFinished: false, failureCode: null },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            statusLabel: 'Couldn’t verify',
            statusState: 'unknown',
            coverageSummary: 'This check did not finish',
            audit: {
              id: 'audit-1',
              status: 'FAILED',
              progress: 0,
              score: null,
              walkFinished: false,
              failureCode: 'SITE_UNREACHABLE',
            },
          })}
        />
      </MeProvider>
    )

    expect(screen.getByText('Check failed')).toBeVisible()
    expect(screen.getByText(AUDIT_ERRORS.unreachable)).toBeVisible()
    expect(screen.getByText('This check did not finish')).toBeVisible()
    expect(screen.queryByText('Learning your website')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/reports/audit-1/retry', { method: 'POST' })
    })
    await waitFor(() => {
      expect(screen.queryByText('Check failed')).not.toBeInTheDocument()
    })
    expect(screen.getAllByText('Learning your website').length).toBeGreaterThan(0)
    releaseRefresh()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_example', { cache: 'no-store' })
    })
    view.unmount()
    vi.unstubAllGlobals()
  })

  it('shows a skipped written summary without a failed-check retry', () => {
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            audit: {
              id: 'audit-1',
              status: 'COMPLETED',
              progress: 100,
              score: 80,
              walkFinished: true,
              failureCode: 'AI_PROVIDER_NOT_CONFIGURED',
            },
          })}
        />
      </MeProvider>
    )
    expect(screen.getByRole('status').textContent).toBe(
      'The written summary did not run. The Flags below come from the browser check.'
    )
    expect(screen.queryByText('Check failed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.getByText('Headline does not convey usage context')).toBeVisible()
  })

  it('names a Flag by its card and severity, not the internal ids', () => {
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            flags: [{
              id: 'flag-1',
              improvementId: null,
              checkId: 'meta-description',
              rubric: 'REACH',
              severity: 'IMPORTANT',
              impactTag: null,
              problem: 'Meta description is missing',
              evidence: 'The page has no meta description.',
              whyItMatters: 'Search results invent a snippet.',
              fix: 'Add a meta description.',
              pageUrl: 'https://example.com/',
              status: 'OPEN',
              area: 'search',
            }],
          })}
        />
      </MeProvider>
    )
    expect(screen.getByText('Search · Important Flag')).toBeVisible()
    expect(screen.queryByText(/search · important/)).not.toBeInTheDocument()
  })

  it('shows Sign in with a next path for logged-out visitors', () => {
    renderBoard(null)
    const links = screen.getAllByRole('link', { name: CARE_HOME.signIn })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `/sign-in?next=${encodeURIComponent(SITE_PATH)}`
      )
      expect(link).toHaveClass('bg-brand', 'text-brand-foreground')
    }
    expect(screen.queryByRole('link', { name: 'All Sites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep watching' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm this page' })).not.toBeInTheDocument()
    expect(screen.queryByText('Not watching')).not.toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Site' })
    expect(rail).toBeInTheDocument()
    expect(rail).toHaveTextContent('Home')
    expect(rail).toHaveTextContent('Flags')
    expect(rail).toHaveTextContent('Settings')
    const settingsLinks = screen.getAllByRole('link', { name: 'Settings' })
    expect(settingsLinks.length).toBeGreaterThan(0)
    for (const link of settingsLinks) {
      expect(link).toHaveAttribute('href', '/sites/p_example/settings')
    }
    expect(screen.queryByRole('link', { name: 'More' })).not.toBeInTheDocument()
    expect(rail).not.toHaveTextContent('Not watching')
    expect(rail).not.toHaveTextContent('Keep watching')
    expect(rail).not.toHaveTextContent('All Sites')
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.addCard })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Security' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tracking' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conversion' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Performance' })).toBeInTheDocument()
  })

  it('clears empty coverage rows on Settings for logged-out visitors', () => {
    renderBoard(null, 'settings')
    expect(screen.getByRole('heading', { name: 'Site settings' })).toBeInTheDocument()
    expect(screen.getByText('Conversion')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.queryByText('Security')).not.toBeInTheDocument()
    expect(screen.queryByText('Tracking')).not.toBeInTheDocument()
    expect(screen.queryByText('Uptime')).not.toBeInTheDocument()
    expect(screen.queryByText('Accessibility')).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.notCheckedYet)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep watching' })).not.toBeInTheDocument()
  })

  it('keeps watch and All Sites for signed-in owners', () => {
    renderBoard(signedInUser)
    expect(screen.queryByRole('link', { name: CARE_HOME.signIn })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'All Sites' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Watch settings' })).toHaveAttribute('href', `${SITE_PATH}/settings`)
    expect(screen.getByText('Not watching')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.addCard })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tracking' })).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'Settings' })) {
      expect(link).toHaveAttribute('href', `${SITE_PATH}/settings`)
    }
  })
})
