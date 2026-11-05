import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ManageSubscriptionButton } from '../ManageSubscriptionButton'
import { SYSTEM_COPY } from '@/lib/marketing/copy/errors'

const mocks = vi.hoisted(() => ({ user: { id: 'owner-a' }, navigate: vi.fn(), track: vi.fn(), error: vi.fn() }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: mocks.user }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))
vi.mock('sonner', () => ({ toast: { error: mocks.error } }))
const destination = 'https://billing.example/session/fixture'
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.user = { id: 'owner-a' }
  vi.stubGlobal('window', { ...window, location: { assign: mocks.navigate } })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('starts one portal request and redirects only after confirming its destination', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  render(<ManageSubscriptionButton />)
  const button = screen.getByRole('button', { name: 'Manage subscription' })
  act(() => { fireEvent.click(button); fireEvent.click(button) })
  expect(fetch).toHaveBeenCalledOnce()
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  await act(async () => { finish(Response.json({ url: destination })) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(destination)
  expect(mocks.track).toHaveBeenCalledExactlyOnceWith('managed_subscription')
})

it.each([null, {}, { url: '' }, { url: 123 }, { url: 'javascript:alert(1)' }, { url: 'http://billing.example/session' }, { url: 'https://user:secret@billing.example/session' }])
('keeps billing available after an invalid destination: %j', async body => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)))
  render(<ManageSubscriptionButton />)
  await act(async () => { fireEvent.click(screen.getByRole('button')) })
  expect(screen.getByRole('button', { name: 'Manage subscription' })).toBeEnabled()
  expect(mocks.error).toHaveBeenCalledOnce()
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
})

it('releases a stalled request and ignores its late redirect while a retry is pending', async () => {
  const reads: Array<{ signal: AbortSignal; finish: (response: Response) => void }> = []
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>(finish => { reads.push({ signal: options.signal, finish }) })))
  render(<ManageSubscriptionButton />)
  fireEvent.click(screen.getByRole('button'))
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(reads[0].signal.aborted).toBe(true)
  expect(mocks.error).toHaveBeenCalledExactlyOnceWith(SYSTEM_COPY.errors.billingPortal)
  expect(screen.getByRole('button', { name: 'Manage subscription' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button'))
  await act(async () => { reads[0].finish(Response.json({ url: 'https://billing.example/obsolete' })) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(screen.getByRole('button')).toBeDisabled()
  await act(async () => { reads[1].finish(Response.json({ url: destination })) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(destination)
})

it.each(['account', 'unmount'] as const)('retires a portal handoff after %s changes', async change => {
  let finish!: (response: Response) => void
  let signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) }))
  const button = render(<ManageSubscriptionButton />)
  fireEvent.click(screen.getByRole('button'))
  if (change === 'account') { mocks.user = { id: 'owner-b' }; button.rerender(<ManageSubscriptionButton />) }
  else button.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(Response.json({ url: destination })) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
})
