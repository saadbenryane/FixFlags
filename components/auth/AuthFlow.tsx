'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Fingerprint, Loader2, Mail } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { SiteAuthContext } from '@/components/auth/SiteAuthContext'
import { AuthValueProps } from '@/components/auth/AuthValueProps'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthCardSkeleton } from '@/components/auth/AuthCardSkeleton'
import {
  buildPostLoginQuery,
  useAuthRedirect,
} from '@/hooks/useAuthRedirect'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'
import { trackEvent } from '@/lib/analytics/events'
import { siteAuthDestination } from '@/lib/auth/report-context'
import { withClientDeadline } from '@/lib/api/client-request'
import { emailAuthReceipt, passkeySessionReceipt } from '@/lib/auth/client-session-receipt'

export type AuthFlowMode = 'signup' | 'signin'
export type AuthFlowPresentation = 'page' | 'report-dialog' | 'report-gate'

interface AuthFlowProps {
  mode: AuthFlowMode
  presentation?: AuthFlowPresentation
  nextPath?: string | null
  from?: string | null
  /** Prefill the email field (e.g. an email typed on the waitlist page). */
  initialEmail?: string
  /** Override OAuth callback URLs (e.g. return to the waitlist page after SSO). */
  oauthCallbackURL?: string
  oauthNewUserCallbackURL?: string
  /** Override the dialog title/subtitle (defaults to the report-gate copy). */
  dialogTitle?: string
  dialogSubtitle?: string
  /** Waitlist-only. Report and homepage claim always continue through `/post-login`. */
  onAuthenticated?: () => Promise<void> | void
  auditId?: string
  reportHostname?: string | null
}

