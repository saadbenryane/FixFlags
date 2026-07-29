import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const retry = vi.hoisted(() => vi.fn())
const useOAuthProviders = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/hooks/useOAuthProviders', () => ({ useOAuthProviders }))
vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({
  useRedirectIfAuthenticated: vi.fn(),
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

import { AuthFlow } from '@/components/auth/AuthFlow'

describe('AuthFlow report authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOAuthProviders.mockReturnValue({
      google: true,
      github: true,
      anyEnabled: true,
      isLoading: false,
      error: false,
      retry,
    })
  })

  it('orders Google and GitHub before the inline email form', () => {
    render(
      <AuthFlow
        mode="signup"
        presentation="report-dialog"
        nextPath="/report/audit-1"
        reportHostname="southernia.com"
      />
    )

    expect(
      screen.getByText(
        'Create a free account while FixFlags reviews southernia.com. Your report will be saved here.'
      )
    ).toBeInTheDocument()

    const google = screen.getByRole('button', { name: 'Continue with Google' })
    const github = screen.getByRole('button', { name: 'Continue with GitHub' })
    const email = screen.getByRole('textbox', { name: 'Email' })
    const password = screen.getByLabelText('Password')

    expect(google.compareDocumentPosition(github)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(github.compareDocumentPosition(email)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByText('or use email')).toBeInTheDocument()
    expect(email).toBeVisible()
    expect(password).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sign up with email' })).not.toBeInTheDocument()
  })

  it('keeps email available and offers retry when provider discovery fails', () => {
    useOAuthProviders.mockReturnValue({
      google: false,
      github: false,
      anyEnabled: false,
      isLoading: false,
      error: true,
      retry,
    })

    render(
      <AuthFlow
        mode="signup"
        presentation="report-dialog"
        nextPath="/report/audit-1"
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Social sign-in options could not load.'
    )
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('shows provider placeholders without hiding the email fields', () => {
    useOAuthProviders.mockReturnValue({
      google: false,
      github: false,
      anyEnabled: false,
      isLoading: true,
      error: false,
      retry,
    })

    render(
      <AuthFlow
        mode="signup"
        presentation="report-dialog"
        nextPath="/report/audit-1"
      />
    )

    expect(screen.getByLabelText('Preparing sign-in options')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible()
  })
})
