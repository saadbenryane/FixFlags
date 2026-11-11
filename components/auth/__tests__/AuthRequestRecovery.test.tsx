import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthFlow } from '../AuthFlow'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), track: vi.fn(),
  signIn: vi.fn(), signUp: vi.fn(), resend: vi.fn(), passkey: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({ useRedirectIfAuthenticated: vi.fn() }))
vi.mock('@/hooks/useOAuthProviders', () => ({ useOAuthProviders: () => ({ google: false, github: false, anyEnabled: false, isLoading: false, error: false }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { email: mocks.signIn, passkey: mocks.passkey }, signUp: { email: mocks.signUp }, sendVerificationEmail: mocks.resend } }))

beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers() })
const authenticated = { data: { token: 'confirmed-session', user: { id: 'confirmed-user' } }, error: null }
const passkeyAuthenticated = { data: { user: { id: 'confirmed-user' }, session: { id: 'session', token: 'confirmed-session', userId: 'confirmed-user' } }, error: null }

function fillEmail() {
  const email = screen.getByLabelText('Email'), password = screen.getByLabelText('Password')
  fireEvent.change(email, { target: { value: 'owner@example.com' } })
  fireEvent.change(password, { target: { value: 'RetainedPassword123!' } })
  return { email, password, form: email.closest('form')! }
}

it.each(['signin', 'signup'] as const)('releases a stalled %s request after 30 seconds and ignores its late success during a retry', async mode => {
  const request = mode === 'signin' ? mocks.signIn : mocks.signUp
  let first!: (receipt: typeof authenticated) => void, second!: (receipt: typeof authenticated) => void
  request.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  const onAuthenticated = vi.fn()
  render(<AuthFlow mode={mode} onAuthenticated={onAuthenticated} />)
  const { email, password, form } = fillEmail()
  const label = mode === 'signup' ? AUTH.signUp.cta : AUTH.signIn.cta
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(request).toHaveBeenCalledOnce()
  const signal = request.mock.calls[0][0].fetchOptions.signal as AbortSignal
  await act(async () => { await vi.advanceTimersByTimeAsync(29_999) })
  expect(onAuthenticated).not.toHaveBeenCalled()
  expect(signal.aborted).toBe(false)
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'signup' ? AUTH.signUp.unexpectedError : AUTH.signIn.unexpectedError)
  expect(email).toHaveValue('owner@example.com')
  expect(password).toHaveValue('RetainedPassword123!')
  expect(screen.getByRole('button', { name: label, exact: true })).toBeEnabled()
  fireEvent.submit(form)
  expect(request).toHaveBeenCalledTimes(2)
  await act(async () => { first(authenticated) })
  expect(onAuthenticated).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalledWith(mode === 'signup' ? 'signed_up' : 'signed_in', expect.anything())
  expect(form.querySelector('button[type="submit"]')).toBeDisabled()
  await act(async () => { second(authenticated) })
  expect(onAuthenticated).toHaveBeenCalledOnce()
  expect(request).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it('releases a stalled verification-link request without falsely acknowledging its late result', async () => {
  mocks.signUp.mockResolvedValue({ data: { token: null, user: { id: 'pending-user' } }, error: null })
  let finish!: (receipt: { data: { status: boolean }; error: null }) => void
  mocks.resend.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce({ data: { status: true }, error: null })
  const onAuthenticated = vi.fn()
  render(<AuthFlow mode="signup" onAuthenticated={onAuthenticated} />)
  const { form } = fillEmail()
  await act(async () => { fireEvent.submit(form) })
  const resend = screen.getByRole('button', { name: AUTH.emailVerification.resend })
  act(() => { fireEvent.click(resend); fireEvent.click(resend) })
  expect(mocks.resend).toHaveBeenCalledOnce()
  const signal = mocks.resend.mock.calls[0][0].fetchOptions.signal as AbortSignal
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.emailVerification.error)
  expect(resend).toBeEnabled()
  await act(async () => { finish({ data: { status: true }, error: null }) })
  expect(screen.queryByText(AUTH.emailVerification.resent)).not.toBeInTheDocument()
  expect(onAuthenticated).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(resend) })
  expect(screen.getByText(AUTH.emailVerification.resent)).toBeVisible()
  expect(mocks.resend).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it('preserves the native passkey wait and prevents an overlapping email submission', async () => {
  let finish!: (receipt: typeof passkeyAuthenticated) => void
  mocks.passkey.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const onAuthenticated = vi.fn()
  render(<AuthFlow mode="signin" onAuthenticated={onAuthenticated} />)
  const { form } = fillEmail()
  fireEvent.click(screen.getByRole('button', { name: AUTH.signIn.passkeyCta }))
  fireEvent.submit(form)
  expect(mocks.passkey).toHaveBeenCalledOnce()
  expect(mocks.signIn).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(onAuthenticated).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: AUTH.signIn.passkeyCta })).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await act(async () => { finish(passkeyAuthenticated) })
  expect(onAuthenticated).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it.each([
  ['missing session data', undefined],
  ['a user without a session', { user: { id: 'confirmed-user' } }],
  ['a session for another user', { user: { id: 'another-user' }, session: passkeyAuthenticated.data.session }],
])
('rejects an incomplete or inconsistent passkey session before authentication callbacks: %s', async (_session, data) => {
  mocks.passkey.mockResolvedValueOnce({ data, error: null }).mockResolvedValueOnce(passkeyAuthenticated)
  const onAuthenticated = vi.fn()
  render(<AuthFlow mode="signin" onAuthenticated={onAuthenticated} />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: AUTH.signIn.passkeyCta })) })
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.passkeyErrors.cancelled)
  expect(onAuthenticated).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalledWith('signed_in', expect.anything())
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: AUTH.signIn.passkeyCta })) })
  expect(onAuthenticated).toHaveBeenCalledOnce()
})

it.each(['email', 'passkey'] as const)('retires a pending %s sign-in when its form closes', async method => {
  let finish!: (value: unknown) => void
  const request = method === 'email' ? mocks.signIn : mocks.passkey
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const onAuthenticated = vi.fn()
  const view = render(<AuthFlow mode="signin" onAuthenticated={onAuthenticated} />)
  if (method === 'email') fireEvent.submit(fillEmail().form)
  else fireEvent.click(screen.getByRole('button', { name: AUTH.signIn.passkeyCta }))
  const signal = method === 'email' ? request.mock.calls[0][0].fetchOptions.signal as AbortSignal : null
  view.unmount()
  await act(async () => { finish(method === 'email' ? authenticated : passkeyAuthenticated) })
  if (signal) expect(signal.aborted).toBe(true)
  expect(onAuthenticated).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalledWith('signed_in', expect.anything())
})
