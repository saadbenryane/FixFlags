'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
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
    navigateAfterAuth,
    signUpHref,
  } = useAuthRedirect()
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
        toast.error(error.message || 'Sign in failed')
        return
      }
      if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
        window.location.href = twoFactorHref()
        return
      }
      trackEvent('signed_in', { method: 'email' })
      await navigateAfterAuth()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => {
    const canAutofill =
      typeof PublicKeyCredential !== 'undefined' &&
      typeof PublicKeyCredential.isConditionalMediationAvailable === 'function'
    if (!canAutofill) return
    void PublicKeyCredential.isConditionalMediationAvailable().then((available) => {
      if (!available) return
      void authClient.signIn.passkey({ autoFill: true })
    })
  }, [])

  async function handlePasskeySignIn() {
    setLoading('passkey')
    try {
      const { error } = await authClient.signIn.passkey({ autoFill: false })
      if (error) {
        toast.error(error.message || 'Passkey sign in failed')
        return
      }
      trackEvent('signed_in', { method: 'passkey' })
      await navigateAfterAuth()
    } catch {
      toast.error('Passkey sign in was cancelled or failed')
    } finally {
      setLoading(null)
    }
  }

  const subtitle = oauth.anyEnabled
    ? AUTH.signIn.subtitleWithOAuth
    : AUTH.signIn.subtitle

  return (
    <AuthCard
      title={AUTH.signIn.title}
      subtitle={subtitle}
      trustLine={AUTH.signIn.trustLine}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {AUTH.signIn.footer}{' '}
          <TextLink href={signUpHref()}>{AUTH.signIn.footerLink}</TextLink>
        </p>
      }
    >
      {oauth.anyEnabled && (
        <OAuthButtons
          callbackURL={oauthCallbackURL}
          newUserCallbackURL={oauthNewUserCallbackURL}
          google={oauth.google}
          github={oauth.github}
          disabled={loading !== null}
        />
      )}
      {oauth.anyEnabled && (
        <Muted className="text-center text-xs">{AUTH.signIn.oauthNote}</Muted>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading !== null}
        onClick={() => void handlePasskeySignIn()}
      >
        {loading === 'passkey' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Fingerprint className="mr-2 h-4 w-4" />
        )}
        {AUTH.signIn.passkeyCta}
      </Button>
      <FormContainer onSubmit={handleSubmit} className="space-y-5">
        <IconInput
          type="email"
          label="Email"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username webauthn"
          required
        />
        <PasswordInput
          label="Password"
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
              Privacy
            </Link>
            <Link href="/terms" className="underline hover:text-foreground">
              Terms
            </Link>
          </span>
        </div>
        <Button type="submit" className="w-full" disabled={loading !== null}>
          {loading === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {AUTH.signIn.cta}
        </Button>
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
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
