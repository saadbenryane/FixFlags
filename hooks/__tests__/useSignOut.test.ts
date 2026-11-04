import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useSignOut } from '../useSignOut'
import { signOutClient } from '@/lib/auth/client-sign-out'
import { AUTH } from '@/lib/marketing/copy/auth'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/lib/auth/client-sign-out', () => ({ signOutClient: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('disables duplicate activation until the shared action settles', async () => {
  let finish!: () => void
  vi.mocked(signOutClient).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { result } = renderHook(() => useSignOut())
  let first!: Promise<void>, second!: Promise<void>
  act(() => { first = result.current.signOut(); second = result.current.signOut() })
  expect(result.current.busy).toBe(true)
  expect(signOutClient).toHaveBeenCalledOnce()
  await act(async () => { finish(); await Promise.all([first, second]) })
  expect(result.current.busy).toBe(false)
  expect(toast.error).not.toHaveBeenCalled()
})

it('offers an explicit retry after failure and clears the previous notice on retry', async () => {
  vi.mocked(signOutClient).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce()
  const { result } = renderHook(() => useSignOut())
  await act(async () => { await result.current.signOut() })
  expect(result.current.busy).toBe(false)
  expect(toast.error).toHaveBeenCalledWith(AUTH.signOut.error, {
    id: 'sign-out', action: { label: AUTH.signOut.retry, onClick: expect.any(Function) },
  })
  const options = vi.mocked(toast.error).mock.calls[0][1]!
  await act(async () => { (options.action as { onClick: () => void }).onClick() })
  expect(signOutClient).toHaveBeenCalledTimes(2)
  expect(toast.dismiss).toHaveBeenCalledTimes(2)
  expect(toast.dismiss).toHaveBeenLastCalledWith('sign-out')
  expect(result.current.busy).toBe(false)
})
