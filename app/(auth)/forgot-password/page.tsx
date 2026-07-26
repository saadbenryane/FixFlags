'use client'

import { useState } from 'react'
import { TextLink } from '@/components/ui/text-link'
import { Mail, ArrowLeft } from 'lucide-react'
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
          <TextLink href="/sign-in" className="inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            {AUTH.forgotPassword.backToSignIn}
          </TextLink>
        </p>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground text-center">{AUTH.forgotPassword.sentBody}</p>
      ) : (
        <FormContainer onSubmit={handleSubmit}>
          <IconInput
            type="email"
            label={AUTH.forgotPassword.emailLabel}
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={AUTH.forgotPassword.emailPlaceholder}
            required
          />
          <Button type="submit" className="w-full" loading={loading} loadingLabel={AUTH.forgotPassword.cta}>
            {AUTH.forgotPassword.cta}
          </Button>
        </FormContainer>
      )}
    </AuthCard>
  )
}
