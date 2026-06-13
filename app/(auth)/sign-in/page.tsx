'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH, BRAND } from '@/lib/marketing/copy'

const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true'
const hasGithub = process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === 'true'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        toast.error(error.message || 'Sign in failed')
        return
      }
      router.push('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setOauthLoading(provider)
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: '/dashboard',
      })
    } catch {
      toast.error('Sign in failed')
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <Link href="/" className="font-bold text-xl tracking-tight">
            {BRAND.name}
          </Link>
          <p className="text-sm text-muted-foreground">{AUTH.signIn.title}</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {(hasGoogle || hasGithub) && (
              <>
                <div className="flex flex-col gap-2">
                  {hasGoogle && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!!oauthLoading}
                      onClick={() => handleOAuth('google')}
                    >
                      {oauthLoading === 'google' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Continue with Google
                    </Button>
                  )}
                  {hasGithub && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!!oauthLoading}
                      onClick={() => handleOAuth('github')}
                    >
                      {oauthLoading === 'github' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Continue with GitHub
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
              </>
            )}
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
              <IconInput
                type="password"
                label="Password"
                icon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {AUTH.signIn.cta}
              </Button>
            </FormContainer>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          {AUTH.signIn.footer}{' '}
          <Link href="/sign-up" className="text-primary link-underline-grow">
            {AUTH.signIn.footerLink}
          </Link>
        </p>
      </div>
    </div>
  )
}
