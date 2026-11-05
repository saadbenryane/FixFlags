import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PasskeyTwoFactorSettings } from '../PasskeyTwoFactorSettings'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), refresh: vi.fn(), success: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/lib/auth-client', () => ({ authClient: {
  passkey: { listUserPasskeys: mocks.list, addPasskey: mocks.add },
} }))
vi.mock('sonner', () => ({ toast: { success: mocks.success } }))
const C = AUTH.security
const recorded = { data: [{ id: 'key-1', createdAt: '2026-11-03T00:00:00Z', backedUp: true }], error: null }
const mount = () => render(<PasskeyTwoFactorSettings hasPassword={false} twoFactorEnabled={false} />)

beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue(recorded); mocks.add.mockResolvedValue({ data: { id: 'new-key' }, error: null }) })
afterEach(() => { cleanup(); vi.useRealTimers() })

it.each([null, {}, [{ id: '' }], [{ id: 'same' }, { id: 'same' }]])('keeps an unreadable inventory distinct from no passkeys: %j', async data => {
  mocks.list.mockResolvedValueOnce({ data, error: null })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent(C.loadError)
  expect(screen.queryByText(C.passkeysEmpty)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: C.enableCta })).toBeDisabled()
  const retry = screen.getByRole('button', { name: C.retryPasskeys })
  retry.focus()
  fireEvent.click(retry)
  expect(await screen.findByText(C.passkeyItem)).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: C.enableCta })).toBeEnabled()
  expect(screen.getByRole('heading', { name: C.passkeysTitle })).toHaveFocus()
})

it('bounds a stalled read and ignores its late response while an explicit retry is pending', async () => {
  vi.useFakeTimers()
  let first!: (value: typeof recorded) => void, second!: (value: typeof recorded) => void
  mocks.list.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  mount()
  const signal = mocks.list.mock.calls[0][0].fetchOptions.signal as AbortSignal
  expect(screen.getByRole('status')).toHaveTextContent(C.loadingPasskeys)
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(C.loadError)
  expect(screen.queryByText(C.passkeysEmpty)).not.toBeInTheDocument()
  const retry = screen.getByRole('button', { name: C.retryPasskeys })
  act(() => { fireEvent.click(retry); fireEvent.click(retry) })
  expect(mocks.list).toHaveBeenCalledTimes(2)
  await act(async () => { first(recorded) })
  expect(screen.queryByText(C.passkeyItem)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: C.enableCta })).toBeDisabled()
  await act(async () => { second(recorded) })
  expect(screen.getByText(C.passkeyItem)).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(mocks.success).not.toHaveBeenCalled()
})

it('retains recorded keys after a failed refresh and shows an empty list only after a confirmed read', async () => {
  mocks.list.mockResolvedValueOnce(recorded).mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ data: [], error: null })
  mount()
  expect(await screen.findByText(C.passkeyItem)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: C.addPasskey }))
  expect(await screen.findByRole('alert')).toHaveTextContent(C.loadError)
  expect(screen.getByText(C.passkeyItem)).toBeVisible()
  expect(screen.getByRole('button', { name: C.deletePasskey })).toBeDisabled()
  expect(screen.getByRole('button', { name: C.enableCta })).toBeDisabled()
  expect(screen.queryByText(C.passkeysEmpty)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: C.retryPasskeys }))
  expect(await screen.findByText(C.passkeysEmpty)).toBeVisible()
  expect(screen.queryByText(C.passkeyItem)).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('retires an earlier inventory read when registration requests a new one', async () => {
  let finish!: (value: typeof recorded) => void
  mocks.list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(recorded)
  mount()
  const signal = mocks.list.mock.calls[0][0].fetchOptions.signal as AbortSignal
  fireEvent.click(screen.getByRole('button', { name: C.addPasskey }))
  expect(await screen.findByText(C.passkeyItem)).toBeVisible()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish({ data: [], error: null }) })
  expect(screen.getByText(C.passkeyItem)).toBeVisible()
  expect(screen.queryByText(C.passkeysEmpty)).not.toBeInTheDocument()
})

it('cancels the owned inventory read when leaving settings', async () => {
  mocks.list.mockImplementationOnce(() => new Promise(() => {}))
  const view = mount()
  const signal = mocks.list.mock.calls[0][0].fetchOptions.signal as AbortSignal
  view.unmount()
  await act(async () => {})
  expect(signal.aborted).toBe(true)
  expect(mocks.list).toHaveBeenCalledOnce()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
