'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Fingerprint, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
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
export type AuthFlowPresentation = 'page' | 'report-dialog'

interface AuthFlowProps {
  mode: AuthFlowMode
  presentation?: AuthFlowPresentation
  nextPath?: string | null
  from?: string | null
  onAuthenticated?: () => Promise<void> | void
  auditId?: string
}

export function AuthFlow({
  mode: initialMode,
  presentation = 'page',
  nextPath,
  from,
  onAuthenticated,
  auditId,
}: AuthFlowProps) {
  const route = useAuthRedirect()
  const router = useRouter()
  const oauth = useOAuthProviders()
  const isDialog = presentation === 'report-dialog'
  useRedirectIfAuthenticated({ disabled: isDialog })

  const [mode, setMode] = useState<AuthFlowMode>(initialMode)
  const [emailExpanded, setEmailExpanded] = useState(!isDialog)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'email' | 'passkey' | null>(null)
  const signupStartedRef = useRef(false)

  const resolvedNext = nextPath ?? route.next
  const resolvedFrom = from ?? route.from
  const postLoginHref = useMemo(
    () => buildPostLoginQuery(resolvedNext, route.plan, resolvedFrom),
    [resolvedFrom, resolvedNext, route.plan]
  )
  const oauthNewUserCallbackURL = useMemo(
    () => buildPostLoginQuery(resolvedNext, route.plan, resolvedFrom, { newUser: true }),
    [resolvedFrom, resolvedNext, route.plan]
  )

  useEffect(() => {
    setMode(initialMode)
    setEmailExpanded(!isDialog)
  }, [initialMode, isDialog])

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
    setEmailExpanded(false)
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
    ? AUTH.reportGate.title
    : mode === 'signup'
      ? AUTH.signUp.title
      : AUTH.signIn.title
  const subtitle = isDialog
    ? AUTH.reportGate.subtitle
    : mode === 'signup'
      ? AUTH.signUp.subtitle
      : AUTH.signIn.subtitle

  const content = (
    <>
      {isDialog ? (
        <div className="rounded-[var(--radius-inner)] bg-brand/[0.055] p-4">
          <p className="text-sm font-medium text-foreground">{AUTH.reportGate.valueTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {AUTH.reportGate.valueBody}
          </p>
        </div>
      ) : resolvedNext?.match(/^\/report\/[^/?#]+$/) ? (
        <AuthReportContext next={resolvedNext} />
      ) : mode === 'signup' ? (
        <div className="rounded-card bg-muted/30 p-4 shadow-none">
          <AuthValueProps />
        </div>
      ) : null}

      {oauth.isLoading ? (
        <div className="space-y-2" aria-label={AUTH.reportGate.preparingOptions}>
          <div className="h-11 animate-pulse rounded-[var(--radius-control)] bg-muted" />
          <div className="h-11 animate-pulse rounded-[var(--radius-control)] bg-muted" />
        </div>
      ) : oauth.anyEnabled ? (
        <OAuthButtons
          callbackURL={postLoginHref}
          newUserCallbackURL={oauthNewUserCallbackURL}
          google={oauth.google}
          github={oauth.github}
          disabled={loading !== null}
          from={resolvedFrom ?? undefined}
          mode={mode}
          onMethodSelected={markStarted}
        />
      ) : null}

      {!emailExpanded ? (
        <Button
          type="button"
          variant={oauth.anyEnabled ? 'ghost' : 'default'}
          className="w-full"
          onClick={() => {
            markStarted('email')
            setEmailExpanded(true)
          }}
        >
          <Mail className="h-4 w-4" aria-hidden />
          {mode === 'signup' ? AUTH.reportGate.emailSignup : AUTH.reportGate.emailSignin}
        </Button>
      ) : (
        <FormContainer onSubmit={handleEmailSubmit} className="space-y-4">
          {isDialog && oauth.anyEnabled ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setEmailExpanded(false)}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {AUTH.reportGate.backToOptions}
            </button>
          ) : null}
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
            </div>
          ) : null}
        </FormContainer>
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
