import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('does not stack reads while the current status request is pending, and aborts it on exit', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(() => {}) })
    vi.stubGlobal('fetch', fetcher)
    const view = render(<SiteResultsGate initial={running} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(fetcher).toHaveBeenCalledOnce()
    view.unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('preserves the last stage through a failed read and retries without starting another check', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(Response.json({ ...running, state: 'ready', stage: 3 }))
    vi.stubGlobal('fetch', fetcher)
    render(<SiteResultsGate initial={running} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(SITE_RESULTS_GATE_POLL_MS) })
    expect(screen.getByRole('status')).toHaveTextContent(C.disconnected)
    expect(screen.getAllByRole('listitem').map(item => item.dataset.state)).toEqual(['done', 'active', 'pending', 'pending'])
    fireEvent.click(screen.getByRole('button', { name: C.retry }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByRole('heading', { name: C.ready.title })).toBeVisible()
    expect(fetcher.mock.calls.every(([, options]) => options.method === undefined)).toBe(true)
  })

  it('says a queued check is waiting, with no stage running and no start time', () => {
    render(<SiteResultsGate initial={{ ...running, stage: 0, queued: true, startedAt: new Date(Date.now() - 4 * 60_000).toISOString(), lastActivityAt: new Date().toISOString() }} />)
    expect(screen.getByRole('heading', { name: C.queued.title('example.com') })).toBeVisible()
    expect(screen.getByText(C.queued.body)).toBeVisible()
    expect(screen.getAllByRole('listitem').map(item => item.dataset.state)).toEqual(['pending', 'pending', 'pending', 'pending'])
    expect(screen.getByText(C.requested(4))).toBeVisible()
    expect(screen.queryByText(C.elapsed(4))).not.toBeInTheDocument()
    expect(screen.queryByText(C.slow)).not.toBeInTheDocument()
    expect(screen.queryByText(C.lastActivity, { exact: false })).not.toBeInTheDocument()
  })

  it('does not mark unfinished stages as completed when the run fails', () => {
    render(<SiteResultsGate initial={{ ...running, state: 'failed', stage: 1 }} />)
    expect(screen.getAllByRole('listitem').map(item => item.dataset.state)).toEqual(['done', 'pending', 'pending', 'pending'])
  })

  it('rejects another Site’s status and explains a long wait without making up results', async () => {
    const now = new Date().toISOString()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...running, siteId: 'another-site', state: 'ready' })))
    render(<SiteResultsGate initial={{ ...running, startedAt: new Date(Date.now() - 5 * 60_000).toISOString(), lastActivityAt: now }} />)
    expect(screen.getByText(C.slow)).toBeVisible()
    expect(screen.getByText(C.elapsed(5))).toBeVisible()
    await act(async () => { await vi.advanceTimersByTimeAsync(SITE_RESULTS_GATE_POLL_MS) })
    expect(screen.getByRole('status')).toHaveTextContent(C.disconnected)
    expect(screen.queryByRole('heading', { name: C.ready.title })).not.toBeInTheDocument()
  })
})
