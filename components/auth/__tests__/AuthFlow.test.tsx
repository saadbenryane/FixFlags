import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AUTH } from '@/lib/marketing/copy/auth'
import { trackEvent } from '@/lib/analytics/events'

const replace = vi.hoisted(() => vi.fn())
const retry = vi.hoisted(() => vi.fn())
const useOAuthProviders = vi.hoisted(() => vi.fn())
const authClient = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  signUp: { email: vi.fn() },
  signIn: { email: vi.fn(), passkey: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
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
    replace.mockReset()
    authClient.signUp.email.mockReset()
    authClient.sendVerificationEmail.mockReset()
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

  it.each([
    ['signup', '/sites/current?category=conversion&flag=incident#evidence'],
    ['signin', '/sites/current/flags/captured?from=timeline#observation'],
  ] as const)('keeps the current Site identity and exact %s handoff visible', async (mode, next) => {
    const fetcher = vi.fn(async () => Response.json({ siteId: 'current', hostname: 'retained.example' }))
    vi.stubGlobal('fetch', fetcher)
    const request = mode === 'signup' ? authClient.signUp.email : authClient.signIn.email
    request.mockResolvedValue({ data: { token: 'confirmed-session', user: { id: 'confirmed-user' } }, error: null })
    const rendered = render(<AuthFlow mode={mode} nextPath={next} />)
    try {
      expect(await screen.findByText(AUTH.reportContext.title('retained.example'))).toBeVisible()
      expect(screen.getByRole('link', { name: AUTH.reportContext.backCta })).toHaveAttribute('href', next)
      expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/sites/current?scope=identity', expect.objectContaining({ cache: 'no-store' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
      fireEvent.click(screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Sign in', exact: true }))
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/post-login?next=' + encodeURIComponent(next)))
      expect(request).toHaveBeenCalledOnce()
    } finally { rendered.unmount(); vi.unstubAllGlobals() }
  })

  it('keeps sign-in available with the exact Site return link when identity access is refused', async () => {
    const next = '/sites/private/settings#scan-access'
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 403 })))
    authClient.signIn.email.mockResolvedValue({ data: { token: 'confirmed-session', user: { id: 'confirmed-user' } }, error: null })
    const rendered = render(<AuthFlow mode="signin" nextPath={next} />)
    try {
      expect(screen.getByRole('region', { name: AUTH.reportContext.regionLabel })).toBeVisible()
      expect(screen.getByText(AUTH.reportContext.loadingTitle)).toBeVisible()
      expect(screen.getByRole('link', { name: AUTH.reportContext.backCta })).toHaveAttribute('href', next)
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
      fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/post-login?next=' + encodeURIComponent(next)))
    } finally { rendered.unmount(); vi.unstubAllGlobals() }
  })

  it('keeps general authentication free of Site identity requests', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const rendered = render(<AuthFlow mode="signup" nextPath="/dashboard" />)
    try {
      expect(screen.queryByRole('region', { name: AUTH.reportContext.regionLabel })).not.toBeInTheDocument()
      expect(fetcher).not.toHaveBeenCalled()
    } finally { rendered.unmount(); vi.unstubAllGlobals() }
  })

  it.each([
    ['signup', null],
    ['signup', { user: { id: 'unconfirmed-user' } }],
    ['signup', { token: 'session-without-user' }],
    ['signin', { token: null, user: { id: 'unconfirmed-user' } }],
    ['signin', { token: '', user: { id: 'unconfirmed-user' } }],
    ['signin', { twoFactorRedirect: 'true' }],
  ] as const)('refuses an incomplete %s receipt and permits a confirmed retry: %j', async (mode, data) => {
    const request = mode === 'signup' ? authClient.signUp.email : authClient.signIn.email
    request.mockResolvedValueOnce({ data, error: null })
      .mockResolvedValueOnce({ data: { token: 'confirmed-session', user: { id: 'confirmed-user' } }, error: null })
    const onAuthenticated = vi.fn()
    render(<AuthFlow mode={mode} onAuthenticated={onAuthenticated} nextPath="/sites/retained-site" />)
    const email = screen.getByLabelText('Email'), password = screen.getByLabelText('Password')
    fireEvent.change(email, { target: { value: 'owner@example.com' } })
    fireEvent.change(password, { target: { value: 'StrongPassword123!' } })
    const submit = screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Sign in', exact: true })
    fireEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent(mode === 'signup' ? AUTH.signUp.unexpectedError : AUTH.signIn.unexpectedError)
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalledWith(mode === 'signup' ? 'signed_up' : 'signed_in', expect.anything())
    expect(email).toHaveValue('owner@example.com')
    expect(password).toHaveValue('StrongPassword123!')
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())
  })

  it('keeps a valid two-factor challenge separate from an authenticated session', async () => {
    const onAuthenticated = vi.fn()
    authClient.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null })
    render(<AuthFlow mode="signin" onAuthenticated={onAuthenticated} nextPath="/sites/retained-site" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
    const submit = screen.getByRole('button', { name: 'Sign in', exact: true })
    fireEvent.click(submit)
    await waitFor(() => expect(submit).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalledWith('signed_in', expect.anything())
  })

  it.each([undefined, { status: false }])('does not claim that an unacknowledged verification link was requested: %j', async data => {
    authClient.signUp.email.mockResolvedValue({ data: { token: null, user: { id: 'pending-user' } }, error: null })
    authClient.sendVerificationEmail.mockResolvedValue({ data, error: null })
    const onAuthenticated = vi.fn()
    render(<AuthFlow mode="signup" onAuthenticated={onAuthenticated} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }))
    await screen.findByRole('heading', { name: AUTH.emailVerification.title })
    fireEvent.click(screen.getByRole('button', { name: AUTH.emailVerification.resend }))
    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH.emailVerification.error)
    expect(screen.queryByText(AUTH.emailVerification.resent)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: AUTH.emailVerification.resend })).toBeEnabled()
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('keeps an unauthenticated signup at email verification instead of claiming its Site', async () => {
    const onAuthenticated = vi.fn()
    authClient.signUp.email.mockResolvedValue({ data: { token: null, user: { id: 'pending-user' } }, error: null })
    render(<AuthFlow mode="signup" onAuthenticated={onAuthenticated} nextPath="/sites/retained-site" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument())
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it.each(['signup', 'signin'] as const)('retains the %s destination through failed and successful verification-link requests', async mode => {
    const onAuthenticated = vi.fn()
    authClient.signUp.email.mockResolvedValue({ data: { token: null, user: { id: 'pending-user' } }, error: null })
    authClient.signIn.email.mockResolvedValue({ data: null, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email is not verified' } })
    render(<AuthFlow mode={mode} nextPath="/sites/retained-site" from="report" onAuthenticated={onAuthenticated} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Sign in', exact: true }))
    await screen.findByRole('heading', { name: 'Check your email' })
    expect(screen.getByRole('status', { name: 'Check your email' })).toHaveFocus()
    authClient.sendVerificationEmail.mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ data: { status: true }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Send another link' }))
    await screen.findByRole('alert')
    expect(screen.queryByText('Another verification link has been requested.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send another link' }))
    await screen.findByText('Another verification link has been requested.')
    expect(authClient.sendVerificationEmail).toHaveBeenLastCalledWith({ email: 'owner@example.com',
      callbackURL: '/post-login?next=%2Fsites%2Fretained-site&from=report', fetchOptions: { signal: expect.any(AbortSignal) } })
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Use another email' }))
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Sign in', exact: true })).toBeInTheDocument()
  })

  it('does not expose active authentication controls before hydration', () => {
    for (const mode of ['signin', 'signup'] as const) {
      const html = renderToString(<AuthFlow mode={mode} />)
      expect(html).toContain('Preparing secure sign in')
      expect(html).not.toContain('<input')
      expect(html).not.toContain('<button')
    }
  })

  it('does not request a second welcome email after signup sends its verification email', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const onAuthenticated = vi.fn()
    authClient.signUp.email.mockResolvedValue({ data: { token: 'session-token', user: { id: 'new-user' } }, error: null })
    try {
      render(<AuthFlow mode="signup" onAuthenticated={onAuthenticated} />)
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123!' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }))
      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())
      expect(fetch).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })

  it('keeps a failed sign-in message beside the controls until the next attempt', async () => {
    authClient.signIn.email.mockResolvedValue({ data: null, error: { message: 'Invalid email or password' } })
    render(<AuthFlow mode="signin" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'WrongPassword123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'))
    expect(screen.getByLabelText('Email')).toHaveValue('owner@example.com')
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
        'Create a free account to save southernia.com, get fix prompts, and set a monitoring schedule.'
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
    replace.mockReset()
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
    authClient.signIn.passkey.mockResolvedValue({ data: { session: { id: 'session', token: 'session-token', userId: 'user' }, user: { id: 'user' } }, error: null })

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
    expect(replace).toHaveBeenCalledWith('/post-login?next=%2Freport%2Faudit-1&from=report')
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
      data: { token: 'session-token', user: { id: 'u1' } },
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
        callbackURL: '/post-login?next=%2Freport%2Faudit-1&from=report',
        fetchOptions: { signal: expect.any(AbortSignal) },
      })
    )
    expect(replace).toHaveBeenCalledWith('/post-login?next=%2Freport%2Faudit-1&from=report')
    vi.unstubAllGlobals()
  })
})
