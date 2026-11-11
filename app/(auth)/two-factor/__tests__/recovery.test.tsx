import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TwoFactorPage from '../page'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ passkey: vi.fn(), backup: vi.fn(), replace: vi.fn(), track: vi.fn(), destination: '/post-login?next=%2Fsites%2Fsite' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/hooks/useAuthRedirect', () => ({ useAuthRedirect: () => ({ postLoginHref: mocks.destination, signInHref: () => '/sign-in?next=%2Fsites%2Fsite' }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { passkey: mocks.passkey }, twoFactor: { verifyBackupCode: mocks.backup } } }))
const C = AUTH.twoFactor
const passkey = { data: { user: { id: 'owner' }, session: { id: 'session', token: 'session-token', userId: 'owner' } }, error: null }
const backup = { data: { user: { id: 'owner' }, token: 'session-token' }, error: null }
beforeEach(() => { vi.resetAllMocks(); mocks.destination = '/post-login?next=%2Fsites%2Fsite'; mocks.passkey.mockResolvedValue(passkey); mocks.backup.mockResolvedValue(backup) })
afterEach(() => { cleanup(); vi.useRealTimers() })
function code() {
  const input = screen.getByLabelText(C.backupPlaceholder)
  fireEvent.change(input, { target: { value: ' fixture-backup-code ' } })
  return { input, form: input.closest('form')! }
}

it.each([
  ['missing session data', undefined], ['empty session data', {}],
  ['a session for another owner', { user: { id: 'another-owner' }, session: passkey.data.session }],
])
('does not continue from an incomplete or mismatched passkey session: %s', async (_session, data) => {
  mocks.passkey.mockResolvedValueOnce({ data, error: null })
  render(<TwoFactorPage />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.passkeyCta })) })
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.passkeyErrors.twoFactorCancelled)
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: C.passkeyCta })).toBeEnabled()
})

it('retains a refused backup code and continues only after a confirmed session', async () => {
  mocks.backup.mockResolvedValueOnce({ data: { user: { id: 'owner' }, token: null }, error: null })
  render(<TwoFactorPage />)
  const { input, form } = code()
  await act(async () => { fireEvent.submit(form) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.backupCodeError)
  expect(input).toHaveValue(' fixture-backup-code ')
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  await act(async () => { fireEvent.submit(form) })
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(mocks.destination)
  expect(mocks.track).toHaveBeenCalledExactlyOnceWith('signed_in', { method: 'backup_code' })
})

it('bounds a stalled backup-code check without replaying it or accepting its late session', async () => {
  vi.useFakeTimers()
  let first!: (value: typeof backup) => void, retry!: (value: typeof backup) => void
  mocks.backup.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { retry = resolve }))
  render(<TwoFactorPage />)
  fireEvent.click(screen.getByRole('checkbox', { name: C.trustDevice }))
  const { input, form } = code()
  act(() => { fireEvent.submit(form); fireEvent.submit(form); fireEvent.click(screen.getByRole('button', { name: C.passkeyCta })) })
  expect(mocks.backup).toHaveBeenCalledOnce()
  expect(mocks.passkey).not.toHaveBeenCalled()
  const signal = mocks.backup.mock.calls[0][0].fetchOptions.signal as AbortSignal
  expect(screen.getByRole('checkbox', { name: C.trustDevice })).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(C.backupCodeError)
  expect(input).toHaveValue(' fixture-backup-code ')
  expect(input).toBeEnabled()
  fireEvent.submit(form)
  await act(async () => { first(backup) })
  expect(input).toBeDisabled()
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  await act(async () => { retry(backup) })
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(mocks.destination)
  expect(mocks.backup).toHaveBeenLastCalledWith({ code: 'fixture-backup-code', trustDevice: false, fetchOptions: { signal: expect.any(AbortSignal) } })
})

it('retains native passkey timing and prevents backup verification while it is pending', async () => {
  vi.useFakeTimers()
  let finish!: (value: typeof passkey) => void
  mocks.passkey.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<TwoFactorPage />)
  const { form } = code()
  act(() => { fireEvent.click(screen.getByRole('button', { name: C.passkeyCta })); fireEvent.submit(form) })
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(mocks.passkey).toHaveBeenCalledExactlyOnceWith()
  expect(mocks.backup).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: C.passkeyCta })).toBeDisabled()
  await act(async () => { finish(passkey) })
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(mocks.destination)
})

it.each(['passkey', 'backup'] as const)('ignores a %s session arriving after the second-factor form closes', async method => {
  let finish!: (value: unknown) => void
  mocks[method].mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<TwoFactorPage />)
  if (method === 'passkey') fireEvent.click(screen.getByRole('button', { name: C.passkeyCta }))
  else fireEvent.submit(code().form)
  const signal = method === 'backup' ? mocks.backup.mock.calls[0][0].fetchOptions.signal as AbortSignal : null
  view.unmount()
  await act(async () => { finish(method === 'passkey' ? passkey : backup) })
  if (signal) expect(signal.aborted).toBe(true)
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
})

it('retires a pending challenge continuation when its post-login destination changes', async () => {
  let finish!: (value: typeof backup) => void
  mocks.backup.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<TwoFactorPage />)
  fireEvent.submit(code().form)
  const signal = mocks.backup.mock.calls[0][0].fetchOptions.signal as AbortSignal
  mocks.destination = '/post-login?next=%2Fdashboard'
  view.rerender(<TwoFactorPage />)
  expect(signal.aborted).toBe(true)
  expect(screen.getByLabelText(C.backupPlaceholder)).toHaveValue('')
  await act(async () => { finish(backup) })
  expect(mocks.replace).not.toHaveBeenCalled()
})
