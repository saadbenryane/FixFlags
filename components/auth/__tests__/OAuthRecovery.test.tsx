import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthFlow } from '../AuthFlow'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ social: vi.fn(), email: vi.fn(), passkey: vi.fn(), navigate: vi.fn(), track: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({ useRedirectIfAuthenticated: vi.fn() }))
vi.mock('@/hooks/useOAuthProviders', () => ({ useOAuthProviders: () => ({ google: true, github: true, anyEnabled: true, isLoading: false, error: false }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: mocks.social, email: mocks.email, passkey: mocks.passkey }, signUp: { email: vi.fn() } } }))

const google = 'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'
const github = 'https://github.com/login/oauth/authorize?state=fixture'
const receipt = (url = google) => ({ data: { url, redirect: false }, error: null })
const provider = (name = AUTH.oauth.continueWithGoogle) => screen.getByRole('button', { name })
function emailForm() {
  const email = screen.getByLabelText('Email'), password = screen.getByLabelText('Password')
  fireEvent.change(email, { target: { value: 'owner@example.com' } })
  fireEvent.change(password, { target: { value: 'RetainedPassword123!' } })
  return { email, password, form: email.closest('form')! }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('window', { ...window, location: { assign: mocks.navigate } })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('owns the provider redirect and preserves both callback destinations without acknowledging sign-in', async () => {
  mocks.social.mockResolvedValueOnce(receipt())
  const authenticated = vi.fn()
  render(<AuthFlow mode="signup" oauthCallbackURL="/waitlist/builder" oauthNewUserCallbackURL="/waitlist/builder?signup=1" onAuthenticated={authenticated} />)
  await act(async () => { fireEvent.click(provider()) })
  expect(mocks.social).toHaveBeenCalledExactlyOnceWith({ provider: 'google', callbackURL: '/waitlist/builder',
    newUserCallbackURL: '/waitlist/builder?signup=1', disableRedirect: true, fetchOptions: { signal: expect.any(AbortSignal) } })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(google)
  expect(authenticated).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalledWith('signed_up', expect.anything())
})

it('coordinates all methods immediately, times out, and ignores the earlier redirect while retrying', async () => {
  let first!: (value: ReturnType<typeof receipt>) => void, second!: (value: ReturnType<typeof receipt>) => void
  mocks.social.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  render(<AuthFlow mode="signin" />)
  const { email, password, form } = emailForm()
  act(() => {
    fireEvent.click(provider())
    fireEvent.click(provider(AUTH.oauth.continueWithGitHub))
    fireEvent.submit(form)
    fireEvent.click(screen.getByRole('button', { name: AUTH.signIn.passkeyCta }))
  })
  expect(mocks.social).toHaveBeenCalledOnce()
  expect(mocks.email).not.toHaveBeenCalled()
  expect(mocks.passkey).not.toHaveBeenCalled()
  const signal = mocks.social.mock.calls[0][0].fetchOptions.signal as AbortSignal
  expect(form.querySelector('button[type="submit"]')).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.oauth.signInFailed)
  expect(email).toHaveValue('owner@example.com')
  expect(password).toHaveValue('RetainedPassword123!')
  expect(form.querySelector('button[type="submit"]')).toBeEnabled()
  fireEvent.click(provider(AUTH.oauth.continueWithGitHub))
  await act(async () => { first(receipt()) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(provider()).toBeDisabled()
  await act(async () => { second(receipt(github)) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(github)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(provider()).toBeEnabled()
  expect(vi.getTimerCount()).toBe(0)
})

it('refuses a provider start while an email submission is pending in the same render', async () => {
  mocks.email.mockImplementation(() => new Promise(() => {}))
  render(<AuthFlow mode="signin" />)
  const { form } = emailForm()
  act(() => { fireEvent.submit(form); fireEvent.click(provider()) })
  expect(mocks.email).toHaveBeenCalledOnce()
  expect(mocks.social).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(provider()).toBeEnabled()
})

it.each([null, {}, { redirect: true, url: google }, { redirect: false, url: 'javascript:alert(1)' },
  { redirect: false, url: 'https://user:secret@accounts.google.com/auth' }])
('keeps every sign-in method available after an unusable redirect: %j', async data => {
  mocks.social.mockResolvedValueOnce({ data, error: null })
  render(<AuthFlow mode="signin" />)
  const { form } = emailForm()
  await act(async () => { fireEvent.click(provider()) })
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.oauth.signInFailed)
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(provider()).toBeEnabled()
  expect(form.querySelector('button[type="submit"]')).toBeEnabled()
})

it('retires the request when the sign-in view closes without navigating from its late result', async () => {
  let finish!: (value: ReturnType<typeof receipt>) => void
  mocks.social.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<AuthFlow mode="signin" />)
  fireEvent.click(provider())
  const signal = mocks.social.mock.calls[0][0].fetchOptions.signal as AbortSignal
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(receipt()) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('shows the provider refusal beside its controls and permits a different sign-in method', async () => {
  mocks.social.mockResolvedValueOnce({ data: null, error: { message: 'Provider temporarily unavailable' } })
  mocks.email.mockResolvedValueOnce({ data: { user: { id: 'owner' }, token: 'confirmed-session' }, error: null })
  const authenticated = vi.fn()
  render(<AuthFlow mode="signin" onAuthenticated={authenticated} />)
  const { form } = emailForm()
  await act(async () => { fireEvent.click(provider()) })
  expect(screen.getByRole('alert')).toHaveTextContent('Provider temporarily unavailable')
  await act(async () => { fireEvent.submit(form) })
  expect(authenticated).toHaveBeenCalledOnce()
})
