import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteBoard } from '../SiteBoard'
import { SiteSettingsView } from '../SiteSettingsView'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import { AUDIT_ERRORS, CARE_HOME, WATCH_ALERT_DELIVERY, WATCH_OFFER } from '@/lib/marketing/copy'
import { checkoutResultCopy, UNASSESSED_OUTCOME_SUMMARY } from '@/lib/sites/outcome-state'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy/auth'

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
    evidenced: partial.evidenced ?? false,
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
    audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: false, failureCode: null },
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
        answer: 'Desktop speed measured',
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
      alert: { state: 'none', status: null, attempts: 0, at: null },
    },
    coverageSummary: 'Checked recently · 0 open Flags',
    ...overrides,
  }
}

function renderBoard(user: MeUser | null) {
  return render(
    <MeProvider initialUser={user}>
      <SiteBoard siteId="p_example" initial={boardView()} />
    </MeProvider>
  )
}

function watchedOutcome(partial: Partial<SiteOutcomeView> & Pick<SiteOutcomeView, 'name' | 'state' | 'summary'>): SiteOutcomeView {
  return {
    id: 'out-1',
    slug: 'checkout',
    description: null,
    inferenceSource: 'browser',
    confirmedAt: null,
    pageIds: [],
    pageUrls: [],
    kind: 'CHECKOUT',
    criticality: 'CRITICAL',
    environment: 'production',
    enabled: true,
    staleAfterMinutes: 60,
    expectation: 'The selected product appears in the cart and checkout opens.',
    bindings: [{ key: 'checkout-browser-v1', required: true, scope: null, mechanism: 'BROWSER_JOURNEY', version: 1 }],
    coverage: null,
    lastVerifiedAt: '2026-10-05T18:00:00.000Z',
    validUntil: '2026-10-06T18:00:00.000Z',
    flagId: null,
    latestRunId: 'run-1',
    running: false,
    ...partial,
  }
}

