import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() => vi.fn())
const retry = vi.hoisted(() => vi.fn())
const useOAuthProviders = vi.hoisted(() => vi.fn())
const authClient = vi.hoisted(() => ({
  signUp: { email: vi.fn() },
  signIn: { email: vi.fn(), passkey: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/hooks/useOAuthProviders', () => ({ useOAuthProviders }))
vi.mock('@/hooks/useRedirectIfAuthenticated', () => ({
  useRedirectIfAuthenticated: vi.fn(),
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient }))

import { AuthFlow } from '@/components/auth/AuthFlow'

describe('AuthFlow report dialog (waitlist-style, email form visible)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    push.mockReset()
    authClient.signUp.email.mockReset()
    authClient.signIn.email.mockReset()
    authClient.signIn.passkey.mockReset()
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

describe('AuthFlow report gate (SSO/passkey default)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    push.mockReset()
    authClient.signUp.email.mockReset()
    authClient.signIn.email.mockReset()
    authClient.signIn.passkey.mockReset()
    useOAuthProviders.mockReturnValue({
      google: true,
      github: true,
      anyEnabled: true,
      isLoading: false,
      error: false,
      retry,
    })
  })

  it('makes SSO and passkey the default actions and hides email behind a secondary toggle', () => {
    render(
      <AuthFlow
        mode="signup"
        presentation="report-gate"
        nextPath="/report/audit-1"
        reportHostname="southernia.com"
      />
    )

    const google = screen.getByRole('button', { name: 'Continue with Google' })
    const github = screen.getByRole('button', { name: 'Continue with GitHub' })
    const passkey = screen.getByRole('button', { name: 'Use a passkey' })
    expect(google.compareDocumentPosition(github)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(github.compareDocumentPosition(passkey)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    // The email/password form is collapsed by default.
    expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'or use email' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeVisible()
  })

  it('opens the email form on its own when no SSO provider is available', () => {
    useOAuthProviders.mockReturnValue({
      google: false,
      github: false,
      anyEnabled: false,
      isLoading: false,
      error: true,
      retry,
    })

    render(
      <AuthFlow mode="signup" presentation="report-gate" nextPath="/report/audit-1" />
    )

    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
  })

  it('signs in with a passkey from the default path', async () => {
    authClient.signIn.passkey.mockResolvedValue({ data: undefined, error: null })

    render(
      <AuthFlow
        mode="signup"
        presentation="report-gate"
        nextPath="/report/audit-1"
        from="report"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }))
    await waitFor(() =>
      expect(authClient.signIn.passkey).toHaveBeenCalledWith({ autoFill: false })
    )
    expect(push).toHaveBeenCalledWith('/post-login?next=%2Freport%2Faudit-1&from=report')
  })

  it('prefills the email field from the audit context when the form opens', () => {
    render(
      <AuthFlow
        mode="signup"
        presentation="report-gate"
        nextPath="/report/audit-1"
        initialEmail="builder@example.com"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'or use email' }))
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'builder@example.com'
    )
  })

  it('submits email signup through the secondary path and routes via /post-login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    )
    authClient.signUp.email.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })

    render(
      <AuthFlow
        mode="signup"
        presentation="report-gate"
        nextPath="/report/audit-1"
        from="report"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'or use email' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'builder@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'hunter2hunter' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(authClient.signUp.email).toHaveBeenCalledWith({
        name: '',
        email: 'builder@example.com',
        password: 'hunter2hunter',
      })
    )
    expect(push).toHaveBeenCalledWith('/post-login?next=%2Freport%2Faudit-1&from=report')
    vi.unstubAllGlobals()
  })
})
