'use client'

import { useEffect, useRef, useState } from 'react'
import { TextLink } from '@/components/ui/text-link'
import { Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { AuthCard } from '@/components/auth/AuthCard'
import { accountStatusReceipt, requestAccountChange } from '@/lib/auth/client-account-request'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const requestOwner = useRef<AbortController | null>(null)
  useEffect(() => {
    const owner = new AbortController()
    requestOwner.current = owner
    return () => { owner.abort(); if (requestOwner.current === owner) requestOwner.current = null }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const owner = requestOwner.current
    if (!owner || owner.signal.aborted || submitting.current) return
    const current = () => requestOwner.current === owner && !owner.signal.aborted
    submitting.current = true
    setError('')
    setLoading(true)
    try {
      const result = await requestAccountChange(signal => authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
        fetchOptions: { signal },
      }), accountStatusReceipt, AUTH.forgotPassword.error, owner.signal)
      if (!current()) return
      if (!result.ok) {
        setError(result.error.includes('not configured') ? AUTH.forgotPassword.notConfigured : result.error)
        return
      }
      setSent(true)
    } finally {
      if (current()) { submitting.current = false; setLoading(false) }
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
            disabled={loading}
            autoComplete="email"
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder={AUTH.forgotPassword.emailPlaceholder}
            required
          />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" loading={loading} loadingLabel={AUTH.forgotPassword.cta}>
            {AUTH.forgotPassword.cta}
          </Button>
        </FormContainer>
      )}
    </AuthCard>
  )
}