describe('SiteBoard chrome', () => {
  it('shows the Checkout assessment on Home and keeps the promise', () => {
    const summary = checkoutResultCopy('no_buy_control').summary
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            outcomes: [watchedOutcome({ name: 'Checkout', state: 'COULD_NOT_VERIFY', summary })],
          })}
        />
      </MeProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeVisible()
    expect(screen.getByText(summary)).toBeVisible()
    expect(screen.getByText('The selected product appears in the cart and checkout opens.')).toBeVisible()
    expect(screen.getByText('Couldn’t verify')).toBeVisible()
  })

  it('keeps an unassessed Outcome on its expectation', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            outcomes: [watchedOutcome({
              name: 'Checkout',
              state: 'COULD_NOT_VERIFY',
              summary: UNASSESSED_OUTCOME_SUMMARY,
              lastVerifiedAt: null,
              validUntil: null,
              latestRunId: null,
            })],
          })}
        />
      </MeProvider>,
    )
    expect(screen.getByText('The selected product appears in the cart and checkout opens.')).toBeVisible()
    expect(screen.queryByText(UNASSESSED_OUTCOME_SUMMARY)).not.toBeInTheDocument()
  })

  it('tells Home that a stale Clear needs a fresh verification', () => {
    const summary = 'FixFlags completed every required check for this Outcome.'
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            outcomes: [watchedOutcome({
              name: 'Page loads',
              kind: 'AVAILABILITY',
              state: 'STALE',
              summary,
              staleAfterMinutes: 11520,
              lastVerifiedAt: '2026-09-23T22:57:02.000Z',
            })],
          })}
        />
      </MeProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Stale')
    expect(screen.getByText(summary)).toBeVisible()
    expect(screen.getByText('Run a fresh verification before relying on this result.')).toBeVisible()
    expect(screen.getByText(/A result stays current for 8 days/)).toBeVisible()
    expect(screen.getByText(/This result is past that window/)).toBeVisible()
  })

  it('keeps a current Clear free of the stale next step', () => {
    const summary = 'FixFlags completed every required check for this Outcome.'
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            outcomes: [watchedOutcome({
              name: 'Page loads',
              kind: 'AVAILABILITY',
              state: 'CLEAR',
              summary,
              staleAfterMinutes: 11520,
            })],
          })}
        />
      </MeProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Clear')
    expect(screen.getByText(summary)).toBeVisible()
    expect(screen.queryByText('Run a fresh verification before relying on this result.')).not.toBeInTheDocument()
    expect(screen.queryByText(/past that window/)).not.toBeInTheDocument()
  })

  it('offers to watch the page after a finished walk with no Outcome', () => {
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: true, failureCode: null },
          })}
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
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: true, failureCode: null },
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
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: true, failureCode: null },
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
    // The intent is that Home never claims Watch is on when it is off. Stated
    // precisely, because the board is allowed to say Watch is NOT on.
    expect(screen.queryByText('Watching weekly')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: WATCH_OFFER.title })).toBeInTheDocument()
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
            audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: true, failureCode: null },
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
          audit: { id: 'audit-1', status: 'QUEUED', progress: 0, walkFinished: false, failureCode: null },
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

  it('orders Settings by customer responsibility and keeps connection cards subordinate', () => {
    render(
      <MeProvider initialUser={null}>
        <SiteSettingsView siteId="p_example" view={boardView()} />
      </MeProvider>
    )
    expect(screen.getByRole('heading', { name: 'Site settings' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Outcomes and fixtures',
      'Watch',
      'Notifications',
      'Connections',
      'Developer access',
      'Danger zone',
    ])
    expect(screen.getByRole('heading', { name: 'Shopify', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Search Console', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Analytics', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Site' })).toBeInTheDocument()
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

  it('keeps optional areas out of the beginner view until FixFlags has evidence', () => {
    renderBoard(null)
    expect(screen.queryByRole('button', { name: 'Uptime' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accessibility' })).not.toBeInTheDocument()
  })

  it('reveals an optional area when a check has evidence for it', () => {
    const cards = boardView().cards.map((item) =>
      item.id === 'uptime'
        ? card({
            id: 'uptime',
            name: 'Uptime',
            state: 'healthy',
            answer: 'Page reached',
            status: 'Checked recently',
            checkedAt: '2026-10-01T10:00:00.000Z',
            evidenced: true,
          })
        : item
    )
    render(
      <MeProvider initialUser={null}>
        <SiteBoard siteId="p_example" initial={boardView({ cards })} />
      </MeProvider>
    )
    expect(screen.getByRole('button', { name: 'Uptime' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Accessibility' })).not.toBeInTheDocument()
  })

  it('keeps stale optional evidence visible instead of turning missing freshness into missing coverage', () => {
    const cards = boardView().cards.map((item) =>
      item.id === 'accessibility'
        ? card({
            id: 'accessibility',
            name: 'Accessibility',
            state: 'unknown',
            answer: SITE_BOARD_COPY.checkOutOfDate,
            status: SITE_BOARD_COPY.checkOutOfDate,
            checkedAt: '2026-09-01T10:00:00.000Z',
            evidenced: true,
          })
        : item
    )
    render(
      <MeProvider initialUser={null}>
        <SiteBoard siteId="p_example" initial={boardView({ cards })} />
      </MeProvider>
    )
    expect(screen.getByRole('button', { name: 'Accessibility' })).toBeVisible()
  })

  it('keeps stale starter evidence visible while hiding areas that were never checked', () => {
    const checkedAt = '2026-09-01T10:00:00.000Z'
    const cards = boardView().cards.map((item) =>
      item.id === 'conversion'
        ? card({
            id: 'conversion',
            name: 'Conversion',
            state: 'unknown',
            answer: SITE_BOARD_COPY.checkOutOfDate,
            status: SITE_BOARD_COPY.checkOutOfDate,
            detail: SITE_BOARD_COPY.checkOutOfDateDetail,
            coverage: SITE_BOARD_COPY.checkOutOfDateDetail,
            checkedAt,
            evidenced: true,
          })
        : item
    )
    render(
      <MeProvider initialUser={null}>
        <SiteBoard siteId="p_example" initial={boardView({ cards })} />
      </MeProvider>
    )

    expect(screen.getByRole('button', { name: 'Conversion' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Security' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(SITE_BOARD_COPY.checkOutOfDateDetail)
    expect(document.querySelector(`time[datetime="${checkedAt}"]`)).not.toBeNull()
  })

  it('lets an owner refresh stale broad evidence through the Site run endpoint', async () => {
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve })
    const checkedAt = '2026-09-01T10:00:00.000Z'
    const cards = boardView().cards.map((item) => item.id === 'conversion'
      ? card({
          id: 'conversion', name: 'Conversion', state: 'unknown',
          answer: SITE_BOARD_COPY.checkOutOfDate, status: SITE_BOARD_COPY.checkOutOfDate,
          coverage: SITE_BOARD_COPY.checkOutOfDateDetail, checkedAt, evidenced: true,
        })
      : item)
    const ownedView = boardView({
      cards,
      site: { ...boardView().site, projectId: 'project-1', userId: signedInUser.id },
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/runs')) {
        return { ok: true, status: 202, json: async () => ({ runId: 'run-1', auditId: 'audit-new', outcomeIds: [] }) }
      }
      await refreshGate
      return { ok: true, status: 200, json: async () => ownedView }
    })
    vi.stubGlobal('fetch', fetchMock)
    const rendered = render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={ownedView} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/p_example/runs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ scope: 'site', outcomeIds: [] }),
      }),
    ))
    expect(await screen.findByText('New check started')).toBeVisible()
    expect(screen.getAllByText('Learning your website').length).toBeGreaterThan(0)
    releaseRefresh()
    rendered.unmount()
    vi.unstubAllGlobals()
  })

  it('asks an anonymous visitor to claim the Site before refreshing stale evidence', () => {
    const cards = boardView().cards.map((item) => item.id === 'conversion'
      ? card({
          id: 'conversion', name: 'Conversion', state: 'unknown',
          answer: SITE_BOARD_COPY.checkOutOfDate, status: SITE_BOARD_COPY.checkOutOfDate,
          coverage: SITE_BOARD_COPY.checkOutOfDateDetail, checkedAt: '2026-09-01T10:00:00.000Z', evidenced: true,
        })
      : item)
    render(
      <MeProvider initialUser={null}>
        <SiteBoard siteId="p_example" initial={boardView({ cards })} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    expect(screen.getByRole('link', { name: 'Sign in to check again' })).toHaveAttribute(
      'href', `/sign-in?next=${encodeURIComponent(SITE_PATH)}`,
    )
  })

  it('keeps stale evidence available when a new Site check cannot start', async () => {
    const cards = boardView().cards.map((item) => item.id === 'conversion'
      ? card({
          id: 'conversion', name: 'Conversion', state: 'unknown',
          answer: SITE_BOARD_COPY.checkOutOfDate, status: SITE_BOARD_COPY.checkOutOfDate,
          coverage: SITE_BOARD_COPY.checkOutOfDateDetail, checkedAt: '2026-09-01T10:00:00.000Z', evidenced: true,
        })
      : item)
    const ownedView = boardView({
      cards,
      site: { ...boardView().site, projectId: 'project-1', userId: signedInUser.id },
    })
    // A spent allowance answers 402 with the server's own wording. Stale evidence
    // has to stay readable either way, and the reason has to be the limit.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 402,
      json: async () => ({
        code: 'UPGRADE_REQUIRED',
        message: PLAN_LIMIT_NOTICE.copy['check-limit'].body,
      }),
    })))
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={ownedView} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    expect(await screen.findByText(PLAN_LIMIT_NOTICE.copy['check-limit'].body)).toBeVisible()
    // The generic start-failure copy would be a lie here: nothing broke.
    expect(screen.queryByText(SITE_BOARD_COPY.checkStartFailed)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(SITE_BOARD_COPY.checkOutOfDateDetail)
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('shows the server reason when Check again cannot start', async () => {
    const cards = boardView().cards.map((item) => item.id === 'conversion'
      ? card({
          id: 'conversion', name: 'Conversion', state: 'unknown',
          answer: SITE_BOARD_COPY.checkOutOfDate, status: SITE_BOARD_COPY.checkOutOfDate,
          coverage: SITE_BOARD_COPY.checkOutOfDateDetail, checkedAt: '2026-09-01T10:00:00.000Z', evidenced: true,
        })
      : item)
    const ownedView = boardView({
      cards,
      site: { ...boardView().site, projectId: 'project-1', userId: signedInUser.id },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        code: 'SITE_RUN_REFUSED',
        message: 'Another Site run is already in progress',
      }),
    })))
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={ownedView} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Conversion' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    expect(await screen.findByText('Another Site run is already in progress')).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.checkStartFailed)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(SITE_BOARD_COPY.checkOutOfDateDetail)
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('reveals an optional area with an open Flag even for an older view without evidence metadata', () => {
    const flagged = card({
      id: 'accessibility',
      name: 'Accessibility',
      state: 'problem',
      answer: 'Form controls are missing labels',
      status: SITE_BOARD_COPY.flagStatus,
      openFlagCount: 1,
      flagIds: ['flag-accessibility'],
    })
    delete (flagged as Partial<BoardCardView>).evidenced
    const cards = boardView().cards.map((item) => item.id === 'accessibility' ? flagged : item)
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({ cards })} />
      </MeProvider>
    )
    expect(screen.getByRole('button', { name: 'Accessibility' })).toBeVisible()
  })
})

