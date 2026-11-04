import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CLIENT_REQUEST_TIMEOUT_MS } from '@/lib/api/client-request'

const { signOut, clearDrafts, replace } = vi.hoisted(() => ({
  signOut: vi.fn(), clearDrafts: vi.fn(), replace: vi.fn(),
}))
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }))
vi.mock('@/lib/settings/drafts', () => ({ clearSettingsDrafts: clearDrafts }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubGlobal('window', { location: { replace } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('shares one pending sign-out and clears drafts before opening a fresh public document', async () => {
  let finish!: (value: unknown) => void
  signOut.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { signOutClient } = await import('../client-sign-out')
  const first = signOutClient(), second = signOutClient()
  expect(second).toBe(first)
  await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce())
  expect(signOut).toHaveBeenCalledWith({ fetchOptions: { signal: expect.any(AbortSignal) } })
  expect(clearDrafts).not.toHaveBeenCalled()
  expect(replace).not.toHaveBeenCalled()
  finish({ data: { success: true }, error: null })
  await first
  expect(clearDrafts).toHaveBeenCalledOnce()
  expect(replace).toHaveBeenCalledExactlyOnceWith('/')
  expect(clearDrafts.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0])
})

it.each([
  { data: null, error: { message: 'Refused' } },
  { data: { success: false }, error: null },
  { data: {}, error: null },
  undefined,
])('preserves drafts and the current document without a confirmed receipt: %j', async receipt => {
  signOut.mockResolvedValue(receipt)
  const { signOutClient } = await import('../client-sign-out')
  await expect(signOutClient()).rejects.toThrow()
  expect(clearDrafts).not.toHaveBeenCalled()
  expect(replace).not.toHaveBeenCalled()
})

it('releases a failed attempt so an explicit retry can succeed', async () => {
  signOut.mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({ data: { success: true }, error: null })
  const { signOutClient } = await import('../client-sign-out')
  await expect(signOutClient()).rejects.toThrow()
  expect(clearDrafts).not.toHaveBeenCalled()
  await signOutClient()
  expect(signOut).toHaveBeenCalledTimes(2)
  expect(clearDrafts).toHaveBeenCalledOnce()
  expect(replace).toHaveBeenCalledExactlyOnceWith('/')
})

it('bounds a stalled SDK request, ignores its late receipt, and permits an explicit retry', async () => {
  vi.useFakeTimers()
  let finish!: (value: unknown) => void
  signOut.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce({ data: { success: true }, error: null })
  const { signOutClient } = await import('../client-sign-out')
  const run = signOutClient()
  const rejected = expect(run).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(0)
  const signal = signOut.mock.calls[0][0].fetchOptions.signal as AbortSignal
  await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS)
  await rejected
  expect(signal.aborted).toBe(true)
  finish({ data: { success: true }, error: null })
  await vi.advanceTimersByTimeAsync(0)
  expect(clearDrafts).not.toHaveBeenCalled()
  expect(replace).not.toHaveBeenCalled()
  await signOutClient()
  expect(signOut).toHaveBeenCalledTimes(2)
  expect(replace).toHaveBeenCalledExactlyOnceWith('/')
  expect(vi.getTimerCount()).toBe(0)
})
