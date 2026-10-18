import { siteScopeCounts } from '@/lib/sites/scope-counts'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import { fireEvent, render as renderView, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import { SiteBoard } from '../SiteBoard'
import { SiteSettingsView } from '../SiteSettingsView'
import { MeProvider, type MeUser } from '@/hooks/useMe'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import type { BoardCardView } from '@/lib/sites/board-card'
import { AUDIT_ERRORS, CARE_HOME, WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'
import { checkoutResultCopy, UNASSESSED_OUTCOME_SUMMARY } from '@/lib/sites/outcome-state'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy/auth'

const SITE_PATH = '/sites/p_example'
beforeEach(() => { window.history.replaceState(null, '', '/sites/p_example') })

function render(ui: ReactNode) {
  // Each fixture owns the cache and in-flight request deduplication together.
  const provider = () => new Map()
  return renderView(ui, { wrapper: ({ children }) => <SWRConfig value={{ provider }}>{children}</SWRConfig> })
}

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
  const view: SiteHomeView = {
    schemaVersion: 2, counts: siteScopeCounts([], [], 0), actions: siteViewerActions(true), inventoryPageCount: 0, activeRuns: [], monitoringHistory: [], monitoringTrend: [],
    site: {
      siteId: 'p_example',
      kind: 'project',
      url: 'https://example.com',
      canonicalHost: 'example.com',
      name: 'example.com',
      projectId: 'p_example',
      provisionalSiteId: 'example',
      primaryAuditId: 'audit-1',
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId: 'u1',
    },
    presentation: {
      identity: { siteId: 'p_example', name: 'example.com', host: 'example.com', preview: null },
      result: { state: 'flags', label: 'Flags found' },
      monitoring: { state: 'not_monitored', label: 'Not monitored' },
      coverage: { pagesReached: 0, pagesExpected: 0, label: '0 pages', complete: false },
      freshness: { checkedAt: null, stale: false, label: 'No completed analysis' },
      flags: { count: 0, label: '0 Flags', fixFirstCount: 0 },
      run: { state: 'idle', label: 'Run details', auditId: 'audit-1', recoveryAction: null },
      categories: [],
    },
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
    resolvedFlags: [],
    outcomes: [],
    watch: {
      state: 'off',
      interval: null,
      nextRunAt: null,
      lastRunAt: null,
      lastError: null,
      covered: false,
      label: 'Not monitored',
      alert: { state: 'none', status: null, attempts: 0, at: null },
    },
    settings: {
      notificationLevel: 'FLAGS', notifyOnRecovery: true,
      shopify: { configured: true, state: 'not_connected', domain: null },
      searchConsole: { provider: 'SEARCH_CONSOLE', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
      analytics: { provider: 'ANALYTICS', configured: false, status: 'not_connected', propertyLabel: null, detail: null, lastSyncedAt: null },
    },
    ...overrides,
  }
  view.presentation.categories = view.cards.map((item, index) => ({
      id: item.id,
      name: item.name,
      state: item.id === 'site'
        ? view.presentation.result.state === 'checking' ? 'checking' : view.presentation.coverage.complete ? 'healthy' : 'unknown'
        : item.state,
      answer: item.id === 'site' ? view.presentation.coverage.label : item.answer,
      status: item.id === 'site' ? view.presentation.result.label : item.status,
      flagCount: item.id === 'site' ? 0 : item.openFlagCount,
      fixFirstCount: 0,
      checkedAt: item.checkedAt,
      freshness: view.presentation.freshness.label,
      coverageLimitation: item.incompleteReason ?? null,
      rank: index,
      href: `/sites/p_example?category=${item.id}`,
  }))
  view.counts = siteScopeCounts(view.flags, view.checkedPages ?? [], view.inventoryPageCount)
  return view
}

function renderBoard(user: MeUser | null) {
  return render(
    <MeProvider initialUser={user}>
      <SiteBoard siteId="p_example" initial={boardView({ actions: siteViewerActions(Boolean(user)) })} />
    </MeProvider>
  )
}

it('reopens a requested category and preserves that destination through authentication', async () => {
  render(<MeProvider initialUser={null}><SiteBoard siteId="p_example" initial={boardView({ actions: siteViewerActions(false) })} initialCategory="search" /></MeProvider>)
  const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 })
  expect(within(dialog).getByRole('heading', { name: 'Search', exact: true })).toBeVisible()
  expect(within(dialog).getByRole('link', { name: 'Sign in to check again' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fp_example%3Fcategory%3Dsearch')
})

function watchedOutcome(partial: Partial<SiteOutcomeView> & Pick<SiteOutcomeView, 'name' | 'state' | 'summary'>): SiteOutcomeView {
  return {
    id: 'out-1',
    slug: 'checkout',
    description: null,
    inferenceSource: 'browser',
    confirmedAt: '2026-10-05T17:00:00.000Z',
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

function openFlag(partial: Partial<SiteFlagSeed> = {}): SiteFlagSeed {
  return {
    id: 'flag-1', sourceFlagId: null, confidence: 0.95, improvementId: 'improvement-1', checkId: 'page-availability', rubric: 'REACH', severity: 'IMPORTANT', impactTag: null,
    problem: 'Pricing page is unavailable', evidence: 'The page returned 404.', whyItMatters: 'Customers cannot see pricing.', fix: 'Restore the pricing page.', pageUrl: 'https://example.com/pricing', status: 'OPEN', resolvedInId: null,
    area: 'site', affectedPaths: ['/pricing'], affectedPageCount: 1, priorityBand: 'fix_first', priorityScore: 90, relatedOutcome: null, verificationState: 'unverified', latestOccurrenceAt: '2026-10-10T09:00:00.000Z',
    ...partial,
  }
}

describe('SiteBoard chrome', () => {
  it('offers one site-wide Check again action for an incomplete analysis', async () => {
    const initial = boardView()
    const view = boardView({
      presentation: { ...initial.presentation, run: { state: 'partial', label: 'Analysis incomplete', auditId: 'audit-1', recoveryAction: 'retry' } },
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/runs')
      ? { ok: false, status: 503, json: async () => ({ message: 'Try again later.' }) }
      : { ok: true, status: 200, json: async () => view })
    vi.stubGlobal('fetch', fetchMock)
    try {
      render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)
      expect(screen.getAllByText('Analysis incomplete')).toHaveLength(1)
      expect(screen.queryByRole('region', { name: 'Analysis incomplete' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Check again', exact: true })).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Check again', exact: true }))
      expect(await screen.findByText('Try again later.')).toBeVisible()
      expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_example/runs', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ scope: 'site', outcomeIds: [] }),
      }))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('gives signed-out visitors a recheck path that returns to their Site', async () => {
    renderBoard(null)
    expect(screen.getByRole('link', { name: SITE_BOARD_COPY.signInToCheckAgain })).toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(SITE_PATH)}`)
  })

  it('keeps header monitoring collapsed and restores focus after Escape', () => {
    renderBoard(signedInUser)
    const monitoring = screen.getByRole('button', { name: 'Monitoring: Not monitored' })
    expect(monitoring).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(monitoring)
    expect(screen.getByRole('region', { name: 'Monitoring' })).toHaveTextContent('No next check scheduled')
    expect(screen.getByRole('link', { name: 'Edit schedule' })).toHaveAttribute('href', '/sites/p_example/settings#watch')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Monitoring' })).not.toBeInTheDocument()
    expect(monitoring).toHaveFocus()
    fireEvent.click(monitoring)
    fireEvent.pointerDown(document.body)
    expect(monitoring).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows monitoring information without owner controls to a visitor', () => {
    renderBoard(null)
    fireEvent.click(screen.getByRole('button', { name: 'Monitoring: Not monitored' }))
    expect(screen.getByRole('region', { name: 'Monitoring' })).toHaveTextContent('No next check scheduled')
    expect(screen.queryByRole('link', { name: 'Edit schedule' })).not.toBeInTheDocument()
  })

  it('keeps incomplete Search visible for a visitor even without usable evidence', async () => {
    render(<MeProvider initialUser={null}><SiteBoard siteId="p_example" initial={boardView({
      actions: siteViewerActions(false),
      cards: [card({ id: 'search', name: 'Search', state: 'unknown', evidenced: false,
        answer: 'Search partially checked', incompleteReason: 'Unfinished checks: Crawl access.' })],
    })} /></MeProvider>)
    const search = screen.getByRole('article', { name: 'Search' })
    expect(within(search).getByText('Unfinished checks: Crawl access.')).toBeVisible()
    expect(within(search).queryByRole('link', { name: SITE_BOARD_COPY.signInToCheckAgain })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: SITE_BOARD_COPY.signInToCheckAgain })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open Search' }))
    const detail = await screen.findByRole('dialog')
    expect(within(detail).getByRole('link', { name: SITE_BOARD_COPY.signInToCheckAgain })).toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(SITE_PATH + '?category=search')}`)
  })

  it('puts Uptime first, followed by flagged, unfinished, and healthy checks', () => {
    const view = boardView({ cards: [
      card({ id: 'security', name: 'Security', state: 'healthy', evidenced: true, answer: 'Protected' }),
      card({ id: 'search', name: 'Search', state: 'healthy', evidenced: true, answer: 'Crawl access checked', incompleteReason: 'Unfinished checks: Page titles.' }),
      card({ id: 'conversion', name: 'Conversion', state: 'problem', openFlagCount: 1, answer: 'Cart stays empty' }),
    ] })
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)
    const conversion = screen.getByRole('article', { name: 'Conversion' })
    const search = screen.getByRole('article', { name: 'Search' })
    expect(conversion.compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(search).getByText('Unfinished checks: Page titles.')).toBeVisible()
    const uptime = screen.getByRole('article', { name: 'Uptime' })
    expect(uptime.compareDocumentPosition(conversion)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(uptime.compareDocumentPosition(screen.getByRole('button', { name: 'Open Security' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    const findings = screen.getByRole('region', { name: 'Findings summary' })
    expect(screen.getByRole('region', { name: 'Website preview' }).compareDocumentPosition(findings)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('starts a fresh Search category check and retains saved results on refusal', async () => {
    const view = boardView({ cards: [card({ id: 'search', name: 'Search', state: 'unknown',
      answer: 'Search partially checked', incompleteReason: 'Unfinished checks: Crawl access.' })] })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/runs')
      ? { ok: false, status: 503, json: async () => ({ message: 'The scanner is temporarily unavailable. Try again.' }) }
      : { ok: true, status: 200, json: async () => view })
    vi.stubGlobal('fetch', fetchMock)
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.checkAreaAgain('Search') }))
    expect(await screen.findByText('The scanner is temporarily unavailable. Try again.')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_example/runs', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ scope: 'category', area: 'search' }),
      headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(/^web:/) }),
    }))
    expect(screen.getByText('Search partially checked')).toBeVisible()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.checkAreaAgain('Search') })).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('submits one fresh check and shows its queued state after the server accepts it', async () => {
    const initial = boardView({ cards: [card({ id: 'search', name: 'Search', state: 'unknown',
      answer: 'Search partially checked', incompleteReason: 'Unfinished checks: Crawl access.' })] })
    let current = initial
    let accept!: () => void
    const pending = new Promise<void>(resolve => { accept = resolve })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/runs')) {
        await pending
        return { ok: true, status: 202, json: async () => ({ runId: 'run-2', auditId: 'audit-2', outcomeIds: [], reused: false }) }
      }
      return { ok: true, status: 200, json: async () => current }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={initial} /></MeProvider>)
    const action = screen.getByRole('button', { name: SITE_BOARD_COPY.checkAreaAgain('Search') })
    fireEvent.click(action)
    fireEvent.click(action)
    expect(action).toBeDisabled()
    expect(action).toHaveTextContent(SITE_BOARD_COPY.starting)
    expect(screen.getByText('Search partially checked')).toBeVisible()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/runs'))).toHaveLength(1)
    current = boardView({ ...initial,
      audit: { ...initial.audit, id: 'audit-2', status: 'QUEUED', progress: 0 },
      presentation: { ...initial.presentation, run: { state: 'queued', label: 'Queued', auditId: 'audit-2', recoveryAction: 'view_details' } },
    })
    accept()
    expect(await screen.findByText(SITE_BOARD_COPY.checkStarted)).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: SITE_BOARD_COPY.checkAreaAgain('Search') })).toHaveTextContent(SITE_BOARD_COPY.checking))
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.checkAreaAgain('Search') })).toBeDisabled()
    vi.unstubAllGlobals()
  })

  it('reports interrupted Outcome verification without changing the recorded verdict', async () => {
    const view = boardView({ outcomes: [watchedOutcome({ name: 'Checkout', state: 'FLAG', summary: 'Checkout did not open' })] })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/verify')) throw new TypeError('Network interrupted')
      return { ok: true, status: 200, json: async () => view }
    }))
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')
    fireEvent.click(within(screen.getByRole('heading', { name: 'Checkout' }).closest('section')!).getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(SITE_BOARD_COPY.connectionInterrupted)).toBeVisible()
    expect(await screen.findByText('Checkout did not open')).toBeVisible()
    expect(within(screen.getByRole('heading', { name: 'Checkout' }).closest('section')!).getByRole('button', { name: 'Check again' })).toBeEnabled()
    vi.unstubAllGlobals()
  })
  it('leads with the Checkout result and links to its complete details', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')

    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeVisible()
    expect(screen.getByText(summary)).toBeVisible()
    expect(screen.queryByText('The selected product appears in the cart and checkout opens.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Checkout', exact: true })).toHaveAttribute('href', '/sites/p_example/outcomes/out-1')
    expect(screen.getByText('Couldn’t verify')).toBeVisible()
  })

  it('keeps an unassessed Outcome on its expectation', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')

    expect(screen.getByText('The selected product appears in the cart and checkout opens.')).toBeVisible()
    expect(screen.queryByText(UNASSESSED_OUTCOME_SUMMARY)).not.toBeInTheDocument()
  })

  it('keeps a first availability check pending without presenting its expectation as a result', async () => {
    const expectation = 'The public page responds successfully.'
    const view = boardView({ inventoryPageCount: 1, outcomes: [watchedOutcome({
      name: 'This page loads', kind: 'AVAILABILITY', state: 'COULD_NOT_VERIFY',
      summary: UNASSESSED_OUTCOME_SUMMARY, expectation, running: true,
      lastVerifiedAt: null, latestRunId: null,
    })] })
    view.presentation.run.state = 'running'
    view.presentation.result = { state: 'checking', label: 'Analyzing' }
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)


    fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
    fireEvent.click(screen.getByText('Rendered-page verification'))
    const outcome = screen.getByRole('heading', { name: 'Page availability' }).closest('section')!
    expect(within(outcome).getByRole('status')).toHaveTextContent('Checking…')
    expect(within(outcome).getByRole('link', { name: 'Page availability' })).toHaveAttribute('href', '/sites/p_example/outcomes/out-1')
    expect(screen.queryByText(expectation)).not.toBeInTheDocument()
    expect(screen.queryByText('Website check')).not.toBeInTheDocument()
    expect(screen.queryByText('No completed verification yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Checking again…' })).not.toBeInTheDocument()
    expect(screen.queryByText('0 pages')).not.toBeInTheDocument()
    expect(screen.queryByText('0 pages')).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(within(screen.getByRole('article', { name: 'Pages' })).getByText('Checking pages…')).toBeVisible()
    expect(within(screen.getByRole('group', { name: 'Website status summary' })).queryByText('Pages')).not.toBeInTheDocument()
  })

  it('identifies a retained result as previous evidence while its next verification runs', async () => {
    const summary = 'The page returned an error when checked.'
    const view = boardView({ outcomes: [watchedOutcome({
      name: 'This page loads', kind: 'AVAILABILITY', state: 'FLAG', summary, running: true,
    })] })
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
    fireEvent.click(screen.getByText('Rendered-page verification'))
    const outcome = screen.getByRole('heading', { name: 'Page availability' }).closest('section')!
    expect(within(outcome).getByRole('status')).toHaveTextContent('Checking…')
    expect(within(outcome).getByText(summary)).toBeVisible()
    expect(within(outcome).getByText(/Previous evidence · Last verified/)).toBeVisible()
    expect(within(outcome).queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument()
  })

  it('tells Home that a stale Clear needs a fresh verification', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Open Pages' }))
    await screen.findByRole('dialog')

    expect(within(screen.getByRole('heading', { name: 'Page loads' }).closest('section')!).getByRole('status')).toHaveTextContent('Stale')
    expect(screen.getByText(summary)).toBeVisible()
    expect(screen.getByText('Run a fresh verification before relying on this result.')).toBeVisible()
    expect(screen.getByText(/A result stays current for 8 days/)).toBeVisible()
    expect(screen.getByText(/This result is past that window/)).toBeVisible()
  })

  it('keeps a current Clear free of the stale next step', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Open Pages' }))
    await screen.findByRole('dialog')

    expect(within(screen.getByRole('heading', { name: 'Page loads' }).closest('section')!).getByRole('status')).toHaveTextContent('Clear')
    expect(screen.getByText('This page opened when we checked.')).toBeVisible()
    expect(screen.queryByText(summary)).not.toBeInTheDocument()
    expect(screen.queryByText('Run a fresh verification before relying on this result.')).not.toBeInTheDocument()
    expect(screen.queryByText(/past that window/)).not.toBeInTheDocument()
  })

  it('offers to watch the page after a finished walk with no Outcome', async () => {
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
    expect(screen.getByRole('heading', { name: SITE_BOARD_COPY.cardsHeading })).toHaveClass('sr-only')
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.addCard })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm this page' })).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.cardGuidance)).not.toBeInTheDocument()
  })

  it('offers monitoring directly without a separate confirmation step or hiding results', async () => {
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={boardView({ audit: { id: 'audit-1', status: 'COMPLETED', progress: 100, walkFinished: true, failureCode: null } })} /></MeProvider>)
    expect(screen.queryByRole('button', { name: 'Turn on monitoring' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm this page' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Pages' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open Search' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Confirm this page' })).not.toBeInTheDocument()
  })

  it('offers sign-in without opening a check configuration wizard', async () => {
    renderBoard(null)
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.addCard })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(SITE_PATH)}`)
  })

  it('shows a failed check as failed and retries that check', async () => {
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/retry')) {
        return { ok: true, json: async () => ({ status: 'QUEUED', auditId: 'audit-retry' }) }
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
            presentation: { ...boardView().presentation, run: { state: 'failed', label: 'Check failed', auditId: 'audit-1', recoveryAction: 'retry' } },
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

    expect(within(screen.getByRole('alert')).getByText('Check failed')).toBeVisible()
    expect(screen.getByText(AUDIT_ERRORS.unreachable)).toBeVisible()
    expect(screen.queryByText('Learning your website')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/reports/audit-1/retry', { method: 'POST' })
    })
    expect(await screen.findByText(SITE_BOARD_COPY.checkStarted)).toBeVisible()
    // The command receipt is visible immediately, but a pending refresh cannot
    // replace the previously recorded verdict with an invented queued state.
    expect(within(screen.getByRole('alert')).getByText('Check failed')).toBeVisible()
    releaseRefresh()
    await waitFor(() => expect(screen.queryByText('Check failed')).not.toBeInTheDocument())
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_example', { cache: 'no-store' })
    })
    view.unmount()
    vi.unstubAllGlobals()
  })

  it('shows a skipped written summary without a failed-check retry', async () => {
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
    expect(screen.getAllByRole('status').some(status => status.textContent === (
      'The written summary did not run. The Flags below come from the browser check.'
    ))).toBe(true)
    expect(screen.queryByText('Check failed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.getByText('Headline does not convey usage context')).toBeVisible()
  })

  it('names a Flag by its card and severity, not the internal ids', async () => {
    render(
      <MeProvider initialUser={null}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            flags: [{ affectedPaths: [],
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
            presentation: {
              ...boardView().presentation,
              flags: { count: 1, label: '1 Flag', fixFirstCount: 0 },
            },
          })}
        />
      </MeProvider>
    )
    expect(within(screen.getByRole('group', { name: 'Website status summary' })).getByText('Flag')).toBeVisible()
    expect(screen.queryByText('Search · Important Flag')).not.toBeInTheDocument()
  })

  it('keeps findings inside Overview categories with four navigation items', async () => {
    renderBoard(signedInUser)
    const rail = screen.getByRole('navigation', { name: 'Site' })
    expect(within(rail).getAllByRole('link').map(link => link.textContent?.trim())).toEqual(['Overview', 'Timeline', 'Integrations', 'Settings'])
    expect(screen.getByRole('button', { name: 'Open Pages' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Flags', level: 2 })).not.toBeInTheDocument()
  })

  it('opens the shared schedule editor for the owner and saves an allowed cadence', async () => {
    const view = boardView()
    view.watch = { ...view.watch, state: 'watching', interval: 'daily', label: 'Daily', nextRunAt: '2099-10-11T09:00:00.000Z' }
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/watch')) return Response.json(options?.method === 'POST' ? { ok: true, interval: 'weekly' } : { intervals: ['daily', 'weekly'] })
      return Response.json(view)
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      render(<MeProvider initialUser={signedInUser}><SiteSettingsView siteId="p_example" view={view} /></MeProvider>)
      fireEvent.click(screen.getByRole('button', { name: 'Edit schedule' }))
      const dialog = screen.getByRole('dialog')
      const frequency = within(dialog).getByRole('combobox', { name: 'Check frequency' })
      await waitFor(() => expect(frequency).toBeEnabled())
      fireEvent.change(frequency, { target: { value: 'hourly' } })
      expect(within(dialog).getByRole('button', { name: 'Save schedule' })).toBeDisabled()
      expect(within(dialog).getByText('This schedule is not available on your plan.')).toBeVisible()
      fireEvent.change(frequency, { target: { value: 'weekly' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_example/watch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval: 'weekly' }),
      }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    } finally { vi.unstubAllGlobals() }
  })

  it('shows the affected page count without counting two Flags on one page twice', async () => {
    const flag = openFlag()
    const initial = boardView({ flags: [{ ...flag, id: 'f1', area: 'site', pageUrl: 'https://example.com/pricing' }, { ...flag, id: 'f2', area: 'site', pageUrl: 'https://example.com/pricing' }] })
    initial.inventoryPageCount = 12
    initial.presentation.coverage.pagesExpected = 12
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={initial} /></MeProvider>)
    const pages = screen.getByRole('article', { name: 'Pages' })
    expect(within(pages).getByText('1 needs attention')).toBeVisible()
  })

  it('opens page-specific previews from the Pages summary before detailed check results', async () => {
    const base = boardView()
    const view = boardView({ presentation: { ...base.presentation, coverage: { pagesReached: 2, pagesExpected: 2, label: '2 pages', complete: true } },
      checkedPages: [
        { url: 'https://example.com/', title: 'Home', status: 'COMPLETED', checkedAt: '2026-10-12T12:00:00Z', capture: { url: '/api/screenshots/audit-1/desktop?page=home', viewport: '1280 × 720', recordedAt: '2026-10-12T12:00:00Z' } },
        { url: 'https://example.com/contact', title: 'Contact', status: 'PARTIAL', checkedAt: '2026-10-12T12:00:00Z' },
      ] })
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)
    const summary = screen.getByRole('group', { name: 'Website status summary' })
    fireEvent.click(within(summary).getByRole('button', { name: '2 Pages with results. 1 page checked' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('img', { name: 'Captured page: Home' })).toHaveAttribute('src', '/api/screenshots/audit-1/desktop?page=home')
    expect(within(dialog).getByRole('img', { name: 'Preview of Contact: No screenshot recorded' })).toBeVisible()
    expect(within(dialog).getByText('Partial')).toBeVisible()
  })

  it('shows real monitoring history in the same Site shell', async () => {
    const view = boardView({
      monitoringHistory: [
        { checkedAt: '2026-10-09T09:00:00.000Z', flagCount: 0 },
        { checkedAt: '2026-10-10T09:00:00.000Z', flagCount: 1, flags: [{ id: 'flag-1', title: 'Pricing page is unavailable' }] },
      ],
      flags: [openFlag()],
    })
    view.monitoringTrend = view.monitoringHistory.map(entry => ({ ...entry, scope: 'SITE', status: 'COMPLETED', evidenceAt: entry.checkedAt }))
    view.presentation.monitoring = { state: 'daily', label: 'Daily' }
    view.watch = { ...view.watch, state: 'watching', interval: 'daily', nextRunAt: '2026-10-11T09:00:00.000Z', covered: true, label: 'Daily' }
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} viewMode="timeline" /></MeProvider>)
    expect(screen.getByRole('heading', { name: 'Timeline', level: 2 })).toBeVisible()
    expect(screen.getByText('Flags over time')).toBeVisible()
    expect(screen.getByRole('list', { name: 'Check history' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Pricing page is unavailable' })).toHaveAttribute('href', '/sites/p_example/flags/flag-1')
    expect(screen.queryByRole('button', { name: 'Edit schedule' })).not.toBeInTheDocument()
  })

  it('shows a manual recovery check by scope without including it in the Site-wide trend', async () => {
    const view = boardView({ monitoringHistory: [
      { id: 'site-1', checkedAt: '2026-10-09T09:00:00.000Z', flagCount: 2, scope: 'SITE', trigger: 'SCHEDULED' },
      { id: 'site-2', checkedAt: '2026-10-10T09:00:00.000Z', flagCount: 1, scope: 'SITE', trigger: 'SCHEDULED' },
      { id: 'fix-1', checkedAt: '2026-10-11T09:00:00.000Z', flagCount: 0, scope: 'OUTCOMES', trigger: 'MANUAL', afterFix: true, targetLabel: 'Reach checkout', result: 'CLEAR' },
    ] })
    view.monitoringTrend = view.monitoringHistory.filter(entry => entry.scope === 'SITE').map(entry => ({ ...entry, status: 'COMPLETED', evidenceAt: entry.checkedAt }))
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} viewMode="timeline" /></MeProvider>)
    expect(screen.getByRole('img', { name: 'Flag count across 2 checks' })).toBeVisible()
    const event = screen.getByText('Check after a fix').closest('li')!
    expect(within(event).getByText('Manual check · Selected visitor actions · Reach checkout')).toBeVisible()
    expect(within(event).getByText('Recovery verified for this scope')).toBeVisible()
    expect(within(event).queryByText('0 Flags')).not.toBeInTheDocument()
  })

  it('restores and saves custom timing through the shared editor', async () => {
    const initial = boardView()
    initial.presentation.monitoring = { state: 'custom', label: 'Every 3 hours' }
    initial.watch = { ...initial.watch, state: 'watching', interval: 'custom', everyMinutes: 180, nextRunAt: '2099-10-11T09:00:00.000Z', covered: true }
    let current = initial
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/watch')) {
        if (options?.method !== 'POST') return Response.json({ intervals: ['daily', 'weekly', 'hourly', 'custom'] })
        const body = JSON.parse(String(options.body))
        current = { ...initial, watch: { ...initial.watch, everyMinutes: body.everyMinutes } }
        return Response.json({ ok: true, ...body })
      }
      return Response.json(current)
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      render(<MeProvider initialUser={signedInUser}><SiteSettingsView siteId="p_example" view={initial} /></MeProvider>)
      fireEvent.click(screen.getByRole('button', { name: 'Edit schedule' }))
      const dialog = screen.getByRole('dialog')
      await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Check frequency' })).toBeEnabled())
      expect(within(dialog).getByRole('spinbutton', { name: 'Every' })).toHaveValue(3)
      expect(within(dialog).getByRole('combobox', { name: 'Time unit' })).toHaveValue('hours')
      fireEvent.change(within(dialog).getByRole('combobox', { name: 'Time unit' }), { target: { value: 'days' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_example/watch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval: 'custom', everyMinutes: 4320 }) }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Edit schedule' })).toBeVisible()
    } finally { vi.unstubAllGlobals() }
  })

  it('shows connection logos and states in the same Site shell', async () => {
    const view = boardView()
    view.settings.shopify = { configured: true, state: 'connected', domain: 'example.myshopify.com' }
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} viewMode="integrations" /></MeProvider>)
    expect(screen.getByRole('heading', { name: 'Integrations', level: 2 })).toBeVisible()
    expect(await screen.findByText('Shopify')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Analytics' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Search Console' })).not.toBeInTheDocument()
    expect(screen.getByText('example.myshopify.com')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Disconnect Shopify' })).toBeVisible()
    expect(screen.getByText('Available')).toBeVisible()
    expect(screen.getAllByText('Coming soon')).toHaveLength(9)
    expect(screen.getByRole('link', { name: 'Manage GitHub connection' })).toHaveAttribute('href', '/settings/integrations?next=%2Fsites%2Fp_example%3Fview%3Dintegrations')
  })

  it('shows detected website technology before the summary', async () => {
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={boardView({
      technology: { status: 'complete', detectedAt: '2026-10-10T09:00:00.000Z', items: [{ slug: 'next-js', name: 'Next.js', category: 'framework', confidenceBand: 'verified' }] },
    })} /></MeProvider>)
    expect(screen.getByRole('region', { name: 'Detected technologies' })).toBeVisible()
    expect(screen.getByText('Next.js')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Next.js logo' })).toBeVisible()
  })

  it('shows active work in its cards and retains recorded results', async () => {
    const view = boardView({ executionProgress: {
      total: 4, completed: 1, running: 2, pending: 1, recovering: 0, unknown: 0, inapplicable: 0,
      recoveryUntil: null, eventCursor: null,
      tasks: [
        { id: 'browser', kind: 'browser', pageUrl: 'https://example.com', state: 'RUNNING', attempts: 1, reason: null, retryAt: null },
        { id: 'flow', kind: 'flow', pageUrl: 'https://example.com', state: 'RUNNING', attempts: 1, reason: null, retryAt: null },
        { id: 'security', kind: 'check', module: 'security', pageUrl: 'https://example.com', state: 'COMPLETED', attempts: 1, reason: null, retryAt: null },
        { id: 'speed', kind: 'pagespeed', pageUrl: 'https://example.com', state: 'WAITING', attempts: 0, reason: null, retryAt: null },
      ],
    } })
    view.presentation.run.state = 'running'
    view.presentation.result.state = 'checking'
    view.audit.status = 'RUNNING'
    render(<MeProvider initialUser={signedInUser}><SiteBoard siteId="p_example" initial={view} /></MeProvider>)
    const pages = screen.getByRole('article', { name: 'Pages' })
    expect(within(pages).getByText('1 running')).toBeVisible()
    expect(within(pages).getByText('Rendered content and semantics')).toBeVisible()
    const conversion = screen.getByRole('article', { name: 'Conversion' })
    expect(within(conversion).getByText('1 running')).toBeVisible()
    expect(within(conversion).getByText('Headline does not convey usage context')).toBeVisible()
    expect(within(screen.getByRole('article', { name: 'Performance' })).queryByText(/running/)).not.toBeInTheDocument()
    const header = screen.getByRole('complementary', { name: 'Website navigation' })
    const status = within(header).getByRole('status')
    expect(status).toHaveTextContent('Analyzing')
    expect(status.querySelector('svg')).not.toBeNull()
    expect(screen.getAllByText('Analyzing')).toHaveLength(1)
    expect(screen.queryByText('0 pages')).not.toBeInTheDocument()
    expect(within(header).queryByText('0 pages')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Checking' })).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run details' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Technical details').closest('details')).not.toHaveAttribute('open')
    expect(within(dialog).getByText('Technical details')).toBeVisible()
    expect(screen.queryByText('Monitoring is off.')).not.toBeInTheDocument()
  })

  it('shows Sign in with a next path for logged-out visitors', async () => {
    renderBoard(null)
    const links = screen.getAllByRole('link', { name: CARE_HOME.signIn })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `/sign-in?next=${encodeURIComponent(SITE_PATH)}`
      )
      expect(link).toHaveClass('bg-primary', 'text-primary-foreground')
    }
    expect(screen.queryByRole('link', { name: 'All Sites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep watching' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm this page' })).not.toBeInTheDocument()
    expect(screen.queryByText('Monitoring off')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on monitoring' })).not.toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Site' })
    expect(rail).toBeInTheDocument()
    expect(rail).toHaveTextContent('Overview')
    expect(rail).toHaveTextContent('Timeline')
    expect(within(rail).queryByRole('link', { name: 'Flags', exact: true })).not.toBeInTheDocument()
    expect(rail).toHaveTextContent('Settings')
    for (const link of screen.getAllByRole('link', { name: 'Settings' })) {
      expect(link).toHaveAttribute('href', `/sign-in?next=${encodeURIComponent(`${SITE_PATH}/settings`)}`)
    }
    expect(screen.queryByRole('link', { name: 'More' })).not.toBeInTheDocument()
    expect(rail).not.toHaveTextContent('Not watching')
    expect(rail).not.toHaveTextContent('Keep watching')
    expect(rail).not.toHaveTextContent('All Sites')
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.addCard })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Security' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tracking' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Conversion' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Performance' })).toBeInTheDocument()
  })

  it('orders Settings by customer responsibility and keeps connection cards subordinate', async () => {
    render(
      <MeProvider initialUser={null}>
        <SiteSettingsView siteId="p_example" view={boardView()} />
      </MeProvider>
    )
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
    // Core controls keep their order; optional settings sections can follow.
    expect(screen.getAllByRole('heading', { level: 2 }).slice(0, 4).map((heading) => heading.textContent)).toEqual([
      'Monitoring',
      'Notifications',
      'Automatic account checks',
      'Remove Site',
    ])
    expect(screen.queryByRole('heading', { name: 'Shopify', level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Search Console', level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Analytics', level: 3 })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Site' })).toBeInTheDocument()
  })

  it('keeps watch and All Sites for signed-in owners', async () => {
    renderBoard(signedInUser)
    expect(screen.queryByRole('link', { name: CARE_HOME.signIn })).not.toBeInTheDocument()
    expect(within(screen.getByRole('complementary', { name: 'App' })).getByRole('link', { name: 'Websites' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Monitoring: Not monitored' }))
    expect(screen.getByRole('link', { name: 'Edit schedule' })).toHaveAttribute('href', `${SITE_PATH}/settings#watch`)
    expect(screen.queryByRole('button', { name: 'Turn on monitoring' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.addCard })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Security' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Tracking' })).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'Settings' })) {
      expect(link).toHaveAttribute('href', `${SITE_PATH}/settings`)
    }
  })

  it('hides optional areas without evidence for logged-out visitors', async () => {
    renderBoard(null)
    expect(screen.queryByRole('button', { name: 'Uptime' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accessibility' })).not.toBeInTheDocument()
  })

  it('combines page reachability in the Pages card', async () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({
          checkedPages: [
            { url: 'https://example.com', title: 'Home', status: 'COMPLETED' },
            { url: 'https://example.com/about', title: 'About', status: 'COMPLETED' },
            { url: 'https://example.com/contact', title: 'Contact', status: 'FAILED' },
          ],
          presentation: {
            ...boardView().presentation,
            coverage: { pagesReached: 2, pagesExpected: 3, label: '2 of 3 pages', complete: false },
          },
        })} />
      </MeProvider>
    )
    expect(screen.getAllByText('2 of 3 pages')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Uptime' })).not.toBeInTheDocument()
  })

  it('keeps reachability combined with Pages even when legacy uptime evidence exists', async () => {
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
    expect(screen.queryByRole('button', { name: 'Uptime' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accessibility' })).not.toBeInTheDocument()
  })

  it('keeps stale optional evidence visible instead of turning missing freshness into missing coverage', async () => {
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
    expect(screen.getByRole('button', { name: 'Open Accessibility' })).toBeVisible()
  })

  it('keeps stale starter evidence visible while hiding areas that were never checked', async () => {
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

    expect(screen.getByRole('button', { name: 'Open Conversion' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Security' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')
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
        return { ok: true, status: 202, json: async () => ({ runId: 'run-1', auditId: 'audit-new', outcomeIds: [], reused: false }) }
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

    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/p_example/runs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ scope: 'category', area: 'conversion' }),
      }),
    ))
    expect(await screen.findByText('New check started')).toBeVisible()
    expect(screen.getByText('New check started')).toBeVisible()
    releaseRefresh()
    rendered.unmount()
    vi.unstubAllGlobals()
  })

  it('asks an anonymous visitor to claim the Site before refreshing stale evidence', async () => {
    const cards = boardView().cards.map((item) => item.id === 'conversion'
      ? card({
          id: 'conversion', name: 'Conversion', state: 'unknown',
          answer: SITE_BOARD_COPY.checkOutOfDate, status: SITE_BOARD_COPY.checkOutOfDate,
          coverage: SITE_BOARD_COPY.checkOutOfDateDetail, checkedAt: '2026-09-01T10:00:00.000Z', evidenced: true,
        })
      : item)
    render(
      <MeProvider initialUser={null}>
        <SiteBoard siteId="p_example" initial={boardView({ cards, actions: siteViewerActions(false) })} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')
    expect(screen.getByRole('link', { name: 'Sign in to check again' })).toHaveAttribute(
      'href', `/sign-in?next=${encodeURIComponent(SITE_PATH + '?category=conversion')}`,
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
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (url === '/api/sites/p_example') return Response.json(ownedView)
      return {
        ok: false,
        status: 402,
        json: async () => ({
          code: 'UPGRADE_REQUIRED',
          message: PLAN_LIMIT_NOTICE.copy['check-limit'].body,
        }),
      }
    }))
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={ownedView} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')
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
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (url === '/api/sites/p_example') return Response.json(ownedView)
      return {
        ok: false,
        status: 409,
        json: async () => ({
          code: 'SITE_RUN_REFUSED',
          message: 'Another Site run is already in progress',
        }),
      }
    }))
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={ownedView} />
      </MeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Conversion' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    expect(await screen.findByText('Another Site run is already in progress')).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.checkStartFailed)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(SITE_BOARD_COPY.checkOutOfDateDetail)
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('reveals an optional area with an open Flag even for an older view without evidence metadata', async () => {
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
    expect(screen.getByRole('button', { name: 'Open Accessibility' })).toBeVisible()
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
    lastRunAt: null,
    lastError: null,
    // Coverage is untouched. The Site really is being checked.
    covered: true,
    label: 'Weekly',
  }
  const undelivered = {
    ...watching,
    alert: { state: 'undelivered' as const, status: 'FAILED' as const, attempts: 5, at: '2026-09-20T10:00:00.000Z' },
  }

  function weeklyBoard(watch: typeof undelivered) {
    const view = boardView({ watch, watching: true })
    view.presentation = { ...view.presentation, monitoring: { state: 'weekly', label: 'Weekly' } }
    return view
  }

  it('states the failure on the Site home rather than leaving a healthy-looking board', async () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={weeklyBoard(undelivered)} />
      </MeProvider>
    )
    expect(screen.getByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).toBeInTheDocument()
    // The board must still say checks are happening. Delivery failed, not coverage.
    expect(screen.getByRole('button', { name: 'Monitoring: Weekly' })).toBeInTheDocument()
    expect(screen.getByText(/keeps checking/i)).toBeInTheDocument()
  })

  it('shows when it happened, so a stale failure is not read as current', async () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    expect(screen.getByText(/Sep 20, 2026/)).toBeInTheDocument()
  })

  it('leads to the email FixFlags sends to', async () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard siteId="p_example" initial={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    const action = screen.getByRole('link', { name: WATCH_ALERT_DELIVERY.undeliveredAction })
    expect(action).toHaveAttribute('href', '/settings')
  })

  it('also appears in Settings, where a customer would go to fix it', async () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteSettingsView siteId="p_example" view={boardView({ watch: undelivered, watching: true })} />
      </MeProvider>
    )
    expect(screen.getByText(WATCH_ALERT_DELIVERY.undeliveredTitle)).toBeInTheDocument()
  })

  it('keeps Settings quiet while the projected alert still has delivery attempts remaining', () => {
    render(<MeProvider initialUser={signedInUser}>
      <SiteSettingsView siteId="p_example" view={boardView({ watch: { ...watching,
        alert: { state: 'delivering', status: 'FAILED', attempts: 6, at: null } }, watching: true })} />
    </MeProvider>)
    expect(screen.queryByText(WATCH_ALERT_DELIVERY.undeliveredTitle)).not.toBeInTheDocument()
  })

  it('stays quiet for an alert still being delivered', async () => {
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

  it.each([2, 6])('stays quiet for a failure still being retried under its saved ceiling: %s', async attempts => {
    // A false alarm about a system that is still working is its own kind of lie.
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            watch: { ...watching, alert: { state: 'delivering', status: 'FAILED', attempts, at: null } },
            watching: true,
          })}
        />
      </MeProvider>
    )
    expect(screen.queryByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).not.toBeInTheDocument()
  })

  it('says nothing when delivery worked', async () => {
    render(
      <MeProvider initialUser={signedInUser}>
        <SiteBoard
          siteId="p_example"
          initial={boardView({
            watch: { ...watching, alert: { state: 'accepted', status: 'SENT', attempts: 1, at: '2026-09-20T10:00:00.000Z' } },
            watching: true,
          })}
        />
      </MeProvider>
    )
    expect(screen.queryByRole('heading', { name: WATCH_ALERT_DELIVERY.undeliveredTitle })).not.toBeInTheDocument()
  })
})
