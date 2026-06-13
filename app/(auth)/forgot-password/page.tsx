'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        if (error.message?.includes('not configured') || error.status === 500) {
          toast.error(AUTH.forgotPassword.notConfigured)
        } else {
          toast.error(error.message || AUTH.forgotPassword.error)
        }
        return
      }
      setSent(true)
    } catch {
      toast.error(AUTH.forgotPassword.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title={AUTH.forgotPassword.title}
      subtitle={sent ? AUTH.forgotPassword.sentSubtitle : AUTH.forgotPassword.subtitle}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="inline-flex items-center gap-1 text-primary link-underline-grow">
            <ArrowLeft className="h-3 w-3" />
            {AUTH.forgotPassword.backToSignIn}
          </Link>
        </p>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground text-center">{AUTH.forgotPassword.sentBody}</p>
      ) : (
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {AUTH.forgotPassword.cta}
          </Button>
        </FormContainer>
      )}
    </AuthCard>
  )
}
