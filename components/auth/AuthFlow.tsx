'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Fingerprint, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { Separator } from '@/components/ui/separator'
import { AuthReportContext } from '@/components/auth/AuthReportContext'
import { AuthValueProps } from '@/components/auth/AuthValueProps'
import { AuthCard } from '@/components/auth/AuthCard'
import {
  buildPostLoginQuery,
  useAuthRedirect,
} from '@/hooks/useAuthRedirect'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'
import { trackEvent } from '@/lib/analytics/events'

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
  const [loading, setLoading] = useState<'email' | 'passkey' | null>(null)
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
    setMode(nextMode)
    setPassword('')
  }

  async function finishEmailAuth() {
    if (onAuthenticated) {
      await onAuthenticated()
      return
    }
    router.push(postLoginHref)
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
    markStarted('email')
    setLoading('email')
    try {
      if (mode === 'signup') {
        const { data, error } = await authClient.signUp.email({
          name: '',
          email: email.trim(),
          password,
        })
        if (error) {
          toast.error(error.message || AUTH.signUp.error)
          return
        }
        fetch('/api/email/welcome', { method: 'POST' }).catch(() => {})
        trackEvent('signed_up', {
          method: 'email',
          plan: route.plan ?? undefined,
          email: email.trim(),
          user_id: data?.user?.id,
          from: resolvedFrom ?? undefined,
        })
      } else {
        const { data, error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        })
        if (error) {
          toast.error(error.message || AUTH.signIn.error)
          return
        }
        if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
          window.location.href = twoFactorHref()
          return
        }
        trackEvent('signed_in', { method: 'email' })
      }
      await finishEmailAuth()
    } catch {
      toast.error(
        mode === 'signup' ? AUTH.signUp.unexpectedError : AUTH.signIn.unexpectedError
      )
    } finally {
      setLoading(null)
    }
  }

  async function handlePasskeySignIn() {
    setLoading('passkey')
    try {
      const { error } = await authClient.signIn.passkey({ autoFill: false })
      if (error) {
        const message = error.message ?? ''
        if (!/cancel|notallowed/i.test(message)) {
          toast.error(
            /not.?found|no.?credential/i.test(message)
              ? AUTH.passkeyErrors.notFound
              : AUTH.passkeyErrors.cancelled
          )
        }
        return
      }
      trackEvent('signed_in', { method: 'passkey' })
      await finishEmailAuth()
    } catch {
      toast.error(AUTH.passkeyErrors.cancelled)
    } finally {
      setLoading(null)
    }
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
        type="email"
        name="email"
        label={mode === 'signup' ? AUTH.signUp.emailLabel : AUTH.signIn.emailLabel}
        icon={<Mail className="h-4 w-4" />}
        value={email}
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
            <button
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
            </button>
          ) : null}
        </div>
      ) : null}
    </FormContainer>
  )

  const content = (
    <>
      {!isDialog && resolvedNext?.match(/^\/report\/[^/?#]+$/) ? (
        <AuthReportContext next={resolvedNext} />
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
          onMethodSelected={markStarted}
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
          <button
            type="button"
            onClick={toggleEmailForm}
            aria-expanded={showEmailForm}
            aria-controls="report-gate-email-form"
            className="group flex w-full items-center gap-3 py-1"
          >
            <Separator className="flex-1" />
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
            <Separator className="flex-1" />
          </button>
          {showEmailForm ? (
            <div id="report-gate-email-form">{emailForm}</div>
          ) : null}
        </div>
      ) : (
        emailForm
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === 'signup' ? AUTH.signUp.footer : AUTH.signIn.footer}{' '}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          {mode === 'signup' ? AUTH.signUp.footerLink : AUTH.signIn.footerLink}
        </button>
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
