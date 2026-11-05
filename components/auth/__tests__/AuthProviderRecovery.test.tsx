import { act, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthFlow } from '../AuthFlow'
import { AUTH } from '@/lib/marketing/copy/auth'

vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({ useRedirectIfAuthenticated: vi.fn() }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: vi.fn(), passkey: vi.fn(), email: vi.fn() }, signUp: { email: vi.fn() } } }))
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('opens email entry after discovery times out and keeps the customer’s draft when retry restores provider options', async () => {
  vi.useFakeTimers()
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockResolvedValueOnce(Response.json({ google: true, github: false }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<SWRConfig value={{ provider: () => new Map() }}>
    <AuthFlow mode="signup" presentation="report-gate" nextPath="/sites/retained-site" />
  </SWRConfig>)
  try {
    expect(screen.getByRole('status', { name: AUTH.reportGate.preparingOptions })).toBeVisible()
    expect(screen.queryByLabelText(AUTH.signUp.emailLabel)).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH.oauth.discoveryError)
    const email = screen.getByLabelText(AUTH.signUp.emailLabel)
    expect(email).toBeVisible()
    expect(email).toHaveFocus()
    fireEvent.change(email, { target: { value: 'owner@example.test' } })
    fireEvent.change(screen.getByLabelText(AUTH.signUp.passwordLabel), { target: { value: 'RetainedPassword123!' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: AUTH.oauth.discoveryRetry })) })
    expect(screen.getByRole('button', { name: AUTH.oauth.continueWithGoogle })).toBeVisible()
    expect(screen.queryByRole('button', { name: AUTH.oauth.continueWithGitHub })).not.toBeInTheDocument()
    expect(email).toHaveValue('owner@example.test')
    expect(screen.getByLabelText(AUTH.signUp.passwordLabel)).toHaveValue('RetainedPassword123!')
    await act(async () => { finish(Response.json({ google: false, github: true })) })
    expect(screen.getByRole('button', { name: AUTH.oauth.continueWithGoogle })).toBeVisible()
    expect(fetcher).toHaveBeenCalledTimes(2)
  } finally { view.unmount(); vi.useRealTimers() }
})
