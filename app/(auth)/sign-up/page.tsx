'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { TextLink } from '@/components/ui/text-link'
import { Mail, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthValueProps } from '@/components/auth/AuthValueProps'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons, hasOAuthEnabled } from '@/components/auth/OAuthButtons'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'

function SignUpForm() {
  const { oauthCallbackURL, navigateAfterAuth, signInHref, plan } = useAuthRedirect()
  useRedirectIfAuthenticated()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setConfirmError('')

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await authClient.signUp.email({ name, email, password })
      if (error) {
        toast.error(error.message || 'Sign up failed')
        return
      }

      fetch('/api/email/welcome', { method: 'POST' }).catch(() => {})
      await navigateAfterAuth()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const planTitle =
    plan && plan in AUTH.signUp.planTitles
      ? AUTH.signUp.planTitles[plan as keyof typeof AUTH.signUp.planTitles]
      : null

  const showPlanSteps = plan && plan in AUTH.signUp.planTitles

  const subtitle = planTitle
    ? planTitle
    : hasOAuthEnabled()
      ? AUTH.signUp.subtitleWithOAuth
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
      <div className="rounded-card bg-muted/30 p-4 shadow-none">
        <AuthValueProps />
      </div>
      <OAuthButtons callbackURL={oauthCallbackURL} disabled={loading} />
      {hasOAuthEnabled() && (
        <p className="text-center text-xs text-muted-foreground">{AUTH.signUp.oauthNote}</p>
      )}
      {showPlanSteps && (
        <div className="rounded-card bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium">What happens next</p>
          <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
            {AUTH.signUp.planSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      <FormContainer onSubmit={handleSubmit}>
        <IconInput
          label="Name"
          icon={<User className="h-4 w-4" />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <IconInput
          type="email"
          label="Email"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          showRequirements
        />
        <PasswordInput
          label="Confirm password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value)
            setConfirmError('')
          }}
          error={confirmError}
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
      </FormContainer>
    </AuthCard>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
