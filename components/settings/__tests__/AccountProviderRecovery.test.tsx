import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConnectedAccounts } from '../ConnectedAccounts'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ link: vi.fn(), navigate: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { linkSocial: mocks.link } }))
vi.mock('../PasskeyTwoFactorSettings', () => ({ PasskeyTwoFactorSettings: () => null }))
vi.mock('../AccountSettingsForms', () => ({ PasswordSettings: () => null }))
const C = AUTH.connectedAccounts
const google = 'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'
const github = 'https://github.com/login/oauth/authorize?state=fixture'
const receipt = (url = google) => ({ data: { url, redirect: false }, error: null })
const props = { email: 'owner@example.com', emailVerified: true, hasPassword: true, passkeyCount: 1,
  linkedProviders: [], twoFactorEnabled: false, availableProviders: ['google', 'github'] as Array<'google' | 'github'> }
const button = (provider = C.google) => screen.getByRole('button', { name: C.connectProvider(provider) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('window', { ...window, location: { assign: mocks.navigate } })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it.each(['refused', 'disconnected'] as const)('explains a %s provider-link request and permits retry', async kind => {
  if (kind === 'refused') mocks.link.mockResolvedValueOnce({ data: null, error: { message: 'Provider refused linking' } })
  else mocks.link.mockRejectedValueOnce(new Error('Connection lost'))
  mocks.link.mockResolvedValueOnce(receipt())
  render(<ConnectedAccounts {...props} />)
  await act(async () => { fireEvent.click(button()) })
  expect(screen.getByRole('alert')).toHaveTextContent(kind === 'refused' ? 'Provider refused linking' : C.linkError)
  expect(button()).toBeEnabled()
  expect(button(C.github)).toBeEnabled()
  expect(mocks.navigate).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(button()) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(google)
  expect(mocks.link).toHaveBeenLastCalledWith({ provider: 'google', callbackURL: '/settings', disableRedirect: true,
    fetchOptions: { signal: expect.any(AbortSignal) } })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Connected')).not.toBeInTheDocument()
})

it.each([
  null, {}, { redirect: false, url: '' }, { redirect: true, url: google },
  { redirect: false, url: 'javascript:alert(1)' }, { redirect: false, url: 'http://accounts.google.com/auth' },
  { redirect: false, url: 'https://user:secret@accounts.google.com/auth' },
])('keeps the account view recoverable when no usable provider redirect is confirmed: %j', async data => {
  mocks.link.mockResolvedValueOnce({ data, error: null })
  render(<ConnectedAccounts {...props} />)
  await act(async () => { fireEvent.click(button()) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.linkError)
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(button()).toBeEnabled()
})

it('bounds a stalled request, blocks duplicate provider submissions, and ignores its late redirect during retry', async () => {
  vi.useFakeTimers()
  let first!: (value: ReturnType<typeof receipt>) => void, second!: (value: ReturnType<typeof receipt>) => void
  mocks.link.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  render(<ConnectedAccounts {...props} />)
  act(() => { fireEvent.click(button()); fireEvent.click(button(C.github)) })
  expect(mocks.link).toHaveBeenCalledOnce()
  const signal = mocks.link.mock.calls[0][0].fetchOptions.signal as AbortSignal
  expect(button()).toHaveAttribute('aria-busy', 'true')
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(C.linkError)
  fireEvent.click(button(C.github))
  expect(mocks.link).toHaveBeenCalledTimes(2)
  await act(async () => { first(receipt()) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(button(C.github)).toBeDisabled()
  await act(async () => { second(receipt(github)) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(github)
  expect(button(C.github)).toBeEnabled()
  expect(vi.getTimerCount()).toBe(0)
})

it('retires a provider request when the account view is replaced', async () => {
  let finish!: (value: ReturnType<typeof receipt>) => void
  mocks.link.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(receipt(github))
  const view = render(<ConnectedAccounts key="owner-a" {...props} />)
  fireEvent.click(button())
  const signal = mocks.link.mock.calls[0][0].fetchOptions.signal as AbortSignal
  view.rerender(<ConnectedAccounts key="owner-b" {...props} email="another@example.com" />)
  await act(async () => { finish(receipt()) })
  expect(signal.aborted).toBe(true)
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(button(C.github)).toBeEnabled()
  await act(async () => { fireEvent.click(button(C.github)) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(github)
})

it('keeps retry available if the browser refuses navigation', async () => {
  mocks.link.mockResolvedValueOnce(receipt())
  mocks.navigate.mockImplementationOnce(() => { throw new Error('Navigation refused') })
  render(<ConnectedAccounts {...props} />)
  await act(async () => { fireEvent.click(button()) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.linkError)
  expect(button()).toBeEnabled()
})
