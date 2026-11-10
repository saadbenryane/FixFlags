import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SafeFormFixtures } from '../SafeFormFixtures'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const fixture = { id: 'fixture', name: 'Signup', targetUrl: 'https://example.com/signup',
  fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Create account' } },
  successCriterion: { type: 'text', value: 'Welcome' }, resetUrl: 'https://example.com/reset', cleanupUrl: 'https://example.com/cleanup',
  version: 1, lastDryRunVersion: 1, lastDryRunAt: '2026-10-11T00:00:00.000Z', lastDryRunResult: { disposition: 'SUCCEEDED' },
  authorizedAt: null, enabled: true, hasValues: true as const, hasHookSecret: false }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('Safe Form action ownership and evidence', () => {
  it.each(['revoke', 'delete'] as const)('does not let an older background collection undo a confirmed %s while another setup remains active', async action => {
    vi.useFakeTimers()
    const original = { ...fixture, authorizedAt: '2026-11-03T12:00:00Z' }
    const other = { ...fixture, id: 'other', name: 'Other signup', lastDryRunVersion: null, lastDryRunResult: null,
      setupRun: { runId: 'other-run', auditId: 'other-audit', version: 1, state: 'RUNNING', reason: null } }
    const revoked = { ...fixture, version: 2, lastDryRunVersion: null, lastDryRunAt: null, lastDryRunResult: null }
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockResolvedValueOnce(Response.json(action === 'delete' ? { ok: true } : { fixture: revoked }))
      .mockResolvedValueOnce(Response.json({ fixtures: action === 'delete' ? [other] : [revoked, other] }))
    vi.stubGlobal('fetch', fetcher)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const page = render(<SafeFormFixtures siteId="site" initial={[original, other]} />)
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(fetcher).toHaveBeenCalledOnce()
      const card = screen.getByRole('heading', { name: 'Signup', exact: true }).closest('article')!
      await act(async () => { fireEvent.click(within(card).getByRole('button', { name: action === 'delete' ? 'Delete' : 'Revoke' })) })
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
      await act(async () => { finish(Response.json({ fixtures: [original, other] })) })
      expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
      if (action === 'delete') expect(screen.queryByRole('heading', { name: 'Signup', exact: true })).not.toBeInTheDocument()
      else {
        const current = screen.getByRole('heading', { name: 'Signup', exact: true }).closest('article')!
        expect(within(current).getByText('Version 2')).toBeVisible()
        expect(within(current).getByRole('button', { name: 'Authorize' })).toBeDisabled()
      }
      expect(screen.getByRole('heading', { name: 'Other signup' })).toBeVisible()
    } finally { page.unmount(); confirm.mockRestore() }
  })

  it('retires an authorization when its Site leaves before the receipt', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const page = render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal
    page.unmount()
    await act(async () => { finish(Response.json({ fixture: { ...fixture, authorizedAt: '2026-11-03T12:00:00Z' } })) })
    expect(signal.aborted).toBe(true)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not carry private form drafts or a former Site’s fixtures into another Site', () => {
    const page = render(<SafeFormFixtures siteId="first" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Replace settings' }))
    fireEvent.change(screen.getByLabelText('Synthetic email'), { target: { value: 'private@example.invalid' } })
    fireEvent.change(screen.getByLabelText('Hook bearer secret'), { target: { value: 'local-fixture-secret' } })
    page.rerender(<SafeFormFixtures siteId="second" initial={[]} />)
    expect(screen.queryByRole('heading', { name: 'Signup', exact: true })).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('private@example.invalid')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('local-fixture-secret')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a signup test' })).toBeVisible()
  })

  it('cancels a committed action’s follow-up read on exit without publishing its late response', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ fixture: { ...fixture, authorizedAt: '2026-11-03T12:00:00Z' } }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const page = render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Authorized')).toBeVisible()
    const signal = fetcher.mock.calls[1][1].signal as AbortSignal
    page.unmount()
    await act(async () => { finish(Response.json({ fixtures: [fixture] })) })
    expect(signal.aborted).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows durable setup progress and polls the recorded result before enabling authorization', async () => {
    vi.useFakeTimers()
    const pending = { ...fixture, lastDryRunVersion: null, lastDryRunAt: null, lastDryRunResult: null,
      setupRun: { runId: 'run', auditId: 'audit', version: 1, state: 'RETRY_WAIT', reason: 'WORKER_INTERRUPTED' } }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ fixtures: [{ ...fixture, setupRun: { ...pending.setupRun, state: 'COMPLETED', reason: null } }] })))
    render(<SafeFormFixtures siteId="site" initial={[pending]} />)
    expect(screen.getByText(C.fixtures.recovering)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dry run' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeDisabled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(screen.getByText('Dry run passed. Authorization required.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeEnabled()
  })

  it('retains setup idempotency after an uncertain response so retry cannot submit a second test', async () => {
    const pending = { ...fixture, lastDryRunVersion: null, lastDryRunAt: null, lastDryRunResult: null,
      setupRun: { runId: 'run', auditId: 'audit', version: 1, state: 'QUEUED', reason: null } }
    const fetch = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce(Response.json({ fixture: pending }, { status: 202 }))
      .mockResolvedValue(Response.json({ fixtures: [pending] }))
    vi.stubGlobal('fetch', fetch)
    render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }))
    expect(await screen.findByText(C.interrupted)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }))
    expect(await screen.findByText(C.fixtures.dryRun)).toBeInTheDocument()
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1][1].headers['Idempotency-Key'])
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeDisabled()
  })

  it.each([
    { siteId: 'site', version: 1, reuse: true },
    { siteId: 'other-site', version: 1, reuse: false },
    { siteId: 'site', version: 2, reuse: false },
  ])('recovers setup identity only for the same Site and configuration on reopening: %j', async ({ siteId, version, reuse }) => {
    const pending = { ...fixture, version, lastDryRunVersion: null, lastDryRunAt: null, lastDryRunResult: null,
      setupRun: { runId: 'run', auditId: 'audit', version, state: 'QUEUED', reason: null } }
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(Response.json({ fixture: pending }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ fixtures: [pending] }))
    vi.stubGlobal('fetch', fetcher)
    const page = render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }))
    await screen.findByText(C.interrupted)
    const firstKey = fetcher.mock.calls[0][1].headers['Idempotency-Key']
    page.unmount()
    render(<SafeFormFixtures siteId={siteId} initial={[{ ...fixture, version }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }))
    await screen.findByText(C.fixtures.dryRun)
    const nextKey = fetcher.mock.calls[1][1].headers['Idempotency-Key']
    expect(typeof nextKey).toBe('string')
    expect(nextKey === firstKey).toBe(reuse)
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeDisabled()
  })

  it('rejects malformed successes rather than claiming authorization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({})))
    render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
    expect(await screen.findByText(C.invalidResponse)).toBeInTheDocument()
    expect(screen.getByText('Dry run passed. Authorization required.')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('serializes duplicate submission before pending state renders', async () => {
    let complete!: (value: Response) => void
    const fetch = vi.fn(() => new Promise<Response>(resolve => { complete = resolve }))
    vi.stubGlobal('fetch', fetch)
    render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    const button = screen.getByRole('button', { name: 'Authorize' })
    fireEvent.click(button); fireEvent.click(button)
    expect(fetch).toHaveBeenCalledTimes(1)
    complete(Response.json({}, { status: 409 }))
    await waitFor(() => expect(button).toBeEnabled())
  })
  it('retains the saved result when subsequent refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => options.method === 'POST'
      ? Response.json({ fixture: { ...fixture, authorizedAt: '2026-10-11T01:00:00.000Z' } }) : Promise.reject(new Error('offline'))))
    render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
    expect(await screen.findByText(C.refreshPending)).toBeInTheDocument()
    expect(screen.getByText('Authorized')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('keeps the draft open after session expiry and offers sign-in without replacing this tab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 401 })))
    render(<SafeFormFixtures siteId="site" initial={[fixture]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Replace settings' }))
    fireEvent.change(screen.getByLabelText('Test name'), { target: { value: 'My retained draft' } })
    fireEvent.change(screen.getByLabelText('Synthetic email'), { target: { value: 'fixture@example.invalid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save signup test' }))
    expect(await screen.findByText(C.signIn)).toBeInTheDocument()
    expect(screen.getByLabelText('Test name')).toHaveValue('My retained draft')
    expect(screen.getByRole('link', { name: C.signInAction })).toHaveAttribute('target', '_blank')
  })
})
