'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH, BRAND } from '@/lib/marketing/copy'

export default function SignInPage() {
  const router = useRouter()
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
      router.push('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
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
          <CardContent className="pt-6">
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
