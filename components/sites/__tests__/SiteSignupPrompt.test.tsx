import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteSignupPrompt } from '../SiteSignupPrompt'

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, isLoading: false, error: null as string | null }))
const social = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('@/hooks/useMe', () => ({ useMe: () => auth }))
vi.mock('@/hooks/useOAuthProviders', () => ({ useOAuthProviders: () => ({ google: true, github: true, anyEnabled: true, isLoading: false, error: false, retry: vi.fn() }) }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social } } }))

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  auth.user = null
  auth.isLoading = false
  auth.error = null
  social.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('Site signup prompt', () => {
  it('opens after five seconds, preserves the claim callback, and remembers Skip for now', async () => {
    const props = { siteId: 'a_test', auditId: 'test', checking: true }
    const view = render(<SiteSignupPrompt {...props} />)
    act(() => vi.advanceTimersByTime(4_999))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('dialog', { name: 'Keep an eye on this website.' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sign in with email' })).toHaveAttribute('href', '/sign-in?next=%2Fsites%2Fa_test')
    expect(screen.getByRole('link', { name: 'Sign up with email' })).toHaveAttribute('href', '/sign-up?next=%2Fsites%2Fa_test')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' })))
    expect(social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/post-login?next=%2Fsites%2Fa_test&from=report', newUserCallbackURL: '/post-login?next=%2Fsites%2Fa_test&from=report&signup=1' })
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    view.unmount()
    render(<SiteSignupPrompt {...props} />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancels the prompt if analysis finishes before the delay', () => {
    const view = render(<SiteSignupPrompt siteId="a_test" auditId="test" checking />)
    act(() => vi.advanceTimersByTime(3_000))
    view.rerender(<SiteSignupPrompt siteId="a_test" auditId="test" checking={false} />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('waits until an open detail panel is closed', () => {
    const view = render(<SiteSignupPrompt siteId="a_test" auditId="test" checking paused />)
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    view.rerender(<SiteSignupPrompt siteId="a_test" auditId="test" checking />)
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it.each(['signed-in', 'loading', 'error'])('does not prompt a %s session', (state) => {
    if (state === 'signed-in') auth.user = { id: 'user' }
    if (state === 'loading') auth.isLoading = true
    if (state === 'error') auth.error = 'Session unavailable'
    render(<SiteSignupPrompt siteId="a_test" auditId="test" checking />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
