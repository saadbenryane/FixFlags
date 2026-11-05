import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PasskeyEnrollPrompt, shouldShowPasskeyEnroll } from '../PasskeyEnrollPrompt'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ available: vi.fn(), list: vi.fn(), add: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { passkey: { listUserPasskeys: mocks.list, addPasskey: mocks.add } } }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks()
  vi.stubGlobal('PublicKeyCredential', { isConditionalMediationAvailable: mocks.available })
  mocks.available.mockResolvedValue(true)
  mocks.list.mockResolvedValue({ data: [], error: null })
  mocks.add.mockResolvedValue({ data: { id: 'confirmed-passkey' }, error: null })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
const C = AUTH.passkeyEnroll

it.each([{ data: null }, { data: {} }, { data: [{ id: '' }] }, { data: [{ id: 'same' }, { id: 'same' }] }, { data: [], error: { message: 'Account lookup unavailable' } }])
('does not turn unavailable passkey evidence into an empty account: %j', async result => {
  mocks.list.mockResolvedValue(result)
  await expect(shouldShowPasskeyEnroll()).resolves.toBe(false)
})

it('offers optional enrollment only after a confirmed empty list on a supported device', async () => {
  await expect(shouldShowPasskeyEnroll()).resolves.toBe(true)
  mocks.list.mockResolvedValue({ data: [{ id: 'existing-passkey' }], error: null })
  await expect(shouldShowPasskeyEnroll()).resolves.toBe(false)
  mocks.available.mockResolvedValue(false); mocks.list.mockClear()
  await expect(shouldShowPasskeyEnroll()).resolves.toBe(false)
  expect(mocks.list).not.toHaveBeenCalled()
})

it.each(['deadline', 'owner'] as const)('keeps a late capability probe from starting a read after its %s expires', async interruption => {
  let finish!: (available: boolean) => void
  mocks.available.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const owner = new AbortController(), settled: boolean[] = []
  const pending = shouldShowPasskeyEnroll(owner.signal).then(value => { settled.push(value) })
  if (interruption === 'deadline') await vi.advanceTimersByTimeAsync(15_000)
  else { owner.abort(); await vi.advanceTimersByTimeAsync(0) }
  expect(settled).toEqual([false])
  finish(true); await pending; await vi.advanceTimersByTimeAsync(0)
  expect(mocks.list).not.toHaveBeenCalled()
})

it('bounds a stalled account read without holding the sign-in journey', async () => {
  mocks.list.mockImplementation(() => new Promise(() => {}))
  const settled: boolean[] = []
  void shouldShowPasskeyEnroll().then(value => { settled.push(value) })
  await vi.advanceTimersByTimeAsync(15_000)
  expect(settled).toEqual([false])
  expect(mocks.list.mock.calls[0][0].fetchOptions.signal.aborted).toBe(true)
})

it('starts one native enrollment inside the gesture and lets the authenticator own its timing', async () => {
  let finish!: (result: unknown) => void
  mocks.add.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const complete = vi.fn()
  render(<PasskeyEnrollPrompt ownerId="owner-a" onComplete={complete} />)
  const create = screen.getByRole('button', { name: C.cta })
  act(() => { fireEvent.click(create); fireEvent.click(create) })
  expect(mocks.add).toHaveBeenCalledOnce()
  expect(create).toBeDisabled()
  expect(screen.getByRole('button', { name: C.skip })).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(create).toBeDisabled()
  expect(complete).not.toHaveBeenCalled()
  await act(async () => { finish({ data: { id: 'confirmed-passkey' }, error: null }) })
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith(C.success)
  expect(complete).toHaveBeenCalledOnce()
})

it.each([{}, { data: null }, { data: {} }, { data: { id: '' } }, { data: { id: 'unconfirmed' }, error: { message: 'Registration refused' } }])
('requires a saved passkey receipt before completing enrollment: %j', async result => {
  mocks.add.mockResolvedValueOnce(result)
  const complete = vi.fn()
  render(<PasskeyEnrollPrompt ownerId="owner-a" onComplete={complete} />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.cta })) })
  expect(complete).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.error).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: C.cta })).toBeEnabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.cta })) })
  expect(complete).toHaveBeenCalledOnce()
})

it.each(['account', 'unmount'] as const)('retires native enrollment feedback after %s changes', async change => {
  let finish!: (result: unknown) => void
  mocks.add.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const complete = vi.fn()
  const view = render(<PasskeyEnrollPrompt ownerId="owner-a" onComplete={complete} />)
  fireEvent.click(screen.getByRole('button', { name: C.cta }))
  const signal = mocks.add.mock.calls[0][0]?.fetchOptions.signal as AbortSignal
  if (change === 'account') view.rerender(<PasskeyEnrollPrompt ownerId="owner-b" onComplete={complete} />)
  else view.unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () => { finish({ data: { id: 'earlier-account-passkey' }, error: null }) })
  expect(complete).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled()
})

it('waits for a known account before starting enrollment while keeping the optional skip usable', () => {
  const complete = vi.fn()
  render(<PasskeyEnrollPrompt ownerId={null} onComplete={complete} />)
  expect(screen.getByRole('button', { name: C.cta })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: C.skip }))
  expect(complete).toHaveBeenCalledOnce()
  expect(mocks.add).not.toHaveBeenCalled()
})