export function AuthFlow({
  mode: initialMode,
  presentation = 'page',
  nextPath,
  from,
  initialEmail = '',
  oauthCallbackURL: oauthCallbackURLOverride,
  oauthNewUserCallbackURL: oauthNewUserCallbackURLOverride,
  dialogTitle,
  dialogSubtitle,
  onAuthenticated,
  auditId,
  reportHostname,
}: AuthFlowProps) {
  const route = useAuthRedirect()
  const router = useRouter()
  const oauth = useOAuthProviders()
  const isDialog = presentation === 'report-dialog' || presentation === 'report-gate'
  // The report gate is the claim moment for an anonymous scan. SSO and passkey
  // are the default actions there; the email/password form is the secondary
  // path, collapsed behind the "or use email" toggle.
  const isReportGate = presentation === 'report-gate'
  useRedirectIfAuthenticated({ disabled: isDialog })

  const [mode, setMode] = useState<AuthFlowMode>(initialMode)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [verificationResent, setVerificationResent] = useState(false)
  const verificationRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (verificationEmail) verificationRef.current?.focus() }, [verificationEmail])
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const [loading, setLoading] = useState<'email' | 'passkey' | 'oauth' | null>(null)
  const submitting = useRef(false)
  const requestOwner = useRef<AbortController | null>(null)
  useEffect(() => {
    const owner = new AbortController()
    requestOwner.current = owner
    return () => { owner.abort(); if (requestOwner.current === owner) requestOwner.current = null }
  }, [])
  const [showEmailForm, setShowEmailForm] = useState(false)
  const signupStartedRef = useRef(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const resolvedNext = nextPath ?? route.next
  const resolvedFrom = from ?? route.from
  const postLoginHref = useMemo(
    () => buildPostLoginQuery(resolvedNext, route.plan, resolvedFrom),
    [resolvedFrom, resolvedNext, route.plan]
  )
  // The waitlist page overrides these so SSO returns to /waitlist/<plan>
  // instead of /post-login (which would fire checkout for a plan param).
  const resolvedOauthCallbackURL =
    oauthCallbackURLOverride ?? postLoginHref
  const resolvedOauthNewUserCallbackURL =
    oauthNewUserCallbackURLOverride ??
    buildPostLoginQuery(resolvedNext, route.plan, resolvedFrom, { newUser: true })

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode, isDialog])

  // If no SSO provider is available (discovery error or none configured), the
  // email form must open on its own so the gate never hides its only path.
  useEffect(() => {
    if (!isReportGate) return
    if (oauth.error || (!oauth.isLoading && !oauth.anyEnabled)) {
      setShowEmailForm(true)
    }
  }, [isReportGate, oauth.anyEnabled, oauth.error, oauth.isLoading])

  // Absorb a late-arriving email hint (the gate reads its audit context after
  // mount) without clobbering anything the user already typed.
  useEffect(() => {
    if (initialEmail) setEmail((current) => current || initialEmail)
  }, [initialEmail])

  // Move focus into the email field when the secondary form opens.
  useEffect(() => {
    if (showEmailForm) emailInputRef.current?.focus()
  }, [showEmailForm])

  function toggleEmailForm() {
    if (submitting.current) return
    const next = !showEmailForm
    setShowEmailForm(next)
    if (isReportGate && next) {
      trackEvent('report_auth_email_form_opened', { audit_id: auditId })
    }
  }

  function markStarted(method: string) {
    if (isDialog) {
      trackEvent('report_auth_method_selected', {
        audit_id: auditId,
        method,
        mode,
      })
    }
    if (mode !== 'signup' || signupStartedRef.current) return
    signupStartedRef.current = true
    trackEvent('signup_started', { method, from: resolvedFrom ?? undefined })
  }

  function switchMode(nextMode: AuthFlowMode) {
    if (submitting.current) return
    setFormError('')
    setVerificationEmail(null)
    setVerificationResent(false)
    setMode(nextMode)
    setPassword('')
  }

  async function finishEmailAuth() {
    if (onAuthenticated) {
      await onAuthenticated()
      return
    }
    router.replace(postLoginHref)
  }

  function twoFactorHref(): string {
    const params = new URLSearchParams()
    if (resolvedNext) params.set('next', resolvedNext)
    if (route.plan) params.set('plan', route.plan)
    if (resolvedFrom) params.set('from', resolvedFrom)
    const query = params.toString()
    return query ? `/two-factor?${query}` : '/two-factor'
  }

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault()
    const owner = requestOwner.current
    if (!owner || owner.signal.aborted || submitting.current) return
    const current = () => requestOwner.current === owner && !owner.signal.aborted
    submitting.current = true
    setFormError('')
    setLoading('email')
    try {
      markStarted('email')
      if (mode === 'signup') {
        const { data, error } = await withClientDeadline(signal => authClient.signUp.email({
          name: '',
          email: email.trim(),
          password,
          callbackURL: resolvedOauthCallbackURL,
          fetchOptions: { signal },
        }), owner.signal)
        if (!current()) return
        if (error) {
          setFormError(error.message || AUTH.signUp.error)
          return
        }
        const receipt = emailAuthReceipt.safeParse(data)
        if (!receipt.success) throw new Error('Authentication receipt unavailable')
        trackEvent('signed_up', {
          method: 'email',
          plan: route.plan ?? undefined,
          email: email.trim(),
          user_id: receipt.data.user.id,
          from: resolvedFrom ?? undefined,
        })
        if (receipt.data.token === null) {
          setPassword('')
          setVerificationEmail(email.trim())
          return
        }
      } else {
        const { data, error } = await withClientDeadline(signal => authClient.signIn.email({
          email: email.trim(),
          password,
          fetchOptions: { signal },
        }), owner.signal)
        if (!current()) return
        if (error) {
          if (error.code === 'EMAIL_NOT_VERIFIED') {
            setPassword('')
            setVerificationEmail(email.trim())
            return
          }
          setFormError(error.message || AUTH.signIn.error)
          return
        }
        if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect === true) {
          window.location.replace(twoFactorHref())
          return
        }
        const receipt = emailAuthReceipt.safeParse(data)
        if (!receipt.success || receipt.data.token === null) throw new Error('Authentication receipt unavailable')
        trackEvent('signed_in', { method: 'email' })
      }
      await finishEmailAuth()
    } catch {
      if (current()) setFormError(
        mode === 'signup' ? AUTH.signUp.unexpectedError : AUTH.signIn.unexpectedError
      )
    } finally {
      if (current()) { submitting.current = false; setLoading(null) }
    }
  }

  async function resendVerification() {
    const owner = requestOwner.current
    if (!owner || owner.signal.aborted || !verificationEmail || submitting.current) return
    const current = () => requestOwner.current === owner && !owner.signal.aborted
    submitting.current = true
    setLoading('email'); setFormError(''); setVerificationResent(false)
    try {
      const { data, error } = await withClientDeadline(signal => authClient.sendVerificationEmail({ email: verificationEmail, callbackURL: resolvedOauthCallbackURL, fetchOptions: { signal } }), owner.signal)
      if (!current()) return
      if (error) setFormError(error.message || AUTH.emailVerification.error)
      else if (data?.status === true) setVerificationResent(true)
      else setFormError(AUTH.emailVerification.error)
    } catch { if (current()) setFormError(AUTH.emailVerification.error) }
    finally { if (current()) { submitting.current = false; setLoading(null) } }
  }

  async function handlePasskeySignIn() {
    const owner = requestOwner.current
    if (!owner || owner.signal.aborted || submitting.current) return
    const current = () => requestOwner.current === owner && !owner.signal.aborted
    submitting.current = true
    setFormError('')
    setLoading('passkey')
    try {
      const { data, error } = await authClient.signIn.passkey({ autoFill: false })
      if (!current()) return
      if (error) {
        const message = error.message ?? ''
        if (!/cancel|notallowed/i.test(message)) {
          setFormError(
            /not.?found|no.?credential/i.test(message)
              ? AUTH.passkeyErrors.notFound
              : AUTH.passkeyErrors.cancelled
          )
        }
        return
      }
      if (!passkeySessionReceipt.safeParse(data).success) { setFormError(AUTH.passkeyErrors.cancelled); return }
      trackEvent('signed_in', { method: 'passkey' })
      await finishEmailAuth()
    } catch {
      if (current()) setFormError(AUTH.passkeyErrors.cancelled)
    } finally {
      if (current()) { submitting.current = false; setLoading(null) }
    }
  }

  // Authentication controls become available only after their handlers attach.
  if (!hydrated) return <AuthCardSkeleton />

  if (verificationEmail) {
    const content = <div ref={verificationRef} tabIndex={-1} role="status" aria-live="polite" aria-label={AUTH.emailVerification.title}
      className="space-y-4 outline-none">
      <p className="break-words text-sm">{AUTH.emailVerification.address(verificationEmail)}</p>
      <p className="text-sm text-muted-foreground">{AUTH.emailVerification.body}</p>
      <Button className="w-full" disabled={loading !== null} loading={loading === 'email'} loadingLabel={AUTH.emailVerification.resending}
        onClick={() => void resendVerification()}>{AUTH.emailVerification.resend}</Button>
      {verificationResent ? <p className="text-sm text-muted-foreground">{AUTH.emailVerification.resent}</p> : null}
      {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
      <Button variant="ghost" className="w-full" disabled={loading !== null} onClick={() => switchMode(mode)}>{AUTH.emailVerification.edit}</Button>
    </div>
    return isDialog ? <div className="space-y-4"><h2 className="text-xl font-semibold tracking-heading text-center">{AUTH.emailVerification.title}</h2>{content}</div>
      : <AuthCard title={AUTH.emailVerification.title}>{content}</AuthCard>
  }

  const title = isDialog
    ? dialogTitle ?? AUTH.reportGate.title
    : mode === 'signup'
      ? AUTH.signUp.title
      : AUTH.signIn.title
  const subtitle = isDialog
    ? dialogSubtitle ?? AUTH.reportGate.subtitle(reportHostname)
    : mode === 'signup'
      ? AUTH.signUp.subtitle
      : AUTH.signIn.subtitle

  const emailForm = (
    <FormContainer
      onSubmit={handleEmailSubmit}
      className="space-y-4"
      aria-live="polite"
    >
      <IconInput
        ref={emailInputRef}
        type="email"
        name="email"
        label={mode === 'signup' ? AUTH.signUp.emailLabel : AUTH.signIn.emailLabel}
        icon={<Mail className="h-4 w-4" />}
        value={email}
        onFocus={() => markStarted('email')}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={
          mode === 'signup'
            ? AUTH.signUp.emailPlaceholder
            : AUTH.signIn.emailPlaceholder
        }
        autoComplete="username webauthn"
        required
      />
      <PasswordInput
        label={
          mode === 'signup' ? AUTH.signUp.passwordLabel : AUTH.signIn.passwordLabel
        }
        value={password}
        onChange={setPassword}
        showRequirements={mode === 'signup'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password webauthn'}
      />
      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our{' '}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>
        .
      </p>
      <Button
        type="submit"
        className="w-full"
        disabled={loading !== null}
        loading={loading === 'email'}
        loadingLabel={mode === 'signup' ? AUTH.signUp.cta : AUTH.signIn.cta}
      >
        {mode === 'signup' ? AUTH.signUp.cta : AUTH.signIn.cta}
      </Button>
      {mode === 'signin' ? (
        <div className="flex flex-wrap items-center justify-center gap-x-4">
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {AUTH.signIn.forgotPassword}
          </Link>
          {!isReportGate ? (
            <InteractiveButton
              type="button"
              disabled={loading !== null}
              onClick={() => {
                markStarted('passkey')
                void handlePasskeySignIn()
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              {loading === 'passkey' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Fingerprint className="h-3.5 w-3.5" aria-hidden />
              )}
              {AUTH.signIn.passkeyCta}
            </InteractiveButton>
          ) : null}
        </div>
      ) : null}
    </FormContainer>
  )

  const content = (
    <>
      {!isDialog && siteAuthDestination(resolvedNext) ? (
        <SiteAuthContext next={resolvedNext} />
      ) : !isDialog && mode === 'signup' ? (
        <div className="rounded-card bg-muted/30 p-4 shadow-none">
          <AuthValueProps />
        </div>
      ) : null}

      {oauth.isLoading ? (
        <div className="space-y-2" role="status" aria-label={AUTH.reportGate.preparingOptions}>
          <div className="h-11 animate-pulse rounded-[var(--radius-control)] bg-muted" />
          <div className="h-11 animate-pulse rounded-[var(--radius-control)] bg-muted" />
        </div>
      ) : oauth.anyEnabled ? (
        <OAuthButtons
          callbackURL={resolvedOauthCallbackURL}
          newUserCallbackURL={resolvedOauthNewUserCallbackURL}
          google={oauth.google}
          github={oauth.github}
          disabled={loading !== null}
          from={resolvedFrom ?? undefined}
          mode={mode}
          hideDivider={isReportGate}
          onMethodSelected={(method) => {
            if (submitting.current) return false
            submitting.current = true
            setLoading('oauth')
            setFormError('')
            markStarted(method)
            return true
          }}
          onRequestFinished={() => { submitting.current = false; setLoading(null) }}
        />
      ) : oauth.error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-muted/40 px-3 py-2.5"
          role="alert"
        >
          <p className="text-sm text-muted-foreground">{AUTH.oauth.discoveryError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={oauth.retry}
          >
            {AUTH.oauth.discoveryRetry}
          </Button>
        </div>
      ) : null}

      {isReportGate ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading !== null}
          loading={loading === 'passkey'}
          loadingLabel={AUTH.signIn.passkeyCta}
          onClick={() => {
            markStarted('passkey')
            void handlePasskeySignIn()
          }}
        >
          {loading !== 'passkey' ? (
            <Fingerprint className="h-4 w-4" aria-hidden />
          ) : null}
          {AUTH.signIn.passkeyCta}
        </Button>
      ) : null}

      {isReportGate ? (
        <div className="space-y-4">
          <InteractiveButton
            type="button"
            onClick={toggleEmailForm}
            disabled={loading !== null}
            aria-expanded={showEmailForm}
            aria-controls="report-gate-email-form"
            className="group flex min-h-11 w-full items-center justify-center gap-2 py-2"
          >
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
              {AUTH.oauth.separator}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  showEmailForm && 'rotate-180'
                )}
                aria-hidden
              />
            </span>
          </InteractiveButton>
          {showEmailForm ? (
            <div id="report-gate-email-form">{emailForm}</div>
          ) : null}
        </div>
      ) : (
        emailForm
      )}

      {formError ? <p role="alert" className="break-words rounded-control border border-border bg-muted p-3 text-sm text-foreground">{formError}</p> : null}

      <p className="text-center text-sm text-muted-foreground">
        {mode === 'signup' ? AUTH.signUp.footer : AUTH.signIn.footer}{' '}
        <InteractiveButton
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
          disabled={loading !== null}
        >
          {mode === 'signup' ? AUTH.signUp.footerLink : AUTH.signIn.footerLink}
        </InteractiveButton>
      </p>
    </>
  )

  if (isDialog) {
    return (
      <div className="space-y-4">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-semibold tracking-heading text-balance">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">{subtitle}</p>
        </div>
        {content}
      </div>
    )
  }

  return (
    <AuthCard
      title={title}
      subtitle={subtitle}
      footer={
        <Link
          href="/#audit"
          className="mx-auto flex min-h-11 w-fit items-center text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          {AUTH.reportGate.backHome}
        </Link>
      }
    >
      {content}
    </AuthCard>
  )
}
