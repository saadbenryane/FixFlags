'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { TextLink } from '@/components/ui/text-link'
import { Mail, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { Muted } from '@/components/ui/typography'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons, hasOAuthEnabled } from '@/components/auth/OAuthButtons'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'
import { trackEvent } from '@/lib/analytics/events'

function SignInForm() {
  const { oauthCallbackURL, navigateAfterAuth, signUpHref } = useAuthRedirect()
  useRedirectIfAuthenticated()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        toast.error(error.message || 'Sign in failed')
        return
      }
      trackEvent('signed_in', { method: 'email' })
      await navigateAfterAuth()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const subtitle = hasOAuthEnabled()
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
      {hasOAuthEnabled() && <OAuthButtons callbackURL={oauthCallbackURL} disabled={loading} />}
      {hasOAuthEnabled() && (
        <Muted className="text-center text-xs">{AUTH.signIn.oauthNote}</Muted>
      )}
      <FormContainer onSubmit={handleSubmit} className="space-y-5">
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
