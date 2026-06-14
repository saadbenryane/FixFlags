'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { OAuthButtons, hasOAuthEnabled } from '@/components/auth/OAuthButtons'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'

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
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {AUTH.signIn.footer}{' '}
          <Link href={signUpHref()} className="text-primary link-underline-grow">
            {AUTH.signIn.footerLink}
          </Link>
        </p>
      }
    >
      <OAuthButtons callbackURL={oauthCallbackURL} disabled={loading} />
      <FormContainer onSubmit={handleSubmit}>
        <IconInput
          type="email"
          label="Email"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <PasswordInput label="Password" value={password} onChange={setPassword} />
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground link-underline-grow hover:text-foreground"
          >
            {AUTH.signIn.forgotPassword}
          </Link>
          <Link href="/privacy" className="text-xs text-muted-foreground underline hover:text-foreground">
            Privacy
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {AUTH.signIn.cta}
        </Button>
      </FormContainer>
    </AuthCard>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
