import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UptimeCard } from '../UptimeCard'
import { uptimeTimeline, type UptimeHistory, type UptimeSummary } from '@/lib/uptime/domain'
import { UPTIME_COPY as C } from '@/lib/marketing/copy/uptime'

const summary: UptimeSummary = { enabled: true, targetUrl: 'https://example.com/', state: 'unknown', lastCheckedAt: null,
  nextCheckAt: null, openIncidentCount: 0, segments: uptimeTimeline([], new Date('2026-10-12T12:00:00Z')) }
function history(window: UptimeHistory['window'] = '24h'): UptimeHistory {
  return { ...summary, segments: uptimeTimeline([], new Date('2026-10-12T12:00:00Z'), window), window, probes: [], incidents: [], nextCursor: null }
}
function historyPage(id: string, observedAt: string, nextCursor: string | null): UptimeHistory {
  return { ...history(), nextCursor, probes: [{ id, observedAt, scheduledAt: observedAt, attempt: 1, confirmed: false,
    targetUrl: summary.targetUrl, finalUrl: summary.targetUrl, result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 20 }] }
}
afterEach(() => vi.unstubAllGlobals())
describe('recorded uptime reporting', () => {
  it.each(['certificate_expired', 'dns_failure', 'connection_failed'] as const)('shows the confirming origin for %s even when no probes remain', async reason => {
    const at = '2026-11-03T12:00:00Z', failureOrigin = 'https://edge.example.com:8443'
    const recorded: UptimeHistory = { ...history(), incidentOpen: true, openIncidentCount: 1, incidents: [{
      id: 'retained-incident', targetUrl: summary.targetUrl, failureOrigin,
      startedAt: at, confirmedAt: at, recoveredAt: null, supersededAt: null, reason,
    }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteId: 'site-1', ...recorded })))
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    const incident = (await screen.findByText(C.incidentOpen, { selector: 'strong' })).closest('li')!
    fireEvent.click(within(incident).getByText(C.probeDetails, { selector: 'summary' }))
    expect(within(incident).getByText(summary.targetUrl)).toBeVisible()
    expect(within(incident).getByText(C.reasons[reason] + ' · ' + failureOrigin)).toBeVisible()
  })

  it.each(['recovered', 'paused'] as const)('updates an open history dialog from the newer %s Site snapshot without replacing recorded checks', async change => {
    let finish!: (response: Response) => void
    const old: UptimeSummary = { ...summary, state: 'offline', lastCheckedAt: '2026-11-03T12:00:00Z', openIncidentCount: 1 }
    const recorded: UptimeHistory = { ...historyPage('recorded', '2026-11-03T12:00:00Z', null), ...old,
      incidents: [{ id: 'incident', targetUrl: summary.targetUrl, startedAt: '2026-11-03T12:00:00Z', confirmedAt: '2026-11-03T12:00:00Z', recoveredAt: null, supersededAt: null, reason: 'response_error' }],
      historyScope: { key: 'monitor:1', from: '2026-11-03T00:00:00Z', through: '2026-11-03T12:02:00Z' } }
    recorded.probes[0] = { ...recorded.probes[0], result: 'FAILED', confirmed: true, reason: 'response_error', statusCode: 503 }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...recorded }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetch)
    const page = render(<UptimeCard siteId="site-1" summary={old} summaryReadAt={Date.parse('2026-11-03T12:01:00Z')} referenceTime={Date.parse('2026-11-03T12:06:00Z')} />)
    const card = screen.getByRole('article', { name: C.title })
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    await screen.findByText(C.incidentOpen)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(C.states.offline, { selector: '[data-state]' })).toBeVisible()
    const current: UptimeSummary = change === 'recovered'
      ? { ...old, state: 'online', lastCheckedAt: '2026-11-03T12:05:00Z', openIncidentCount: 0 }
      : { ...old, enabled: false, state: 'paused' }
    page.rerender(<UptimeCard siteId="site-1" summary={current} summaryReadAt={Date.parse('2026-11-03T12:06:00Z')} referenceTime={Date.parse('2026-11-03T12:06:00Z')} />)
    const state = change === 'recovered' ? C.states.online : C.states.paused
    expect(within(dialog).getByText(state, { selector: '[data-state]' })).toBeVisible()
    expect(card).toHaveAttribute('data-state', current.state)
    fireEvent.click(within(dialog).getByText(C.history, { selector: 'summary' }))
    expect(within(dialog).getByText(C.results.FAILED)).toBeVisible()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await act(async () => { finish(Response.json({ siteId: 'site-1', ...recorded, ...current,
      historyScope: { ...recorded.historyScope, through: '2026-11-03T12:06:00Z' },
      incidents: recorded.incidents.map(incident => ({ ...incident, recoveredAt: change === 'recovered' ? '2026-11-03T12:05:00Z' : null })),
    })) })
    expect(within(dialog).getByText(change === 'recovered' ? C.recovered : C.incidentOpen, { selector: 'strong' })).toBeVisible()
    expect(within(dialog).getByText(C.results.FAILED)).toBeVisible()
  })

  it('uses a newer history status in the overview and retains it while closing and reopening the dialog', async () => {
    const old: UptimeSummary = { ...summary, state: 'offline', lastCheckedAt: '2026-11-03T12:00:00Z', openIncidentCount: 1 }
    const recovered: UptimeHistory = { ...history(), ...old, state: 'online', lastCheckedAt: '2026-11-03T12:05:00Z', openIncidentCount: 0,
      historyScope: { key: 'monitor:1', from: '2026-11-03T00:00:00Z', through: '2026-11-03T12:06:00Z' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...recovered }))
      .mockImplementation(() => new Promise<Response>(() => {})))
    render(<UptimeCard siteId="site-1" summary={old} summaryReadAt={Date.parse('2026-11-03T12:01:00Z')} referenceTime={Date.parse('2026-11-03T12:06:00Z')} />)
    const card = screen.getByRole('article', { name: C.title })
    fireEvent.click(within(card).getByRole('button', { name: C.details }))
    await screen.findByText(C.noIncidents)
    expect(card).toHaveAttribute('data-state', 'online')
    expect(within(card).queryByText(C.openIncidents(1))).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(card).toHaveAttribute('data-state', 'online')
    fireEvent.click(within(card).getByRole('button', { name: C.details }))
    expect(card).toHaveAttribute('data-state', 'online')
    expect(within(screen.getByRole('dialog')).getByText(C.states.online, { selector: '[data-state]' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: C.periods['7d'] }))
    expect(card).toHaveAttribute('data-state', 'online')
    expect(within(screen.getByRole('dialog')).getByText(C.states.online, { selector: '[data-state]' })).toBeVisible()
  })

  it('does not repeat a failed history catch-up when another Site read has the same status', async () => {
    const current: UptimeSummary = { ...summary, state: 'online', lastCheckedAt: '2026-11-03T12:05:00Z' }
    const older = { ...history(), state: 'offline', lastCheckedAt: '2026-11-03T12:00:00Z',
      historyScope: { key: 'monitor:1', from: '2026-11-03T00:00:00Z', through: '2026-11-03T12:02:00Z' } }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...older }))
      .mockImplementation(async () => Response.json({}, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const page = render(<UptimeCard siteId="site-1" summary={current} summaryReadAt={Date.parse('2026-11-03T12:06:00Z')} referenceTime={Date.parse('2026-11-03T12:06:00Z')} />)
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    await screen.findByRole('alert')
    expect(fetch).toHaveBeenCalledTimes(2)
    page.rerender(<UptimeCard siteId="site-1" summary={current} summaryReadAt={Date.parse('2026-11-03T12:07:00Z')} referenceTime={Date.parse('2026-11-03T12:07:00Z')} />)
    await act(async () => { await Promise.resolve() })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(within(screen.getByRole('dialog')).getByText(C.states.online, { selector: '[data-state]' })).toBeVisible()
  })

  it('focuses the first newly loaded check when the final history page removes the load button', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...historyPage('newer', '2026-10-12T11:00:00Z', 'newer') }))
      .mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...historyPage('older', '2026-10-12T10:00:00Z', null) }))
    vi.stubGlobal('fetch', fetch)
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    await screen.findByText(C.noIncidents)
    fireEvent.click(screen.getByText(C.history, { selector: 'summary' }))
    const checks = within(screen.getByText(C.history, { selector: 'summary' }).closest('details')!)
    const more = screen.getByRole('button', { name: C.loadMore })
    more.focus()
    fireEvent.click(more)
    const older = await checks.findByText('Oct 12, 2026, 10:00 AM UTC', { selector: 'time' })
    expect(older.closest('li')).toHaveFocus()
    expect(checks.getByText('Oct 12, 2026, 11:00 AM UTC', { selector: 'time' })).toBeVisible()
    expect(screen.queryByRole('button', { name: C.loadMore })).not.toBeInTheDocument()
  })

  it('does not steal focus if the customer moves elsewhere while older checks load', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...historyPage('newer', '2026-10-12T11:00:00Z', 'newer') }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })))
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    await screen.findByText(C.noIncidents)
    fireEvent.click(screen.getByText(C.history, { selector: 'summary' }))
    const checks = within(screen.getByText(C.history, { selector: 'summary' }).closest('details')!)
    const more = screen.getByRole('button', { name: C.loadMore })
    more.focus()
    fireEvent.click(more)
    const period = screen.getByRole('button', { name: C.periods['24h'] })
    period.focus()
    await act(async () => { finish(Response.json({ siteId: 'site-1', ...historyPage('older', '2026-10-12T10:00:00Z', null) })) })
    expect(checks.getByText('Oct 12, 2026, 10:00 AM UTC', { selector: 'time' })).toBeVisible()
    expect(period).toHaveFocus()
  })

  it('keeps the paging control focused on failure and focuses the new check after a successful retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...historyPage('newer', '2026-10-12T11:00:00Z', 'newer') }))
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...historyPage('older', '2026-10-12T10:00:00Z', null) })))
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    await screen.findByText(C.noIncidents)
    fireEvent.click(screen.getByText(C.history, { selector: 'summary' }))
    const checks = within(screen.getByText(C.history, { selector: 'summary' }).closest('details')!)
    const more = screen.getByRole('button', { name: C.loadMore })
    more.focus()
    fireEvent.click(more)
    await screen.findByRole('alert')
    expect(more).toHaveFocus()
    const retry = screen.getByRole('button', { name: C.retry })
    retry.focus()
    fireEvent.click(retry)
    await screen.findByRole('alert')
    const nextRetry = screen.getByRole('button', { name: C.retry })
    expect(nextRetry).toHaveFocus()
    fireEvent.click(nextRetry)
    const older = await checks.findByText('Oct 12, 2026, 10:00 AM UTC', { selector: 'time' })
    expect(older.closest('li')).toHaveFocus()
  })

  it.each(['online', 'offline', 'checking'] as const)('lets an expired %s observation become unknown in both views while retaining incident and probe evidence', async state => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(state === 'checking' ? '2026-11-03T12:04:30Z' : '2026-11-03T12:09:30Z'))
    const at = '2026-11-03T12:00:00.000Z'
    const current = { ...summary, state, lastCheckedAt: at, openIncidentCount: state === 'offline' ? 1 : 0, incidentOpen: state === 'offline' }
    const result = state === 'online' ? 'ONLINE' : 'FAILED'
    const recorded = { ...history(), ...current, incidents: state === 'offline' ? [{ id: 'recorded-incident', targetUrl: summary.targetUrl,
      startedAt: at, confirmedAt: at, recoveredAt: null, supersededAt: null, reason: 'response_error' }] : [],
      probes: [{ id: 'recorded-probe', observedAt: at, scheduledAt: at,
        attempt: 1, confirmed: state === 'offline', targetUrl: summary.targetUrl, result, reason: state === 'online' ? 'response_received' : 'response_error',
        statusCode: state === 'online' ? 200 : 503, durationMs: 20, finalUrl: summary.targetUrl }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...recorded }))
      .mockImplementation(() => new Promise(() => {})))
    const page = render(<UptimeCard siteId="site-1" summary={current} />)
    try {
      const trigger = screen.getByRole('button', { name: C.details })
      expect(trigger).toHaveTextContent(C.states[state])
      fireEvent.click(trigger)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(C.states[state], { selector: '[data-state]' })).toBeVisible()
      fireEvent.click(within(dialog).getByText(C.history, { selector: 'summary' }))
      if (state === 'checking') expect(within(dialog).getByText(`${C.results.FAILED} · ${C.confirmationPending}`)).toBeVisible()
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(trigger).toHaveTextContent(C.states.unknown)
      expect(trigger).not.toHaveTextContent(C.states[state])
      expect(within(dialog).getByText(C.states.unknown, { selector: '[data-state]' })).toBeVisible()
      if (state === 'offline') {
        expect(screen.getByText(C.openIncidents(1))).toBeInTheDocument()
        expect(within(dialog).getByText(C.incidentOpen)).toBeVisible()
      }
      expect(within(dialog).queryByText(`${C.results.FAILED} · ${C.confirmationPending}`)).not.toBeInTheDocument()
      expect(within(dialog).getByText(C.results[result])).toBeVisible()
      expect(within(dialog).getByText(state === 'online' ? /HTTP 200/ : /HTTP 503/)).toBeVisible()
    } finally { page.unmount(); vi.useRealTimers() }
  })

  it('uses new evidence after expiry without remounting the card', () => {
    const expired = { ...summary, state: 'online' as const, lastCheckedAt: '2026-11-03T12:00:00.000Z' }
    const page = render(<UptimeCard siteId="site-1" summary={expired} referenceTime={Date.parse('2026-11-03T12:11:00Z')} />)
    const trigger = screen.getByRole('button', { name: C.details })
    expect(trigger).toHaveTextContent(C.states.unknown)
    page.rerender(<UptimeCard siteId="site-1" summary={{ ...expired, lastCheckedAt: '2026-11-03T12:11:00.000Z' }} referenceTime={Date.parse('2026-11-03T12:11:00Z')} />)
    expect(trigger).toHaveTextContent(C.states.online)
  })

  it('preserves the authored state of an explicit preview source', () => {
    const preview = { ...summary, state: 'online' as const, lastCheckedAt: '2026-11-03T12:00:00.000Z' }
    render(<UptimeCard siteId="sample" summary={preview} historySource={() => ({ ...history(), ...preview })} referenceTime={Date.parse('2026-11-03T12:15:00Z')} />)
    expect(screen.getByRole('button', { name: C.details })).toHaveTextContent(C.states.online)
  })

  it('retains expanded checks when live history refreshes', async () => {
    vi.useFakeTimers()
    const at = '2026-10-12T12:00:00.000Z'
    const makeProbe = (id: string, observedAt: string) => ({ id, observedAt, scheduledAt: observedAt,
      attempt: 1, confirmed: false, targetUrl: summary.targetUrl, result: 'ONLINE' as const,
      reason: 'response_received', statusCode: 200, durationMs: 20, finalUrl: summary.targetUrl })
    const first = { ...history(), historyScope: { key: 'monitor:1', from: '2026-10-11T12:00:00.000Z', through: at },
      probes: [makeProbe('first', '2026-10-12T11:00:00.000Z')], nextCursor: 'first' }
    const older = { ...first, probes: [makeProbe('older', '2026-10-12T10:00:00.000Z')], nextCursor: 'older' }
    const fresh = { ...first, probes: [makeProbe('new', at), ...first.probes] }
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...first }))
      .mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...older }))
      .mockResolvedValueOnce(Response.json({ siteId: 'site-1', ...fresh }))
    vi.stubGlobal('fetch', fetcher)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const view = render(<UptimeCard siteId="site-1" summary={summary} />)
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByText('Check history', { selector: 'summary' }))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Load more checks' }))
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const details = within(dialog).getByText('Check history', { selector: 'summary' }).closest('details')!
      expect(details.querySelectorAll('ul > li')).toHaveLength(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(details).toHaveAttribute('open')
      expect(details.querySelectorAll('ul > li')).toHaveLength(3)
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(within(dialog).getByRole('button', { name: 'Load more checks' })).toBeEnabled()
    } finally { view.unmount(); vi.useRealTimers(); vi.restoreAllMocks() }
  })

  it.each([false, true])('restarts a rejected continuation with a fresh server cursor (restart needs retry: %s)', async restartNeedsRetry => {
    const scope = { key: 'monitor:1', from: '2026-10-11T12:00:00.000Z', through: '2026-10-12T12:00:00.000Z' }
    const response = (page: UptimeHistory) => Response.json({ siteId: 'site-1', ...page, historyScope: scope })
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(historyPage('first', '2026-10-12T11:00:00.000Z', 'cursor-first')))
      .mockResolvedValueOnce(response(historyPage('old', '2026-10-12T10:00:00.000Z', 'cursor-retired')))
      .mockResolvedValueOnce(Response.json({}, { status: 400 }))
    if (restartNeedsRetry) fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }))
    fetcher.mockResolvedValueOnce(response(historyPage('first', '2026-10-12T11:00:00.000Z', 'cursor-new')))
      .mockResolvedValueOnce(response(historyPage('tail', '2026-10-12T09:00:00.000Z', null)))
    vi.stubGlobal('fetch', fetcher)
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: C.details }))
    const dialog = screen.getByRole('dialog')
    const panel = (await within(dialog).findByText(C.history, { selector: 'summary' })).closest('details')!
    fireEvent.click(within(panel).getByText(C.history, { selector: 'summary' }))
    const more = () => within(dialog).getByRole('button', { name: C.loadMore })
    fireEvent.click(more())
    await waitFor(() => expect(panel.querySelectorAll('ul > li')).toHaveLength(2))
    fireEvent.click(more())
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
    expect(fetcher.mock.calls.slice(2, 4).map(([url]) => url)).toEqual([
      '/api/sites/site-1/uptime?window=24h&cursor=cursor-retired', '/api/sites/site-1/uptime?window=24h',
    ])
    if (restartNeedsRetry) {
      await within(dialog).findByRole('alert')
      expect(panel.querySelectorAll('ul > li')).toHaveLength(2)
      expect(within(dialog).queryByRole('button', { name: C.loadMore })).not.toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: C.retry }))
      await waitFor(() => expect(fetcher.mock.calls[4]?.[0]).toBe('/api/sites/site-1/uptime?window=24h'))
    }
    await waitFor(() => expect(panel.querySelectorAll('ul > li')).toHaveLength(1))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(more())
    await waitFor(() => expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/api/sites/site-1/uptime?window=24h&cursor=cursor-new'))
    await waitFor(() => expect(panel.querySelectorAll('ul > li')).toHaveLength(2))
  })

  it('keeps the observation time beside the current state without a fixed cadence', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T12:05:00Z'))
    try {
      render(<UptimeCard siteId="site-1" summary={{ ...summary, state: 'online', lastCheckedAt: '2026-10-24T12:00:00Z' }} />)
      const trigger = screen.getByRole('button', { name: 'Uptime details' })
      expect(within(trigger).getByText('Checked 5 minutes ago')).toHaveAttribute('datetime', '2026-10-24T12:00:00Z')
      expect(trigger).toHaveTextContent('Online')
      expect(screen.queryByText('Every 5 minutes')).not.toBeInTheDocument()
    } finally { now.mockRestore() }
  })

  it('leaves missing observations neutral and never invents an uptime percentage', () => {
    render(<UptimeCard siteId="site-1" summary={summary} />)
    const timeline = screen.getByRole('img')
    expect(timeline.children).toHaveLength(48)
    expect([...timeline.children].every(mark => mark.getAttribute('data-state') === 'unknown')).toBe(true)
    expect(screen.getByText('No checks recorded yet.')).toBeVisible()
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  })
  it('loads the requested history window and exposes recorded periods accessibly', async () => {
    const fetch = vi.fn(async (url: string) => {
      const window = new URL(url, 'http://localhost').searchParams.get('window') as UptimeHistory['window']
      return { ok: true, json: async () => ({ siteId: 'site-1', ...history(window) }) }
    })
    vi.stubGlobal('fetch', fetch)
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByText('Recorded periods')).toBeInTheDocument())
    fireEvent.click(within(dialog).getByText('Check details'))
    expect(within(dialog).getByText('Recorded periods')).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: '7 days' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/sites/site-1/uptime?window=7d', expect.objectContaining({ cache: 'no-store' })))
    await waitFor(() => expect(within(dialog).getByText('Recorded periods').closest('details')!.querySelectorAll('ul li')).toHaveLength(56))
    expect(within(dialog).getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('rejects another site’s response without displaying its history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ siteId: 'another-site', ...history() }) })))
    render(<UptimeCard siteId="site-1" summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Uptime details' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('History could not be loaded.'))
    expect(within(screen.getByRole('dialog')).queryByText('No incidents recorded in this period.')).not.toBeInTheDocument()
  })
})