/**
 * Watch is sold on telling you when your site breaks. A delivery channel that
 * failed quietly turns a working promise into a false one, so a Site whose
 * checks are running but whose alerts never arrived has to say so, on its own.
 */
describe('an undelivered Watch alert', () => {
  const watching = {
    state: 'watching' as const,
    interval: 'weekly' as const,
    nextRunAt: '2026-10-06T00:00:00.000Z',
    lastError: null,
    // Coverage is untouched. The Site really is being checked.
    covered: true,
    label: 'Watching weekly',
  }
  const undelivered = {
    ...watching,
    alert: { state: 'undelivered' as const, status: 'FAILED' as const, attempts: 5, at: '2026-09-20T10:00:00.000Z' },
  }

  it('states the failure on the Site home rather than leaving a healthy-looking board', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    expect(screen.getByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).toBeInTheDocument()
    // The board must still say checks are happening. Delivery failed, not coverage.
    expect(screen.getByText('Watching weekly')).toBeInTheDocument()
    expect(screen.getByText(/keeps checking/i)).toBeInTheDocument()
  })

  it('shows when it happened, so a stale failure is not read as current', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    expect(screen.getByText(/Sep 20, 2026/)).toBeInTheDocument()
  })

  it('leads to the email FixFlags sends to', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    const action = screen.getByRole('link', { name: WATCH_ALERT_DELIVERY.undeliveredAction })
    expect(action).toHaveAttribute('href', '/settings')
  })

  it('also appears in Settings, where a customer would go to fix it', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteSettingsView siteId="p_example" view={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    expect(screen.getByText(WATCH_ALERT_DELIVERY.undeliveredTitle)).toBeInTheDocument()
  })

  it('stays quiet for an alert still being delivered', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            watch: { ...watching, alert: { state: 'delivering', status: 'SENDING', attempts: 1, at: null } },
            watching: true,
          })}
        />
      </MeProvider>
    )
    expect(screen.queryByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).not.toBeInTheDocument()
  })

  it('stays quiet for a failure that is still being retried', () => {
    // A false alarm about a system that is still working is its own kind of lie.
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            watch: { ...watching, alert: { state: 'delivering', status: 'FAILED', attempts: 2, at: null } },
            watching: true,
          })}
        />
      </MeProvider>
    )
    expect(screen.queryByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).not.toBeInTheDocument()
  })

  it('says nothing when delivery worked', () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            watch: { ...watching, alert: { state: 'delivered', status: 'SENT', attempts: 1, at: '2026-09-20T10:00:00.000Z' } },
            watching: true,
          })}
        />
      </MeProvider>
    )
    expect(screen.queryByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).not.toBeInTheDocument()
  })
})
