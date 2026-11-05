import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { SignOutButton } from '../SignOutButton'
import { signOutClient } from '@/lib/auth/client-sign-out'
import { AUTH } from '@/lib/marketing/copy/auth'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/lib/auth/client-sign-out', () => ({ signOutClient: vi.fn() }))
afterEach(() => { vi.resetAllMocks() })

it('works outside an account provider and shows accessible progress until completion', async () => {
  let finish!: () => void
  vi.mocked(signOutClient).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<SignOutButton />)
  fireEvent.click(screen.getByRole('button', { name: AUTH.signOut.cta }))
  const working = screen.getByRole('button', { name: AUTH.signOut.working })
  expect(working).toBeDisabled()
  expect(working).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(working)
  expect(signOutClient).toHaveBeenCalledOnce()
  await act(async () => { finish() })
  expect(screen.getByRole('button', { name: AUTH.signOut.cta })).toBeEnabled()
})

it('recovers the button after an unavailable sign-out and offers a retry', async () => {
  vi.mocked(signOutClient).mockRejectedValueOnce(new Error('Offline'))
  render(<SignOutButton />)
  fireEvent.click(screen.getByRole('button', { name: AUTH.signOut.cta }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(AUTH.signOut.error, expect.objectContaining({
    action: expect.objectContaining({ label: AUTH.signOut.retry }),
  })))
  expect(screen.getByRole('button', { name: AUTH.signOut.cta })).toBeEnabled()
})
