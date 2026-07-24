'use client'

import { useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TextLink } from '@/components/ui/text-link'
import { Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthValueProps } from '@/components/auth/AuthValueProps'
import { AuthReportContext } from '@/components/auth/AuthReportContext'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { trackEvent } from '@/lib/analytics/events'

function SignUpForm() {
  const { next, oauthCallbackURL, oauthNewUserCallbackURL, postLoginHref, signInHref, plan, from } =
    useAuthRedirect()
  const router = useRouter()
  useRedirectIfAuthenticated()
  const oauth = useOAuthProviders()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const signupStartedRef = useRef(false)

  function markSignupStarted(method: string) {
    if (signupStartedRef.current) return
    signupStartedRef.current = true
    trackEvent('signup_started', { method, from: from ?? undefined })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    markSignupStarted('email')
    setLoading(true)
    try {
      const { data, error } = await authClient.signUp.email({ name: '', email, password })
      if (error) {
        toast.error(error.message || AUTH.signUp.error)
        return
      }
      fetch('/api/email/welcome', { method: 'POST' }).catch(() => {})
      trackEvent('signed_up', {
        method: 'email',
        plan: plan ?? undefined,
        email,
        user_id: data?.user?.id,
        from: from ?? undefined,
      })
      // Through /post-login so anonymous audits get claimed before the
      // next/checkout navigation (same path OAuth takes).
      router.push(postLoginHref)
    } catch {
      toast.error(AUTH.signUp.unexpectedError)
    } finally {
      setLoading(false)
    }
  }

  const planTitle =
    plan && plan in AUTH.signUp.planTitles
      ? AUTH.signUp.planTitles[plan as keyof typeof AUTH.signUp.planTitles]
      : null

  const showPlanSteps = plan && plan in AUTH.signUp.planTitles
  const isReportContext = Boolean(next?.match(/^\/report\/[^/?#]+$/))
  const subtitle = planTitle
    ? planTitle
    : from === 'pricing'
      ? AUTH.signUp.fromPricing
      : AUTH.signUp.subtitle

  return (
    <AuthCard
      title={AUTH.signUp.title}
      subtitle={subtitle}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {AUTH.signUp.footer}{' '}
          <TextLink href={signInHref()}>{AUTH.signUp.footerLink}</TextLink>
        </p>
      }
    >
      {isReportContext ? (
        <AuthReportContext next={next} />
      ) : (
        <div className="rounded-card bg-muted/30 p-4 shadow-none">
          <AuthValueProps />
        </div>
      )}
      {oauth.anyEnabled && (
        <OAuthButtons
          callbackURL={oauthCallbackURL}
          newUserCallbackURL={oauthNewUserCallbackURL}
          google={oauth.google}
          github={oauth.github}
          disabled={loading}
          from={from ?? undefined}
        />
      )}
      {oauth.anyEnabled && (
        <p className="text-center text-xs text-muted-foreground">{AUTH.signUp.oauthNote}</p>
      )}
      {showPlanSteps && (
        <div className="rounded-card bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium">{AUTH.signUp.planStepsTitle}</p>
          <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
            {AUTH.signUp.planSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      <FormContainer onSubmit={handleSubmit}>
        <IconInput
          type="email"
          label={AUTH.signUp.emailLabel}
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => markSignupStarted('email')}
          placeholder={AUTH.signUp.emailPlaceholder}
          required
        />
        <PasswordInput
          label={AUTH.signUp.passwordLabel}
          value={password}
          onChange={setPassword}
          showRequirements
          autoComplete="new-password"
        />
        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>
          .
        </p>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {AUTH.signUp.cta}
        </Button>
        <p className="text-center">
          <Link
            href="/#audit"
            className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {AUTH.signUp.tryWithoutAccount}
          </Link>
        </p>
      </FormContainer>
    </AuthCard>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  )
}
