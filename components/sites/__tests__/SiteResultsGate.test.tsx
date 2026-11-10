import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_RESULTS_GATE_POLL_MS, SiteResultsGate } from '../SiteResultsGate'
import { SITE_RESULTS_GATE as C } from '@/lib/marketing/copy/site-results-gate'
import type { SiteResultsGateView } from '@/lib/sites/application/results-gate'

vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

const running: SiteResultsGateView = { kind: 'results_gate', siteId: 'p_visitor', host: 'example.com', state: 'running', stage: 1, continuation: 'sign_in' }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Site results gate', () => {
  it('shows the check running and offers signup that returns to the same Site', () => {
    render(<SiteResultsGate initial={running} />)
    expect(screen.getByRole('heading', { name: C.running.title('example.com') })).toBeVisible()
    expect(screen.getByRole('link', { name: C.signUp })).toHaveAttribute('href', '/sign-up?next=%2Fsites%2Fp_visitor')
    expect(screen.getByRole('link', { name: C.signIn })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fp_visitor')
    const stages = screen.getAllByRole('listitem')
    expect(stages.map(stage => stage.dataset.state)).toEqual(['done', 'active', 'pending', 'pending'])
  })

  it('polls until the results are ready, then asks for signup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...running, state: 'ready', stage: 3 })))
    render(<SiteResultsGate initial={running} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(SITE_RESULTS_GATE_POLL_MS) })
    expect(screen.getByRole('heading', { name: C.ready.title })).toBeVisible()
    expect(screen.getByText(C.ready.body('example.com'))).toBeVisible()
    expect(screen.getAllByRole('listitem').every(stage => stage.dataset.state === 'done')).toBe(true)
  })

  it('sends a signed-in visitor through the claim', () => {
    render(<SiteResultsGate initial={{ ...running, state: 'ready', continuation: 'claim' }} />)
    expect(screen.getByRole('link', { name: C.claim })).toHaveAttribute('href', '/post-login?next=%2Fsites%2Fp_visitor')
    expect(screen.queryByRole('link', { name: C.signIn })).not.toBeInTheDocument()
  })
})
