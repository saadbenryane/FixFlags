'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TextLink } from '@/components/ui/text-link'
import { Mail, Loader2, ArrowRight, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { Muted } from '@/components/ui/typography'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthCardSkeleton } from '@/components/auth/AuthCardSkeleton'
import { AuthReportContext } from '@/components/auth/AuthReportContext'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { trackEvent } from '@/lib/analytics/events'

function SignInForm() {
  const {
    next,
    plan,
    from,
    oauthCallbackURL,
    oauthNewUserCallbackURL,
    postLoginHref,
    signUpHref,
  } = useAuthRedirect()
  const router = useRouter()
  useRedirectIfAuthenticated()
  const oauth = useOAuthProviders()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'email' | 'passkey' | null>(null)

  function twoFactorHref() {
    const params = new URLSearchParams()
    if (next) params.set('next', next)
    if (plan) params.set('plan', plan)
    if (from) params.set('from', from)
    const qs = params.toString()
    return qs ? `/two-factor?${qs}` : '/two-factor'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading('email')
    try {
      const { data, error } = await authClient.signIn.email({ email, password })
      if (error) {
        toast.error(error.message || AUTH.signIn.error)
        return
      }
      if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
        window.location.href = twoFactorHref()
        return
      }
      trackEvent('signed_in', { method: 'email' })
      // Through /post-login so anonymous audits get claimed before the
      // next/checkout navigation (same path OAuth takes).
      router.push(postLoginHref)
    } catch {
      toast.error(AUTH.signIn.unexpectedError)
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => {
    const canAutofill =
      typeof PublicKeyCredential !== 'undefined' &&
      typeof PublicKeyCredential.isConditionalMediationAvailable === 'function'
    if (!canAutofill) return
    void PublicKeyCredential.isConditionalMediationAvailable()
      .then(async (available) => {
        if (!available) return
        await authClient.signIn.passkey({ autoFill: true })
      })
      .catch((error) => {
        // Conditional passkey UI is an enhancement. Browsers may cancel it on
        // navigation or when no credential is available.
        if (document.visibilityState === 'visible') {
          console.warn('Conditional passkey sign-in was unavailable', error)
        }
      })
  }, [])

  async function handlePasskeySignIn() {
    setLoading('passkey')
    try {
      const { error } = await authClient.signIn.passkey({ autoFill: false })
      if (error) {
        const msg = error.message ?? ''
        if (/cancel|notallowed/i.test(msg)) {
          return
        }
        if (/not.?found|no.?credential/i.test(msg)) {
          toast.error(AUTH.passkeyErrors.notFound)
        } else {
          toast.error(AUTH.passkeyErrors.cancelled)
        }
        return
      }
      trackEvent('signed_in', { method: 'passkey' })
      router.push(postLoginHref)
    } catch {
      toast.error(AUTH.passkeyErrors.cancelled)
    } finally {
      setLoading(null)
    }
  }

  const subtitle = AUTH.signIn.subtitle
  const isReportContext = Boolean(next?.match(/^\/report\/[^/?#]+$/))

  return (
    <AuthCard
      title={AUTH.signIn.title}
      subtitle={subtitle}
      trustLine={isReportContext ? undefined : AUTH.signIn.trustLine}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {AUTH.signIn.footer}{' '}
          <TextLink href={signUpHref()}>{AUTH.signIn.footerLink}</TextLink>
        </p>
      }
    >
      {isReportContext ? <AuthReportContext next={next} /> : null}
      {oauth.anyEnabled && (
        <OAuthButtons
          callbackURL={oauthCallbackURL}
          newUserCallbackURL={oauthNewUserCallbackURL}
          google={oauth.google}
          github={oauth.github}
          disabled={loading !== null}
          from={from ?? undefined}
        />
      )}
      {oauth.anyEnabled && (
        <Muted className="text-center text-xs">{AUTH.signIn.oauthNote}</Muted>
      )}
      <FormContainer onSubmit={handleSubmit} className="space-y-5">
        <IconInput
          type="email"
          label={AUTH.signIn.emailLabel}
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={AUTH.signIn.emailPlaceholder}
          autoComplete="username webauthn"
          required
        />
        <PasswordInput
          label={AUTH.signIn.passwordLabel}
          value={password}
          onChange={setPassword}
          showRequirements
          autoComplete="current-password webauthn"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <Link
            href="/forgot-password"
            className="transition-colors duration-200 hover:text-foreground"
          >
            {AUTH.signIn.forgotPassword}
          </Link>
          <span className="inline-flex gap-2">
            <Link href="/privacy" className="underline hover:text-foreground">
              {AUTH.signIn.privacyLink}
            </Link>
            <Link href="/terms" className="underline hover:text-foreground">
              {AUTH.signIn.termsLink}
            </Link>
          </span>
        </div>
        <Button type="submit" className="w-full" disabled={loading !== null}>
          {loading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {AUTH.signIn.cta}
        </Button>
        <p className="text-center">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void handlePasskeySignIn()}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground disabled:opacity-50"
          >
            {loading === 'passkey' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Fingerprint className="h-3.5 w-3.5" />
            )}
            {AUTH.signIn.passkeyCta}
          </button>
        </p>
        <p className="text-center">
          <Link
            href="/#audit"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {AUTH.signIn.tryWithoutAccount}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </FormContainer>
    </AuthCard>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignInForm />
    </Suspense>
  )
}
