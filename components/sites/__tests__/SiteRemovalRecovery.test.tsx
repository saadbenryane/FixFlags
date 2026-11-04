import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SiteSettingsControls } from '../SiteSettingsControls'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { ACCOUNT_CHECK_COPY as A } from '@/lib/marketing/copy/account-checks'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
const accounts: AccountChecksView = { enabled: true, eligible: true, ready: true, canCleanup: true,
  reason: null, cleanupUnavailableReason: null, results: [],
  accounts: [{ purpose: 'disposable', email: 'synthetic@fixture.invalid', state: 'ACTIVE' }] }
function props(current = accounts) {
  const initial = siteViewFixture()
  return { siteId: initial.site.siteId, watch: initial.watch,
    initial: { ...initial.settings, accountChecks: current }, onRefresh: vi.fn().mockResolvedValue(undefined) }
}
function openRemoval() { fireEvent.click(screen.getByRole('button', { name: S.remove })); return screen.getByRole('dialog') }
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('keeps cleanup failure and its retry inside the active removal dialog', async () => {
  const current = props()
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ message: 'Cleanup could not be requested.' }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ runId: 'cleanup-run', auditId: 'cleanup-audit', outcomeIds: [], reused: false }))
  vi.stubGlobal('fetch', fetcher)
  render(<SiteSettingsControls {...current} />)
  const dialog = openRemoval()
  fireEvent.click(within(dialog).getByRole('button', { name: A.cleanup }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cleanup could not be requested.')
  expect(within(dialog).getByRole('button', { name: A.cleanup })).toBeEnabled()
  expect(within(dialog).getByRole('button', { name: S.remove })).toBeDisabled()
  expect(current.onRefresh).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: A.cleanup }))
  expect(await within(dialog).findByRole('status')).toHaveTextContent(A.requested)
  expect(current.onRefresh).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[1][1].headers['Idempotency-Key']).toBe(fetcher.mock.calls[0][1].headers['Idempotency-Key'])
  expect(push).not.toHaveBeenCalled()
})

it('keeps a refused removal open with a clear error and permits an explicit retry', async () => {
  const current = props({ ...accounts, accounts: [] })
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ message: 'The Site could not be removed.' }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ ok: true }))
  vi.stubGlobal('fetch', fetcher)
  render(<SiteSettingsControls {...current} />)
  const dialog = openRemoval()
  fireEvent.click(within(dialog).getByRole('button', { name: S.remove }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('The Site could not be removed.')
  await waitFor(() => expect(current.onRefresh).toHaveBeenCalledOnce())
  expect(dialog).toBeVisible()
  expect(within(dialog).getByRole('button', { name: S.remove })).toBeEnabled()
  fireEvent.click(within(dialog).getByRole('button', { name: S.remove }))
  await waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith('/dashboard'))
})

it('requires a fresh acknowledgement when refreshed remaining accounts change after refusal', async () => {
  const current = props()
  const next = props({ ...accounts, accounts: [{ ...accounts.accounts[0], state: 'DELETING' }] })
  current.onRefresh.mockImplementation(async () => { view.rerender(<SiteSettingsControls {...next} />) })
  const fetcher = vi.fn().mockResolvedValue(Response.json({ message: 'The remaining test accounts changed.' }, { status: 409 }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<SiteSettingsControls {...current} />)
  const dialog = openRemoval()
  fireEvent.click(within(dialog).getByRole('checkbox', { name: A.removalAcknowledgement }))
  fireEvent.click(within(dialog).getByRole('button', { name: S.remove }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('The remaining test accounts changed.')
  await waitFor(() => expect(within(dialog).getByRole('checkbox', { name: A.removalAcknowledgement })).not.toBeChecked())
  expect(within(dialog).getByRole('button', { name: S.remove })).toBeDisabled()
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ acknowledgeRemainingAccounts: true,
    remainingAccounts: [{ email: accounts.accounts[0].email, state: 'ACTIVE' }] })
  expect(push).not.toHaveBeenCalled()
})

it('does not bring an unrelated settings failure into a fresh removal confirmation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Email preference could not be saved.' }, { status: 503 })))
  render(<SiteSettingsControls {...props()} />)
  fireEvent.change(screen.getByRole('combobox', { name: S.emailMe }), { target: { value: 'OFF' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Email preference could not be saved.')
  openRemoval()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('retires a removal request when its Site view closes without redirecting from a late receipt', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetcher)
  const current = props({ ...accounts, accounts: [] })
  const view = render(<SiteSettingsControls {...current} />)
  const dialog = openRemoval()
  fireEvent.click(within(dialog).getByRole('button', { name: S.remove }))
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(Response.json({ ok: true })) })
  expect(push).not.toHaveBeenCalled()
  expect(current.onRefresh).not.toHaveBeenCalled()
})
