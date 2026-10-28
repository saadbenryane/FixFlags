import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteSignupPrompt } from '../SiteSignupPrompt'
import { trackEvent } from '@/lib/analytics/events'

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, isLoading: false, error: null as string | null }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => auth }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); auth.user = null; auth.isLoading = false; auth.error = null })
afterEach(() => vi.useRealTimers())

describe('contextual Site signup invitation', () => {
  it('never interrupts analysis, even after the old modal delay', () => {
    render(<SiteSignupPrompt siteId="a_test" auditId="test" checking />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trackEvent).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Save this Site' })).not.toBeInTheDocument()
  })
  it('offers a nonblocking continuation that preserves the Site after checking', () => {
    const view = render(<SiteSignupPrompt siteId="a_test" auditId="test" checking />)
    view.rerender(<SiteSignupPrompt siteId="a_test" auditId="test" checking={false} />)
    expect(screen.getByRole('link', { name: 'Save this Site' })).toHaveAttribute('href', '/sign-up?next=%2Fsites%2Fa_test')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trackEvent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: 'Save this Site' }))
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('report_signup_cta_clicked', { from: 'value_strip' })
  })
  it.each(['signed-in', 'loading', 'error', 'detail'])('does not distract a %s view', state => {
    if (state === 'signed-in') auth.user = { id: 'user' }
    if (state === 'loading') auth.isLoading = true
    if (state === 'error') auth.error = 'Session unavailable'
    render(<SiteSignupPrompt siteId="a_test" auditId="test" checking={false} paused={state === 'detail'} />)
    expect(screen.queryByRole('link', { name: 'Save this Site' })).not.toBeInTheDocument()
  })
})
