import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteMonitoringActivation } from '../SiteMonitoringActivation'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { MONITORING_COPY as C } from '@/lib/marketing/copy'
const refresh = vi.fn().mockResolvedValue(undefined)
const fixture = { site: { url: 'https://example.com/' }, outcomes: [], watch: { interval: null, nextRunAt: null, state: 'off' }, settings: { notificationLevel: 'FLAGS', notifyOnRecovery: true } } as unknown as SiteHomeView
function response(body: unknown, ok = true) { return { ok, json: async () => body } }
function show(view = fixture, owner = true) { return render(<SiteMonitoringActivation siteId="site-1" view={view} owner={owner} checking={false} onRefresh={refresh} />) }
async function open() { fireEvent.click(screen.getByRole('button', { name: C.turnOn })); return screen.findByRole('combobox', { name: C.cadence }) }
describe('monitoring activation experience', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('keeps anonymous context and uses the existing account claim flow', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); show(fixture, false)
    fireEvent.click(screen.getByRole('button', { name: C.turnOn }))
    expect(screen.getByRole('link', { name: C.signUp })).toHaveAttribute('href', '/sign-up?next=%2Fsites%2Fsite-1')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('shows only permitted cadence and preserves broad analysis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ intervals: ['weekly'] })))
    show(); await open()
    expect(screen.getByRole('option', { name: C.weekly })).toBeInTheDocument(); expect(screen.queryByRole('option', { name: C.daily })).not.toBeInTheDocument()
    expect(screen.getByText(C.scope)).toBeVisible(); expect(screen.getByRole('link', { name: C.expand })).toBeVisible()
  })
  it('reports saved schedule separately from the first check', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ intervals: ['weekly'] })).mockResolvedValue(response({ ok: true, interval: 'weekly', firstCheck: 'unavailable' }))
    vi.stubGlobal('fetch', fetch); show(); await open(); fireEvent.click(screen.getAllByRole('button', { name: C.turnOn }).at(-1)!)
    expect(await screen.findByText(C.checkFailed)).toBeVisible(); expect(screen.getByRole('button', { name: C.retry })).toBeVisible()
    expect(refresh).toHaveBeenCalled(); expect(screen.queryByText(C.pageClear)).not.toBeInTheDocument()
  })
  it('retains recoverable coverage after schedule failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ intervals: ['weekly'] })).mockResolvedValue(response({ ok: false, stage: 'schedule', message: C.scheduleFailed }, false)))
    show(); await open(); fireEvent.click(screen.getAllByRole('button', { name: C.turnOn }).at(-1)!)
    expect(await screen.findByText(C.scheduleFailed)).toBeVisible(); expect(screen.getByRole('button', { name: C.retry })).toBeVisible()
  })
  it('does not call a scheduled first check a success', () => {
    show({ ...fixture, watch: { ...fixture.watch, interval: 'weekly', nextRunAt: '2026-10-17T09:00:00Z', state: 'watching' }, outcomes: [{ id: 'p1', slug: 'page-loads', name: 'This page loads', kind: 'AVAILABILITY', enabled: true, confirmedAt: '2026-10-10T09:00:00Z', bindings: [{ required: true }], lastVerifiedAt: null, state: 'COULD_NOT_VERIFY' }] } as SiteHomeView)
    expect(screen.getByText(C.firstPending)).toBeVisible(); expect(screen.queryByText(C.pageClear)).not.toBeInTheDocument()
  })
  it('makes loading failure retryable without assuming weekly access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response({ intervals: ['weekly'] })))
    show(); fireEvent.click(screen.getByRole('button', { name: C.turnOn })); await screen.findByText(C.unavailable)
    fireEvent.click(screen.getByRole('button', { name: C.retry })); expect(await screen.findByRole('combobox')).toBeVisible()
  })
  it('does not issue duplicate activation while the first request is pending', async () => {
    let resolve!: (value: unknown) => void
    const fetch = vi.fn().mockResolvedValueOnce(response({ intervals: ['weekly'] })).mockImplementation(() => new Promise(r => { resolve = r }))
    vi.stubGlobal('fetch', fetch); show(); await open(); fireEvent.click(screen.getAllByRole('button', { name: C.turnOn }).at(-1)!)
    const pending = screen.getByRole('button', { name: C.activating }); expect(pending).toBeDisabled(); fireEvent.click(pending)
    expect(fetch).toHaveBeenCalledTimes(2); resolve(response({ ok: true, interval: 'weekly', firstCheck: 'requested' }))
    await waitFor(() => expect(screen.getByText(C.queued)).toBeVisible())
  })
})
