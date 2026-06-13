'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH, BRAND } from '@/lib/marketing/copy'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') as keyof typeof AUTH.signUp.planTitles | null

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await authClient.signUp.email({ name, email, password })
      if (error) {
        toast.error(error.message || 'Sign up failed')
        return
      }

      fetch('/api/email/welcome', { method: 'POST' }).catch(() => {})

      if (plan && ['BUILDER', 'TEAM', 'STUDIO'].includes(plan)) {
        const checkoutRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        })
        if (checkoutRes.ok) {
          const { url } = await checkoutRes.json()
          if (url) {
            window.location.href = url
            return
          }
        }
        router.push('/pricing')
      } else {
        router.push('/dashboard')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const planTitle = plan && plan in AUTH.signUp.planTitles
    ? AUTH.signUp.planTitles[plan]
    : null

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="text-center space-y-1">
        <Link href="/" className="font-bold text-xl tracking-tight">
          {BRAND.name}
        </Link>
        <p className="text-sm text-muted-foreground">{AUTH.signUp.title}</p>
        {planTitle ? (
          <p className="text-xs text-primary font-medium">{planTitle}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{AUTH.signUp.subtitle}</p>
        )}
      </div>
      <Card>
        <CardContent className="pt-6">
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
            <IconInput
              type="password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {AUTH.signUp.cta}
            </Button>
          </FormContainer>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        {AUTH.signUp.footer}{' '}
        <Link href="/sign-in" className="text-primary link-underline-grow">
          {AUTH.signUp.footerLink}
        </Link>
      </p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </div>
  )
}
