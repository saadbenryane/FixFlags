import { renderToString } from 'react-dom/server'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TwoFactorPage from '../page'

const calls = vi.hoisted(() => ({ passkey: vi.fn(), backup: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: calls.push }) }))
vi.mock('@/hooks/useAuthRedirect', () => ({ useAuthRedirect: () => ({ postLoginHref: '/sites', signInHref: () => '/sign-in' }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { passkey: calls.passkey }, twoFactor: { verifyBackupCode: calls.backup } } }))

beforeEach(() => { vi.clearAllMocks(); calls.passkey.mockResolvedValue({}); calls.backup.mockResolvedValue({}) })
describe('second-factor interaction readiness', () => {
  it('renders a loading status before handlers can accept authentication input', () => {
    const html = renderToString(<TwoFactorPage />)
    expect(html).toContain('Preparing secure sign in')
    expect(html).not.toContain('Continue with passkey')
    expect(html).not.toContain('id="backup-code"')
  })
  it('handles the first available passkey click once and navigates only after success', async () => {
    render(<TwoFactorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with passkey' }))
    await waitFor(() => expect(calls.push).toHaveBeenCalledWith('/sites'))
    expect(calls.passkey).toHaveBeenCalledOnce()
  })
  it('keeps a refused assertion on the second-factor screen', async () => {
    calls.passkey.mockResolvedValue({ error: { message: 'Authentication failed' } })
    render(<TwoFactorPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with passkey' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with passkey' })).toBeEnabled())
    expect(calls.push).not.toHaveBeenCalled()
  })
})
