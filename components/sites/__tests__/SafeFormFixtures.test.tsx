import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SafeFormFixtures } from '../SafeFormFixtures'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const fixture = { id: 'fixture', name: 'Signup', targetUrl: 'https://example.com/signup',
  fieldMapping: { fields: { email: { by: 'label', value: 'Email' } }, submit: { by: 'role', role: 'button', value: 'Create account' } },
  successCriterion: { type: 'text', value: 'Welcome' }, resetUrl: 'https://example.com/reset', cleanupUrl: 'https://example.com/cleanup',
  version: 1, lastDryRunVersion: 1, lastDryRunAt: '2026-10-11T00:00:00.000Z', lastDryRunResult: { disposition: 'SUCCEEDED' },
  authorizedAt: null, enabled: true, hasValues: true as const, hasHookSecret: false }
beforeEach(() => vi.clearAllMocks())
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('Safe Form action ownership and evidence', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Replace configuration' }))
    fireEvent.change(screen.getByLabelText('Fixture name'), { target: { value: 'My retained draft' } })
    fireEvent.change(screen.getByLabelText('Synthetic email'), { target: { value: 'fixture@example.invalid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save fixture' }))
    expect(await screen.findByText(C.signIn)).toBeInTheDocument()
    expect(screen.getByLabelText('Fixture name')).toHaveValue('My retained draft')
    expect(screen.getByRole('link', { name: C.signInAction })).toHaveAttribute('target', '_blank')
  })
})
