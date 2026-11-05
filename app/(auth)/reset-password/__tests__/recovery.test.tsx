import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import ResetPasswordPage from '../page'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ request: vi.fn(), reset: vi.fn(), push: vi.fn(), success: vi.fn(), token: 'first-token', error: '' }))
vi.mock('@/lib/auth-client', () => ({ authClient: { requestPasswordReset: mocks.request, resetPassword: mocks.reset } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams({ ...(mocks.token ? { token: mocks.token } : {}), ...(mocks.error ? { error: mocks.error } : {}) }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.success } }))
const confirmed = { data: { status: true }, error: null }
type Kind = 'request' | 'reset'
beforeEach(() => { vi.resetAllMocks(); mocks.token = 'first-token'; mocks.error = ''; mocks.request.mockResolvedValue(confirmed); mocks.reset.mockResolvedValue(confirmed) })
afterEach(() => { cleanup(); vi.useRealTimers() })

function fill(kind: Kind) {
  if (kind === 'request') {
    const input = screen.getByLabelText(AUTH.forgotPassword.emailLabel)
    fireEvent.change(input, { target: { value: 'owner@example.com' } })
    return { input, form: input.closest('form')!, value: 'owner@example.com' }
  }
  const input = screen.getByLabelText(AUTH.resetPassword.newPasswordLabel)
  fireEvent.change(input, { target: { value: 'NewPassword123!' } })
  fireEvent.change(screen.getByLabelText(AUTH.resetPassword.confirmPasswordLabel), { target: { value: 'NewPassword123!' } })
  return { input, form: input.closest('form')!, value: 'NewPassword123!' }
}
const mount = (kind: Kind) => render(kind === 'request' ? <ForgotPasswordPage /> : <ResetPasswordPage />)
const failure = (kind: Kind) => kind === 'request' ? AUTH.forgotPassword.error : AUTH.resetPassword.error

it.each(['request', 'reset'] as const)('keeps %s input after an incomplete receipt and accepts only a confirmed retry', async kind => {
  mocks[kind].mockResolvedValueOnce({ data: null, error: null })
  mount(kind)
  const { form, input, value } = fill(kind)
  await act(async () => { fireEvent.submit(form) })
  expect(screen.getByRole('alert')).toHaveTextContent(failure(kind))
  expect(input).toHaveValue(value)
  expect(input).toBeEnabled()
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
  await act(async () => { fireEvent.submit(form) })
  if (kind === 'request') {
    expect(screen.getByText(AUTH.forgotPassword.sentBody)).toBeVisible()
    expect(mocks.push).not.toHaveBeenCalled()
  } else {
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/sign-in')
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(AUTH.resetPassword.success)
    expect(screen.getByRole('link', { name: AUTH.signIn.cta })).toHaveAttribute('href', '/sign-in')
  }
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each(['request', 'reset'] as const)('bounds a stalled %s request and ignores late success during retry', async kind => {
  vi.useFakeTimers()
  let first!: (value: typeof confirmed) => void, second!: (value: typeof confirmed) => void
  mocks[kind].mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  mount(kind)
  const { form, input, value } = fill(kind)
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(mocks[kind]).toHaveBeenCalledOnce()
  const signal = mocks[kind].mock.calls[0][0].fetchOptions.signal as AbortSignal
  expect(input).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(failure(kind))
  expect(input).toHaveValue(value)
  expect(input).toBeEnabled()
  fireEvent.submit(form)
  expect(mocks[kind]).toHaveBeenCalledTimes(2)
  await act(async () => { first(confirmed) })
  expect(input).toBeDisabled()
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(screen.queryByText(AUTH.forgotPassword.sentBody)).not.toBeInTheDocument()
  await act(async () => { second(confirmed) })
  expect(input).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['request', 'reset'] as const)('keeps a rejected native %s request recoverable', async kind => {
  mocks[kind].mockRejectedValueOnce(new Error('Network unavailable'))
  mount(kind)
  const { form, input, value } = fill(kind)
  await act(async () => { fireEvent.submit(form) })
  expect(screen.getByRole('alert')).toHaveTextContent(failure(kind))
  expect(input).toHaveValue(value)
  expect(input).toBeEnabled()
  expect(mocks.push).not.toHaveBeenCalled()
})

it('does not mistake an unspecified server failure for missing email configuration', async () => {
  mocks.request.mockResolvedValueOnce({ data: null, error: { status: 500 } })
  mount('request')
  await act(async () => { fireEvent.submit(fill('request').form) })
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.forgotPassword.error)
  expect(screen.queryByText(AUTH.forgotPassword.notConfigured)).not.toBeInTheDocument()
})

it('uses readable recovery feedback when an error response has no string message', async () => {
  mocks.request.mockResolvedValueOnce({ data: null, error: { message: { invalid: true } } })
  mount('request')
  const { form, input } = fill('request')
  await act(async () => { fireEvent.submit(form) })
  expect(screen.getByRole('alert')).toHaveTextContent(AUTH.forgotPassword.error)
  expect(input).toBeEnabled()
})

it('retires the old reset link and its password draft before handling a new token', async () => {
  let finish!: (value: typeof confirmed) => void
  mocks.reset.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = mount('reset')
  fireEvent.submit(fill('reset').form)
  const signal = mocks.reset.mock.calls[0][0].fetchOptions.signal as AbortSignal
  mocks.token = 'second-token'
  view.rerender(<ResetPasswordPage />)
  expect(signal.aborted).toBe(true)
  expect(screen.getByLabelText(AUTH.resetPassword.newPasswordLabel)).toHaveValue('')
  expect(screen.getByLabelText(AUTH.resetPassword.confirmPasswordLabel)).toHaveValue('')
  await act(async () => { finish(confirmed) })
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
  await act(async () => { fireEvent.submit(fill('reset').form) })
  expect(mocks.reset).toHaveBeenLastCalledWith({ token: 'second-token', newPassword: 'NewPassword123!', fetchOptions: { signal: expect.any(AbortSignal) } })
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/sign-in')
})

it.each(['missing', 'refused'] as const)('offers a new link without submitting a %s reset token', kind => {
  if (kind === 'missing') mocks.token = ''
  else mocks.error = 'INVALID_TOKEN'
  mount('reset')
  expect(screen.getByText(AUTH.resetPassword.invalidBody)).toBeVisible()
  expect(screen.getByRole('link', { name: AUTH.resetPassword.requestNewLink })).toHaveAttribute('href', '/forgot-password')
  expect(mocks.reset).not.toHaveBeenCalled()
})

it('keeps a confirmed reset visible with a native sign-in link if client navigation fails', async () => {
  mocks.push.mockImplementationOnce(() => { throw new Error('Navigation refused') })
  mount('reset')
  await act(async () => { fireEvent.submit(fill('reset').form) })
  expect(screen.getByRole('heading', { name: AUTH.resetPassword.completedTitle })).toBeVisible()
  expect(screen.getByRole('link', { name: AUTH.signIn.cta })).toHaveAttribute('href', '/sign-in')
  expect(screen.queryByLabelText(AUTH.resetPassword.newPasswordLabel)).not.toBeInTheDocument()
})
