import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import OutcomeDetailPage from '../page'

const OBSERVED = '2026-09-23T22:57:11.000Z'

const mocks = vi.hoisted(() => ({
  requireSiteAccess: vi.fn(),
  loadSiteHome: vi.fn(),
  loadSiteOutcomeDetail: vi.fn(),
}))

vi.mock('@/lib/sites/request-access', () => ({
  requireSiteAccess: mocks.requireSiteAccess,
}))

vi.mock('@/lib/sites/application/queries', () => ({
  loadSiteHome: mocks.loadSiteHome,
}))

vi.mock('@/lib/sites/outcomes', () => ({
  loadSiteOutcomeDetail: mocks.loadSiteOutcomeDetail,
}))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  redirect: (href: string) => { throw new Error('NEXT_REDIRECT:' + href) },
}))

vi.mock('@/components/sites/SiteShell', () => ({
  SiteShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/sites/SiteOutcomeActions', () => ({ SiteOutcomeActions: () => null }))

function evidence(reason: string) {
  return {
    disposition: 'SUCCEEDED',
    reason,
    detail: null,
    createdAt: OBSERVED,
    auditId: 'audit-1',
  }
}

describe('Outcome proof card', () => {
  beforeEach(() => {
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1' } },
    })
    mocks.loadSiteHome.mockResolvedValue({
      site: { siteId: 'site-1' },
      flags: [],
      resolvedFlags: [],
      watch: { state: 'off', label: 'Off' },
    })
    mocks.loadSiteOutcomeDetail.mockResolvedValue({
      id: 'outcome-1',
      name: 'This page loads',
      expectation: 'The page responds.',
      summary: 'FixFlags completed every required check for this Outcome.',
      enabled: true,
      running: false,
      state: 'CLEAR',
      kind: 'AVAILABILITY',
      environment: 'production',
      staleAfterMinutes: 11520,
      flagId: null,
      pageUrls: [],
      limitation: null,
      recoveryAction: null,
      lastVerifiedAt: OBSERVED,
      lastSuccessfulVerificationAt: OBSERVED,
      bindings: [
        {
          key: 'checkout-browser-v1',
          required: true,
          mechanism: 'BROWSER_JOURNEY',
          version: 1,
          latestEvidence: evidence('checkout_reached'),
          customerSentence: 'FixFlags independently reached checkout.',
        },
        {
          key: 'signup-safe-form-v1',
          required: true,
          mechanism: 'SAFE_FORM',
          version: 1,
          latestEvidence: evidence('protected_or_irreversible'),
          customerSentence: 'This flow is protected, so FixFlags did not submit it.',
        },
        {
          key: 'page-availability-v1',
          required: true,
          mechanism: 'HTTP_AVAILABILITY',
          version: 1,
          latestEvidence: evidence('available'),
          customerSentence: 'FixFlags completed every required check for this Outcome.',
        },
        {
          key: 'notes-v1',
          required: false,
          mechanism: 'CUSTOM_SIGNAL',
          version: 1,
          latestEvidence: null,
          customerSentence: 'This method has not produced evidence yet.',
        },
      ],
      timeline: [{
        id: 'event-1',
        type: 'assessment',
        at: OBSERVED,
        title: 'Clear',
        detail: 'FixFlags completed every required check for this Outcome.',
        auditId: 'audit-1',
      }],
    })
  })

  it('names each method in customer words and uses the shared UTC evidence clock', async () => {
    const clock = formatEvidenceTimestamp(OBSERVED)
    render(await OutcomeDetailPage({
      params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }),
    }))

    expect(screen.getByText('Purchase path')).toBeVisible()
    expect(screen.getByText('Form')).toBeVisible()
    expect(screen.getByText('Page availability')).toBeVisible()
    expect(screen.getByText('Check')).toBeVisible()
    for (const time of document.querySelectorAll('time')) {
      expect(time).toHaveTextContent(clock!)
      expect(time).toHaveAttribute('dateTime', OBSERVED)
    }
    expect(screen.queryByText(OUTCOME_DETAIL_COPY.lastSuccessfulVerification, { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByText('Http availability')).not.toBeInTheDocument()
    expect(screen.queryByText('Browser journey')).not.toBeInTheDocument()
    expect(screen.queryByText('Safe form')).not.toBeInTheDocument()
    expect(screen.queryByText('Custom signal')).not.toBeInTheDocument()
  })

  it('keeps every composed read on the exact Site record authorized for this request', async () => {
    const site = { siteId: 'site-1', projectId: 'project-1', userId: 'authorized-owner' }
    mocks.requireSiteAccess.mockResolvedValue({ ok: true, decision: { role: 'owner', authenticated: true, site } })
    await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) })
    expect(mocks.loadSiteHome).toHaveBeenLastCalledWith('site-1', { ownerEvidence: true, viewerAuthenticated: true, site })
    expect(mocks.loadSiteOutcomeDetail).toHaveBeenLastCalledWith(site, 'outcome-1')
  })

  it.each([
    { view: 'pages', label: 'Pages', back: '/sites/site-1?view=pages#pages', context: 'view=pages' },
    { view: 'timeline', label: 'Timeline', back: '/sites/site-1?view=timeline#timeline', context: 'view=timeline' },
    { view: 'home', category: 'search', label: null, back: '/sites/site-1?category=search#category-search', context: 'view=home&category=search' },
  ])('retains its $view workspace in the return and related Flag links', async ({ view, category, label, back, context }) => {
    const home = await mocks.loadSiteHome()
    mocks.loadSiteHome.mockResolvedValue({ ...home, resolvedFlags: [{ id: 'repaired', problem: 'The page did not load', status: 'FIXED',
      relatedOutcome: { id: 'outcome-1', name: 'This page loads' } }] })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }),
      searchParams: Promise.resolve({ view, category }) }))
    expect(screen.getByRole('link', { name: label ? SITE_DASHBOARD_COPY.backTo(label) : OUTCOME_DETAIL_COPY.back })).toHaveAttribute('href', back)
    expect(screen.getByRole('link', { name: 'The page did not load' })).toHaveAttribute('href', `/sites/site-1/flags/repaired?${context}`)
  })

  it.each(['FIXED', 'VERIFIED'])('keeps the original %s Flag linked from a clear verification', async (status) => {
    const home = await mocks.loadSiteHome()
    mocks.loadSiteHome.mockResolvedValue({ ...home, resolvedFlags: [{ id: 'repaired', problem: 'The page did not load', status,
      relatedOutcome: { id: 'outcome-1', name: 'This page loads' } }] })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    expect(screen.getByRole('link', { name: 'The page did not load' })).toHaveAttribute('href', '/sites/site-1/flags/repaired?view=home')
    expect(screen.getByText('Resolved')).toBeVisible()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('shows a current recurrence ahead of an older recovery with the same durable identity', async () => {
    const home = await mocks.loadSiteHome()
    const outcome = await mocks.loadSiteOutcomeDetail()
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, state: 'FLAG', flagId: 'incident' })
    mocks.loadSiteHome.mockResolvedValue({ ...home, actions: { copy: 'available' },
      flags: [{ id: 'incident', problem: 'The page has stopped loading again', status: 'REGRESSED', fix: '' }],
      resolvedFlags: [{ id: 'incident', problem: 'The page did not load', status: 'VERIFIED' }] })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    expect(screen.getByRole('link', { name: 'The page has stopped loading again' })).toBeVisible()
    expect(screen.getByText('Active')).toBeVisible()
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument()
  })

  it('keeps an older successful verification distinct from the latest inconclusive attempt', async () => {
    const outcome = await mocks.loadSiteOutcomeDetail()
    const attempted = '2026-09-24T10:00:00.000Z'
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, state: 'COULD_NOT_VERIFY', lastVerifiedAt: attempted })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    expect(screen.getByText('Last attempted', { exact: false })).toHaveTextContent(formatEvidenceTimestamp(attempted)!)
    expect(screen.getByText(OUTCOME_DETAIL_COPY.lastSuccessfulVerification, { exact: false })).toHaveTextContent(formatEvidenceTimestamp(OBSERVED)!)
  })

  it('asks for a fresh check when the current method has only historical evidence', async () => {
    const outcome = await mocks.loadSiteOutcomeDetail()
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, bindings: [{ ...outcome.bindings[0], latestEvidence: null,
      customerSentence: OUTCOME_DETAIL_COPY.currentEvidenceMissing }] })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    expect(screen.getAllByText(OUTCOME_DETAIL_COPY.currentEvidenceMissing)).toHaveLength(2)
    expect(screen.queryByText(OUTCOME_DETAIL_COPY.noEvidence)).not.toBeInTheDocument()
  })

  it('keeps recovery instructions out of the current action while verification is running', async () => {
    const outcome = await mocks.loadSiteOutcomeDetail()
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, running: true, recoveryAction: 'Verify again.' })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    expect(screen.getByRole('status')).toHaveTextContent('Verifying')
    expect(screen.queryByText('Verify again.')).not.toBeInTheDocument()
  })

  it('states a shared summary and limitation once in the primary answer', async () => {
    const outcome = await mocks.loadSiteOutcomeDetail()
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, summary: 'No recorded verification yet.', limitation: 'No recorded verification yet.' })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    expect(screen.getAllByText('No recorded verification yet.')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: OUTCOME_DETAIL_COPY.limitationHeading })).not.toBeInTheDocument()
  })

  it('opens a covered page at its exact recorded address while preserving the independent evidence', async () => {
    const outcome = await mocks.loadSiteOutcomeDetail()
    const url = 'https://example.com/Plans/?locale=fr&plan=annual#purchase'
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, pageUrls: [url] })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    const pages = screen.getByRole('region', { name: OUTCOME_DETAIL_COPY.pagesHeading })
    const visit = within(pages).getByRole('link', { name: SITE_DASHBOARD_COPY.open(url) })
    expect(visit).toHaveAttribute('href', url)
    expect(visit).toHaveAttribute('target', '_blank')
    expect(visit).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('heading', { name: OUTCOME_DETAIL_COPY.evidenceHeading })).toBeVisible()
  })

  it.each(['javascript:alert(1)', 'data:text/html,example', 'https://user:secret@example.com/', '/relative-page'])('keeps an invalid covered-page address as text: %s', async url => {
    const outcome = await mocks.loadSiteOutcomeDetail()
    mocks.loadSiteOutcomeDetail.mockResolvedValue({ ...outcome, pageUrls: [url] })
    render(await OutcomeDetailPage({ params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }))
    const pages = screen.getByRole('region', { name: OUTCOME_DETAIL_COPY.pagesHeading })
    expect(within(pages).getByText(url)).toBeVisible()
    expect(within(pages).queryByRole('link')).toBeNull()
  })
})
